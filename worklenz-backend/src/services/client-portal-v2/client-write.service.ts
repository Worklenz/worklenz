import db from "../../config/db";
import { createPresignedUrlWithClient, getProjectFileStorageKey } from "../../shared/storage";
import { htmlToPlainText } from "../../shared/utils";
import { withTransaction } from "../client-contacts-service";
import { recordAuditEvent, recordAuditEventSafely } from "./audit.service";
import { activeProjectContacts, ensureThread, mirrorChangeRequestMessage, THREAD_MAX_ATTACHMENTS, THREAD_MAX_ATTACHMENT_BYTES, ThreadContextRef, ThreadContextType } from "./discussions.service";
import { PortalError, badRequest, conflict, forbidden, notFound } from "./errors";
import { PresignInput, confirmPortalFile, presignPortalFile, resolveVersionObject } from "./files.service";
import { notifyClientUsers, notifyStaff } from "./notify.service";
import { cleanPortalRichText } from "./rich-text";
import { nextChangeRequestNo } from "./sequences";
import { assertSubjectProject, changeRequestVisibleSql, fileClientVisibleSql, getSubjectProjectIds } from "./scope";
import { Queryable } from "./types";
import { ClientSubject } from "./subject";
import { requireCapability } from "./client-read.service";
import { getProjectRef } from "./project-core";

/**
 * What a client user can DO. Every action re-checks the gating chain and the role capability, then
 * writes the audit event and the internal notification the spec asks for. The client portal has no
 * "simulate" helper: these are the real client actions the staff-side prototype helpers stood in for.
 */

/** Client previews and downloads get a much shorter-lived link than staff, so a reused URL dies soon. */
export const CLIENT_DOWNLOAD_TTL_SECONDS = 60;

/**
 * Hourly ceilings per client user for actions that fan out to staff (an in-app notification and, by
 * default, an email to every workspace Owner/Admin). Generous for real use, a stop for a flood.
 */
export const CLIENT_HOURLY_LIMITS = { change_requests: 20, comments: 60, uploads: 100 } as const;

async function assertUnderHourlyLimit(sql: string, params: unknown[], max: number, what: string): Promise<void> {
  const result = await db.query(sql, params);
  if ((result.rows[0]?.n ?? 0) >= max) {
    throw new PortalError(429, `Too many ${what} in the last hour. Please try again later.`, "RATE_LIMITED");
  }
}

const clientActor = (subject: ClientSubject) => ({ side: "client" as const, name: subject.name, contactId: subject.contactId });

// ─── Change requests ────────────────────────────────────────────────────────

export interface SubmitChangeRequestInput {
  project_id?: string;
  title?: string;
  description?: string;
  notes?: string;
  priority?: string;
  /** Ids of project files the client already uploaded (presign + confirm) for this request. */
  attachment_file_ids?: string[];
}

export const CHANGE_REQUEST_MAX_ATTACHMENTS = 5;
export const CHANGE_REQUEST_MAX_ATTACHMENT_BYTES = 100 * 1024 * 1024;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Reads and checks the files a client attached. Each must be a confirmed upload on this project by
 * this same contact, not already attached to another request, and within the size limit.
 */
async function loadChangeRequestAttachments(
  tx: Queryable,
  subject: ClientSubject,
  projectId: string,
  rawIds: unknown
): Promise<Array<{ id: string; name: string; type: string; size: number }>> {
  if (rawIds === undefined || rawIds === null) return [];
  if (!Array.isArray(rawIds) || rawIds.some(id => typeof id !== "string" || !UUID_PATTERN.test(id))) {
    throw badRequest("Attachments are invalid", "INVALID_ATTACHMENTS");
  }
  const ids = [...new Set(rawIds as string[])];
  if (ids.length === 0) return [];
  if (ids.length > CHANGE_REQUEST_MAX_ATTACHMENTS) {
    throw badRequest(`You can attach at most ${CHANGE_REQUEST_MAX_ATTACHMENTS} files`, "TOO_MANY_ATTACHMENTS");
  }

  const result = await tx.query(
    `SELECT pf.id, pf.name, pf.type, pf.size::float AS size
       FROM project_files pf
      WHERE pf.id = ANY($1::uuid[]) AND pf.team_id = $2 AND pf.project_id = $3 AND pf.status = 'active'
        AND pf.uploaded_by_side = 'client' AND pf.uploaded_by_contact_id = $4
        AND NOT EXISTS (SELECT 1 FROM client_portal_change_request_attachments a WHERE a.file_id = pf.id)`,
    [ids, subject.teamId, projectId, subject.contactId]
  );
  if (result.rows.length !== ids.length) {
    throw badRequest("One of the attached files could not be found. Upload it again.", "INVALID_ATTACHMENTS");
  }
  if (result.rows.some(row => row.size > CHANGE_REQUEST_MAX_ATTACHMENT_BYTES)) {
    throw badRequest("Each attachment can be at most 100 MB", "ATTACHMENT_TOO_LARGE");
  }
  return result.rows;
}

/**
 * Submits a change request. Submitting NEVER creates a task. Client Admins and Members can submit;
 * priority is set by the client and cannot be changed by staff.
 */
export async function submitChangeRequest(subject: ClientSubject, body: SubmitChangeRequestInput): Promise<{ id: string; cr_no: string }> {
  requireCapability(subject, "submit_change_request");
  await assertUnderHourlyLimit(
    `SELECT COUNT(*)::int AS n FROM client_portal_change_requests
      WHERE requester_contact_id = $1 AND submitted_at > NOW() - INTERVAL '1 hour'`,
    [subject.contactId],
    CLIENT_HOURLY_LIMITS.change_requests,
    "change requests"
  );

  const title = (body.title ?? "").trim();
  // Description and notes come from the rich-text editor: sanitized, and the cap applies to the visible text.
  const description = cleanPortalRichText(body.description, 5000, "The description");
  if (!body.project_id) throw badRequest("Choose a project", "MISSING_FIELDS");
  if (!title) throw badRequest("A title is required", "MISSING_FIELDS");
  if (title.length > 200) throw badRequest("A title can be at most 200 characters");
  if (!description) throw badRequest("Describe the change you need", "MISSING_FIELDS");
  const priority = body.priority ?? "medium";
  if (!["low", "medium", "high"].includes(priority)) throw badRequest("Priority must be low, medium or high");

  const created = await withTransaction(async tx => {
    await assertSubjectProject(tx, subject, body.project_id as string);
    const project = await getProjectRef(tx, subject.teamId, body.project_id as string);
    const attachments = await loadChangeRequestAttachments(tx, subject, body.project_id as string, body.attachment_file_ids);
    const crNo = await nextChangeRequestNo(tx, subject.teamId);

    const inserted = await tx.query(
      `INSERT INTO client_portal_change_requests
         (cr_no, organization_team_id, client_id, project_id, title, description, notes, priority,
          requester_contact_id, requester_name)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id`,
      [
        crNo,
        subject.teamId,
        subject.clientId,
        body.project_id,
        title,
        description,
        cleanPortalRichText(body.notes, 5000, "The notes"),
        priority,
        subject.contactId,
        subject.name,
      ]
    );
    const id = inserted.rows[0].id as string;

    for (const file of attachments) {
      await tx.query(
        `INSERT INTO client_portal_change_request_attachments (change_request_id, file_name, storage_key, size, file_id)
         VALUES ($1, $2, $3, $4, $5)`,
        [id, file.name, getProjectFileStorageKey(subject.teamId, project.id, file.id, file.type), file.size, file.id]
      );
    }

    await tx.query(
      `INSERT INTO client_portal_change_request_events (change_request_id, actor_side, actor_name, text)
       VALUES ($1, 'client', $2, 'Submitted the change request')`,
      [id, subject.name]
    );
    await recordAuditEvent(tx, {
      teamId: subject.teamId,
      event: "Change request created",
      actor: clientActor(subject),
      clientId: subject.clientId,
      clientName: project.clientName,
      projectId: project.id,
      targetType: "change_request",
      targetId: id,
      targetLabel: `${crNo} · ${title}`,
    });

    return { id, crNo, title, projectId: project.id };
  });

  void notifyStaff({
    teamId: subject.teamId,
    kind: "Change Request",
    title: `New change request ${created.crNo}`,
    body: `${subject.name}: ${created.title}`,
    url: `/worklenz/client-portal/change-requests/${created.id}`,
    projectId: created.projectId,
    emailEvent: "change_request",
  });

  return { id: created.id, cr_no: created.crNo };
}

/**
 * A client reply on a change request. A Client Admin or Member on the project may answer. When the
 * request was waiting on information (More Information Required) it returns to Under Review
 * automatically, which is recorded in the history and audit log.
 */
export async function replyToChangeRequest(subject: ClientSubject, id: string, text: string): Promise<void> {
  requireCapability(subject, "submit_change_request");
  const body = cleanPortalRichText(text, 5000, "A reply");
  if (!body) throw badRequest("Write a reply to send", "MISSING_FIELDS");

  const notice = await withTransaction(async tx => {
    const result = await tx.query(
      `SELECT r.id, r.cr_no, r.title, r.status, r.project_id, r.client_id, r.requester_contact_id, p.name AS project_name
         FROM client_portal_change_requests r JOIN projects p ON p.id = r.project_id
        WHERE r.id = $1 AND r.client_id = $2 AND r.organization_team_id = $3
        FOR UPDATE OF r`,
      [id, subject.clientId, subject.teamId]
    );
    const request = result.rows[0];
    if (!request) throw notFound("Change request");
    await assertSubjectProject(tx, subject, request.project_id);
    // Someone else's request is not theirs to see or answer: the same 404 as a request that does not exist.
    if (request.requester_contact_id !== subject.contactId && subject.role !== "admin") throw notFound("Change request");
    if (["completed", "rejected", "cancelled"].includes(request.status)) {
      throw conflict("This request is closed. Submit a new change request instead.", "REQUEST_CLOSED");
    }

    await tx.query(
      `INSERT INTO client_portal_change_request_messages (change_request_id, from_side, author_contact_id, author_name, body)
       VALUES ($1, 'client', $2, $3, $4)`,
      [id, subject.contactId, subject.name, body]
    );
    // The same reply appears in the request's discussion thread.
    await mirrorChangeRequestMessage(tx, {
      teamId: subject.teamId,
      changeRequestId: id,
      projectId: request.project_id,
      clientId: request.client_id,
      side: "client",
      contactId: subject.contactId,
      authorName: subject.name,
      body,
    });

    const returnsToReview = request.status === "more_info";
    if (returnsToReview) {
      await tx.query(`UPDATE client_portal_change_requests SET status = 'under_review', updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [id]);
      await tx.query(
        `INSERT INTO client_portal_change_request_events (change_request_id, actor_side, actor_name, text)
         VALUES ($1, 'client', $2, 'Replied with more information. Back under review')`,
        [id, subject.name]
      );
      await recordAuditEvent(tx, {
        teamId: subject.teamId,
        event: "Change request status changed",
        actor: clientActor(subject),
        clientId: subject.clientId,
        projectId: request.project_id,
        targetType: "change_request",
        targetId: id,
        targetLabel: `${request.cr_no} · More Information Required → Under Review`,
        metadata: { from: "more_info", to: "under_review" },
      });
    }
    return { request, returnsToReview };
  });

  void notifyStaff({
    teamId: subject.teamId,
    kind: "Change Request",
    title: notice.returnsToReview ? `${notice.request.cr_no} is back under review` : `New reply on ${notice.request.cr_no}`,
    body: `${subject.name}: ${body.length > 140 ? `${body.slice(0, 137)}...` : body}`,
    url: `/worklenz/client-portal/change-requests/${id}`,
    projectId: notice.request.project_id,
    emailEvent: "change_request",
  });
}

// ─── Discussions ────────────────────────────────────────────────────────────

export interface ClientThreadAttachmentDto {
  id: string;
  /** The project file to download. Null once the file is no longer shared with the client. */
  file_id: string | null;
  name: string;
  /** File extension without the dot, lower case. */
  type: string;
  size: number;
}

export interface ClientThreadMessageReactionUserDto {
  id: string;
  name: string;
  side: "client" | "internal";
}

export interface ClientThreadMessageReactionDto {
  emoji: string;
  count: number;
  has_reacted: boolean;
  users: ClientThreadMessageReactionUserDto[];
}

export interface ClientThreadDto {
  id: string;
  /** Short reference to copy and search by, e.g. DS-000123. */
  ref_no: string;
  project_id: string;
  project_name: string;
  /** `ref_id` is the task, file, approval or change request the thread is about; null for the project's General thread. */
  context: { type: ThreadContextType; label: string; ref_id: string | null };
  messages: Array<{
    id: string;
    author: string;
    side: "client" | "internal";
    /** True for the signed-in person's own messages. */
    mine: boolean;
    /** `client_only` is read by the project's client users and never by the team. */
    visibility: "client" | "client_only";
    text: string;
    at: string;
    mentions: string[];
    attachments: ClientThreadAttachmentDto[];
    /** True once the sender changed the text after sending. */
    edited: boolean;
    /** A deleted message stays as a tombstone: no text, no attachments, so replies keep their quote. */
    deleted: boolean;
    /** The message this one replies to. */
    reply_to: { id: string; author: string; snippet: string; deleted: boolean } | null;
    reactions: ClientThreadMessageReactionDto[];
  }>;
  /** True while a client-visible message from someone else is newer than this person's last visit. */
  unread: boolean;
}

// A change request's discussion is the request's: only its requester and Client Admins see it.
const threadVisibleSql = (contactParam: string, roleParam: string) => `
  CASE th.context_type
    WHEN 'task'     THEN COALESCE(cts.visibility = 'client', FALSE)
    WHEN 'file'     THEN COALESCE(pf.portal_visibility = 'client' AND pf.status = 'active', FALSE)
    WHEN 'approval' THEN COALESCE(ap.status <> 'draft', FALSE)
    WHEN 'change_request' THEN COALESCE(${changeRequestVisibleSql("cr", contactParam, roleParam)}, FALSE)
    ELSE TRUE
  END
`;

/**
 * Threads the client can open: only those on their assigned, portal-enabled projects whose linked
 * item is itself visible. A thread about a task or file that was made Internal Only disappears from
 * the list on the next request, and opening it by link is a 404. Only client-visible messages are
 * returned; an internal comment never leaves the server.
 */
export async function listClientThreads(subject: ClientSubject, projectId?: string): Promise<ClientThreadDto[]> {
  const projectIds = await getSubjectProjectIds(db, subject);
  const scoped = projectId ? projectIds.filter(id => id === projectId) : projectIds;
  if (scoped.length === 0) return [];

  const threads = await db.query(
    `SELECT th.id, th.ref_no, th.project_id, p.name AS project_name, th.context_type,
            CASE th.context_type
              WHEN 'task'           THEN th.context_task_id
              WHEN 'file'           THEN th.context_file_id
              WHEN 'approval'       THEN th.context_approval_id
              WHEN 'change_request' THEN th.context_change_request_id
            END AS context_ref_id,
            EXISTS (
              SELECT 1 FROM client_portal_thread_messages um
               WHERE um.thread_id = th.id AND um.visibility IN ('client', 'client_only') AND um.deleted_at IS NULL
                 AND um.author_contact_id IS DISTINCT FROM $3::uuid
                 AND um.created_at > COALESCE(
                       (SELECT r.last_read_at FROM client_portal_thread_client_reads r
                         WHERE r.thread_id = th.id AND r.contact_id = $3::uuid), '-infinity'::timestamptz)
            ) AS unread,
            CASE th.context_type
              WHEN 'project'  THEN 'General'
              WHEN 'task'     THEN 'Task: ' || COALESCE(NULLIF(cts.client_title, ''), t.name)
              WHEN 'file'     THEN 'File: ' || pf.name
              WHEN 'approval' THEN 'Approval: ' || ap.ref_no
              WHEN 'change_request' THEN 'Change request: ' || cr.cr_no
            END AS context_label
       FROM client_portal_threads th
       JOIN projects p ON p.id = th.project_id
       LEFT JOIN tasks t ON t.id = th.context_task_id
       LEFT JOIN client_portal_task_settings cts ON cts.task_id = th.context_task_id
       LEFT JOIN project_files pf ON pf.id = th.context_file_id
       LEFT JOIN client_portal_approvals ap ON ap.id = th.context_approval_id
       LEFT JOIN client_portal_change_requests cr ON cr.id = th.context_change_request_id
      WHERE th.project_id = ANY($1::uuid[]) AND th.client_id = $2 AND (${threadVisibleSql("$3", "$4")})
      ORDER BY th.last_message_at DESC`,
    [scoped, subject.clientId, subject.contactId, subject.role]
  );
  if (threads.rows.length === 0) return [];

  const messages = await db.query(
    `SELECT m.id, m.thread_id, m.author_name, m.author_side, m.visibility, m.body, m.created_at,
            m.author_contact_id IS NOT DISTINCT FROM $2::uuid AS mine,
            m.edited_at IS NOT NULL AS edited, m.deleted_at IS NOT NULL AS deleted,
            pm.id AS parent_id, pm.author_name AS parent_author, pm.body AS parent_body,
            pm.deleted_at IS NOT NULL AS parent_deleted,
            COALESCE((SELECT array_agg(cc.name ORDER BY cc.name) FROM client_contacts cc WHERE cc.id = ANY(m.mentioned_contact_ids)), '{}') AS mention_names,
            -- A file that stopped being Client Visible keeps its name but has no link to download.
            COALESCE((SELECT json_agg(json_build_object('id', a.id,
                                                        'file_id', CASE WHEN ${fileClientVisibleSql("pf")} THEN pf.id END,
                                                        'name', a.file_name, 'type', a.file_type, 'size', a.size::float)
                                      ORDER BY a.created_at, a.id)
                        FROM client_portal_thread_message_attachments a
                        LEFT JOIN project_files pf ON pf.id = a.file_id
                       WHERE a.message_id = m.id), '[]'::json) AS attachments,
            COALESCE((
              SELECT json_agg(json_build_object(
                       'emoji', r_grp.emoji,
                       'count', r_grp.cnt,
                       'has_reacted', r_grp.has_reacted,
                       'users', r_grp.users
                     ) ORDER BY r_grp.cnt DESC, r_grp.first_at)
                FROM (
                  SELECT r.emoji,
                         COUNT(*)::int AS cnt,
                         BOOL_OR(r.contact_id IS NOT DISTINCT FROM $2::uuid) AS has_reacted,
                         MIN(r.created_at) AS first_at,
                         json_agg(json_build_object(
                           'id', COALESCE(r.contact_id, r.user_id),
                           'name', r.reactor_name,
                           'side', r.reactor_side
                         ) ORDER BY r.created_at) AS users
                    FROM client_portal_thread_message_reactions r
                   WHERE r.message_id = m.id
                   GROUP BY r.emoji
                ) r_grp
            ), '[]'::json) AS reactions
       FROM client_portal_thread_messages m
       LEFT JOIN client_portal_thread_messages pm
              ON pm.id = m.parent_message_id AND pm.thread_id = m.thread_id AND pm.visibility IN ('client', 'client_only')
      WHERE m.thread_id = ANY($1::uuid[]) AND m.visibility IN ('client', 'client_only')
      ORDER BY m.created_at, m.id`,
    [threads.rows.map(row => row.id), subject.contactId]
  );

  return threads.rows.map(row => ({
    id: row.id,
    ref_no: row.ref_no,
    project_id: row.project_id,
    project_name: row.project_name,
    context: { type: row.context_type, label: row.context_label, ref_id: row.context_ref_id ?? null },
    messages: messages.rows
      .filter(message => message.thread_id === row.id)
      .map(message => ({
        id: message.id,
        author: message.author_name,
        side: message.author_side,
        mine: message.mine === true,
        visibility: message.visibility === "client_only" ? "client_only" : "client",
        // Both sides write rich text that was sanitized when it was saved; the app sanitizes again on display.
        text: message.deleted ? "" : message.body,
        at: message.created_at,
        mentions: message.deleted ? [] : message.mention_names ?? [],
        attachments: message.deleted ? [] : message.attachments ?? [],
        edited: message.edited === true && message.deleted !== true,
        deleted: message.deleted === true,
        reply_to: message.parent_id ? replySnippet(message) : null,
        reactions: message.deleted ? [] : (message.reactions ?? []),
      })),
    unread: row.unread === true,
  }));
}

/** The quoted parent of a reply: a short plain-text snippet, or nothing once the parent was deleted. */
function replySnippet(row: { parent_id: string; parent_author: string; parent_body: string; parent_deleted: boolean }) {
  const plain = row.parent_deleted ? "" : htmlToPlainText(row.parent_body);
  return {
    id: row.parent_id,
    author: row.parent_author,
    snippet: plain.length > 140 ? `${plain.slice(0, 137)}...` : plain,
    deleted: row.parent_deleted === true,
  };
}

/** A list of uuids from a request body: absent is empty, anything else that is not a uuid list is a 400. */
function parseIdList(raw: unknown, message: string, code: string): string[] {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw) || raw.some(id => typeof id !== "string" || !UUID_PATTERN.test(id))) throw badRequest(message, code);
  return [...new Set(raw as string[])];
}

/**
 * The files a client message carries. Each must be a confirmed upload on this project by this same
 * person, not already attached to another message, and within the size limit.
 */
async function loadClientAttachments(
  tx: Queryable,
  subject: ClientSubject,
  projectId: string,
  ids: string[]
): Promise<Array<{ id: string; name: string; type: string; size: number }>> {
  if (ids.length === 0) return [];
  const result = await tx.query(
    `SELECT pf.id, pf.name, pf.type, pf.size::float AS size
       FROM project_files pf
      WHERE pf.id = ANY($1::uuid[]) AND pf.team_id = $2 AND pf.project_id = $3 AND pf.status = 'active'
        AND pf.uploaded_by_side = 'client' AND pf.uploaded_by_contact_id = $4
        AND NOT EXISTS (SELECT 1 FROM client_portal_thread_message_attachments a WHERE a.file_id = pf.id)`,
    [ids, subject.teamId, projectId, subject.contactId]
  );
  if (result.rows.length !== ids.length) {
    throw badRequest("One of the attached files could not be found. Upload it again.", "INVALID_ATTACHMENTS");
  }
  if (result.rows.some(row => row.size > THREAD_MAX_ATTACHMENT_BYTES)) {
    throw badRequest("Each attachment can be at most 100 MB", "ATTACHMENT_TOO_LARGE");
  }
  return result.rows.map(row => ({ id: row.id, name: row.name, type: String(row.type ?? "").toLowerCase(), size: row.size }));
}

/** Active users on a project the signed-in person can open, other than themselves: who `@` can suggest. */
export async function listClientMentionOptions(subject: ClientSubject, projectId: string): Promise<Array<{ id: string; name: string }>> {
  await assertSubjectProject(db, subject, projectId);
  const people = await activeProjectContacts(db, subject.teamId, subject.clientId, projectId);
  return people.filter(person => person.id !== subject.contactId);
}

/**
 * A client comment. A Client Admin or Member can comment; a Viewer cannot. Posting to a context
 * that has no thread yet (an approval, say) creates it. The comment is audited without its body and
 * raises an internal notification that opens the thread.
 */
export async function postClientComment(
  subject: ClientSubject,
  input: {
    thread_id?: string;
    project_id?: string;
    context?: ThreadContextRef;
    text?: string;
    /** `client_only` reaches the project's client users but not the team. Only on an existing discussion. */
    visibility?: unknown;
    /** Users mentioned with @. Each must be an active user on the project. */
    mention_ids?: unknown;
    /** Files this person already uploaded to the project (presign + confirm) for this message. */
    attachment_file_ids?: unknown;
    /** The message this one replies to. It must be in the same discussion and readable by this person. */
    parent_message_id?: unknown;
  }
): Promise<{ thread_id: string }> {
  requireCapability(subject, "comment");
  await assertUnderHourlyLimit(
    `SELECT COUNT(*)::int AS n FROM client_portal_thread_messages
      WHERE author_contact_id = $1 AND author_side = 'client' AND created_at > NOW() - INTERVAL '1 hour'`,
    [subject.contactId],
    CLIENT_HOURLY_LIMITS.comments,
    "posted"
  );
  if (input.visibility !== undefined && input.visibility !== "client" && input.visibility !== "client_only") {
    throw badRequest("Choose who can see this message", "INVALID_VISIBILITY");
  }
  let visibility: "client" | "client_only" = input.visibility === "client_only" ? "client_only" : "client";

  let parentMessageId: string | null = null;
  if (input.parent_message_id !== undefined && input.parent_message_id !== null) {
    if (typeof input.parent_message_id !== "string" || !UUID_PATTERN.test(input.parent_message_id)) {
      throw badRequest("Choose a message to reply to", "INVALID_REPLY");
    }
    if (!input.thread_id) throw badRequest("Choose a message to reply to", "INVALID_REPLY");
    const parent = await db.query(
      `SELECT m.visibility
         FROM client_portal_thread_messages m
         JOIN client_portal_threads th ON th.id = m.thread_id
        WHERE m.id = $1 AND m.thread_id = $2 AND th.client_id = $3 AND th.organization_team_id = $4
          AND m.visibility IN ('client', 'client_only') AND m.deleted_at IS NULL`,
      [input.parent_message_id, input.thread_id, subject.clientId, subject.teamId]
    );
    if (parent.rows.length === 0) throw notFound("Message");
    parentMessageId = input.parent_message_id;
    // A reply to a message the team can't read must not be readable by the team either.
    if (parent.rows[0].visibility === "client_only") visibility = "client_only";
  }
  if (visibility === "client_only" && !input.thread_id) {
    throw badRequest("Start a discussion with a message the team can see", "INVALID_VISIBILITY");
  }
  const mentionIds = parseIdList(input.mention_ids, "Choose who to mention from the list", "INVALID_MENTION");
  const attachmentIds = parseIdList(input.attachment_file_ids, "Attachments are invalid", "INVALID_ATTACHMENTS");
  if (attachmentIds.length > THREAD_MAX_ATTACHMENTS) {
    throw badRequest(`You can attach at most ${THREAD_MAX_ATTACHMENTS} files`, "TOO_MANY_ATTACHMENTS");
  }
  // A file lands in the project's Files, which the team can see, so a message the team may not read carries none.
  if (visibility === "client_only" && attachmentIds.length > 0) {
    throw badRequest("Files can't be attached to a message the team can't see", "INVALID_ATTACHMENTS");
  }
  // A message can be just files, so the text may be empty when something is attached.
  const text = cleanPortalRichText(input.text, 5000, "A comment");
  if (!text && attachmentIds.length === 0) throw badRequest("Write a comment to send", "MISSING_FIELDS");

  // A reply on a change request's thread is a reply on the request itself: it keeps the request's rules
  // (closed requests, returning to review) and writes to both the request and the thread.
  let changeRequestId: string | null = null;
  if (input.thread_id) {
    const linked = await db.query(
      `SELECT context_change_request_id FROM client_portal_threads WHERE id = $1 AND client_id = $2 AND organization_team_id = $3`,
      [input.thread_id, subject.clientId, subject.teamId]
    );
    changeRequestId = linked.rows[0]?.context_change_request_id ?? null;
  } else if (input.context?.type === "change_request") {
    changeRequestId = input.context.ref_id;
  }
  if (changeRequestId) {
    if (visibility === "client_only") throw badRequest("A change request reply is always visible to the team", "INVALID_VISIBILITY");
    if (attachmentIds.length > 0) throw badRequest("Files can't be attached to a change request reply", "INVALID_ATTACHMENTS");
    await replyToChangeRequest(subject, changeRequestId, text);
    const thread = await db.query(`SELECT id FROM client_portal_threads WHERE context_change_request_id = $1`, [changeRequestId]);
    return { thread_id: thread.rows[0].id as string };
  }

  const posted = await withTransaction(async tx => {
    let threadId = input.thread_id;
    let projectId: string;
    let contextLabel = "General";

    if (threadId) {
      const thread = await tx.query(
        `SELECT th.project_id, th.context_type FROM client_portal_threads th
          WHERE th.id = $1 AND th.client_id = $2 AND th.organization_team_id = $3`,
        [threadId, subject.clientId, subject.teamId]
      );
      if (thread.rows.length === 0) throw notFound("Discussion");
      projectId = thread.rows[0].project_id;
    } else {
      if (!input.project_id || !input.context) throw badRequest("Choose what you are commenting on", "MISSING_FIELDS");
      projectId = input.project_id;
      await assertSubjectProject(tx, subject, projectId);
      threadId = await ensureThread(tx, {
        teamId: subject.teamId,
        projectId,
        clientId: subject.clientId,
        context: input.context,
        contactId: subject.contactId,
      });
    }

    await assertSubjectProject(tx, subject, projectId);

    // The thread's linked item must still be visible to this client.
    const visible = await tx.query(
      `SELECT (${threadVisibleSql("$2", "$3")}) AS visible,
              CASE th.context_type
                WHEN 'project'  THEN 'General'
                WHEN 'task'     THEN 'Task: ' || COALESCE(NULLIF(cts.client_title, ''), t.name)
                WHEN 'file'     THEN 'File: ' || pf.name
                WHEN 'approval' THEN 'Approval: ' || ap.ref_no
                WHEN 'change_request' THEN 'Change request: ' || cr.cr_no
              END AS label
         FROM client_portal_threads th
         LEFT JOIN tasks t ON t.id = th.context_task_id
         LEFT JOIN client_portal_task_settings cts ON cts.task_id = th.context_task_id
         LEFT JOIN project_files pf ON pf.id = th.context_file_id
         LEFT JOIN client_portal_approvals ap ON ap.id = th.context_approval_id
         LEFT JOIN client_portal_change_requests cr ON cr.id = th.context_change_request_id
        WHERE th.id = $1`,
      [threadId, subject.contactId, subject.role]
    );
    if (visible.rows[0]?.visible !== true) throw notFound("Discussion");
    contextLabel = visible.rows[0].label;

    const files = await loadClientAttachments(tx, subject, projectId, attachmentIds);
    const mentioned =
      mentionIds.length > 0 ? await activeProjectContacts(tx, subject.teamId, subject.clientId, projectId, mentionIds) : [];
    if (mentioned.length !== mentionIds.length) {
      throw badRequest("You can only mention active users on this project", "INVALID_MENTION");
    }

    const inserted = await tx.query(
      `INSERT INTO client_portal_thread_messages
         (thread_id, visibility, author_side, author_contact_id, author_name, body, mentioned_contact_ids, parent_message_id)
       VALUES ($1, $6, 'client', $2, $3, $4, $5::uuid[], $7)
       RETURNING id`,
      [threadId, subject.contactId, subject.name, text || "<p></p>", mentioned.map(person => person.id), visibility, parentMessageId]
    );
    for (const file of files) {
      await tx.query(
        `INSERT INTO client_portal_thread_message_attachments (message_id, file_id, file_name, file_type, size)
         VALUES ($1, $2, $3, $4, $5)`,
        [inserted.rows[0].id, file.id, file.name, file.type, file.size]
      );
    }
    await tx.query(`UPDATE client_portal_threads SET last_message_at = NOW() WHERE id = $1`, [threadId]);

    const project = await getProjectRef(tx, subject.teamId, projectId);
    // The audit log is the team's: a message the team may not read leaves no entry there.
    if (visibility === "client") {
      await recordAuditEvent(tx, {
        teamId: subject.teamId,
        event: "Client comment created",
        actor: clientActor(subject),
        clientId: subject.clientId,
        clientName: project.clientName,
        projectId,
        targetType: "thread",
        targetId: threadId,
        // The label names where the comment was made; the comment itself is never stored in the log.
        targetLabel: contextLabel === "General" ? `${project.name} · General` : contextLabel,
      });
    }
    return { threadId: threadId as string, contextLabel, projectId, projectName: project.name, mentioned };
  });

  const preview = htmlToPlainText(text) || `Sent ${attachmentIds.length} attachment${attachmentIds.length === 1 ? "" : "s"}`;
  const preview140 = preview.length > 140 ? `${preview.slice(0, 137)}...` : preview;
  const mentionedOthers = posted.mentioned.filter(person => person.id !== subject.contactId);
  if (mentionedOthers.length > 0) {
    void notifyClientUsers({
      teamId: subject.teamId,
      clientId: subject.clientId,
      projectId: posted.projectId,
      type: "discussion",
      title: `${subject.name} mentioned you in ${posted.projectName}`,
      message: preview140,
      referenceId: posted.threadId,
      emailEvent: "comment_or_reply",
      portalPath: `/discussions?thread=${posted.threadId}`,
      onlyContactIds: mentionedOthers.map(person => person.id),
    });
  }

  // A message the team may not read never reaches the team, and tells the rest of the project instead.
  if (visibility === "client_only") {
    void notifyClientUsers({
      teamId: subject.teamId,
      clientId: subject.clientId,
      projectId: posted.projectId,
      type: "discussion",
      title: `${subject.name} sent a message in ${posted.projectName}`,
      message: preview140,
      referenceId: posted.threadId,
      emailEvent: "comment_or_reply",
      portalPath: `/discussions?thread=${posted.threadId}`,
    });
    return { thread_id: posted.threadId };
  }

  void notifyStaff({
    teamId: subject.teamId,
    kind: "Comment",
    title: `${subject.name} commented on ${posted.contextLabel === "General" ? "the project" : posted.contextLabel}`,
    body: preview140,
    url: `/worklenz/client-portal/discussions/${posted.threadId}`,
    projectId: posted.projectId,
    emailEvent: "client_comment",
  });

  return { thread_id: posted.threadId };
}

/**
 * The signed-in person's own message on a discussion they can open, or a 404/403. A message on a
 * change request's thread is mirrored into the request itself, so it is not editable here.
 */
async function loadOwnClientMessage(tx: Queryable, subject: ClientSubject, messageId: string) {
  if (!UUID_PATTERN.test(messageId)) throw notFound("Message");
  const found = await tx.query(
    `SELECT m.id, m.thread_id, m.author_contact_id, m.deleted_at, th.project_id, th.context_change_request_id,
            (SELECT COUNT(*) FROM client_portal_thread_message_attachments a WHERE a.message_id = m.id)::int AS attachment_count
       FROM client_portal_thread_messages m
       JOIN client_portal_threads th ON th.id = m.thread_id
      WHERE m.id = $1 AND th.client_id = $2 AND th.organization_team_id = $3 AND m.visibility IN ('client', 'client_only')`,
    [messageId, subject.clientId, subject.teamId]
  );
  const row = found.rows[0];
  if (!row || row.deleted_at) throw notFound("Message");
  await assertSubjectProject(tx, subject, row.project_id);
  if (row.author_contact_id !== subject.contactId) throw forbidden("You can only change your own messages", "NOT_MESSAGE_AUTHOR");
  if (row.context_change_request_id) {
    throw badRequest("A change request reply can't be changed", "MESSAGE_NOT_EDITABLE");
  }
  return row as { id: string; thread_id: string; project_id: string; attachment_count: number };
}

/** The sender rewrites the text of their own message. Visibility, attachments and the parent stay as sent. */
export async function editClientMessage(
  subject: ClientSubject,
  messageId: string,
  input: { text?: string; mention_ids?: unknown }
): Promise<{ thread_id: string }> {
  requireCapability(subject, "comment");
  const mentionIds = parseIdList(input.mention_ids, "Choose who to mention from the list", "INVALID_MENTION");
  const text = cleanPortalRichText(input.text, 5000, "A comment");

  return withTransaction(async tx => {
    const message = await loadOwnClientMessage(tx, subject, messageId);
    if (!text && message.attachment_count === 0) throw badRequest("Write a comment to send", "MISSING_FIELDS");
    const mentioned =
      mentionIds.length > 0 ? await activeProjectContacts(tx, subject.teamId, subject.clientId, message.project_id, mentionIds) : [];
    if (mentioned.length !== mentionIds.length) {
      throw badRequest("You can only mention active users on this project", "INVALID_MENTION");
    }
    await tx.query(
      `UPDATE client_portal_thread_messages
          SET body = $2, mentioned_contact_ids = $3::uuid[], edited_at = NOW()
        WHERE id = $1`,
      [message.id, text || "<p></p>", mentioned.map(person => person.id)]
    );
    return { thread_id: message.thread_id };
  });
}

/** The sender deletes their own message. It stays as a tombstone so replies keep their quoted parent. */
export async function deleteClientMessage(subject: ClientSubject, messageId: string): Promise<{ thread_id: string }> {
  requireCapability(subject, "comment");
  return withTransaction(async tx => {
    const message = await loadOwnClientMessage(tx, subject, messageId);
    await tx.query(`UPDATE client_portal_thread_messages SET deleted_at = NOW() WHERE id = $1`, [message.id]);
    return { thread_id: message.thread_id };
  });
}

// ─── Files ──────────────────────────────────────────────────────────────────

/**
 * Preview / download a shared file. Authorization is checked per request (organization, project
 * assignment, role and file visibility), never per link, and the URL it hands back lives only
 * CLIENT_DOWNLOAD_TTL_SECONDS. A reused URL after access removal is therefore denied. The action is
 * logged with the user, file and version; it does not notify staff, to avoid noise.
 */
export async function accessClientFile(
  subject: ClientSubject,
  input: { fileId: string; version?: number; action: "preview" | "download" }
): Promise<{ url: string; expires_in: number; name: string; version: number }> {
  requireCapability(subject, "view");

  const file = await db.query(
    `SELECT pf.id, pf.project_id, pf.current_version, COALESCE(pf.first_shared_version, 1) AS first_shared_version
       FROM project_files pf
      WHERE pf.id = $1 AND pf.team_id = $2 AND ${fileClientVisibleSql("pf")}`,
    [input.fileId, subject.teamId]
  );
  const row = file.rows[0];
  // Hidden, missing and not-yours are indistinguishable on purpose.
  if (!row) throw notFound("File");
  await assertSubjectProject(db, subject, row.project_id);

  const version = input.version ?? row.current_version;
  // Versions from before the file was shared (internal drafts) are not the client's to open: same 404 as a missing one.
  if (!Number.isInteger(version) || version < row.first_shared_version || version > row.current_version) throw notFound("File");

  const resolved = await resolveVersionObject(db, { teamId: subject.teamId, fileId: input.fileId, version });
  const url = await createPresignedUrlWithClient(resolved.key, resolved.name, CLIENT_DOWNLOAD_TTL_SECONDS);
  if (!url) throw new PortalError(500, "Could not create a link to this file", "DOWNLOAD_FAILED");

  const project = await getProjectRef(db, subject.teamId, row.project_id);
  await recordAuditEventSafely({
    teamId: subject.teamId,
    event: input.action === "preview" ? "Client file previewed" : "Client file downloaded",
    actor: clientActor(subject),
    clientId: subject.clientId,
    clientName: project.clientName,
    projectId: project.id,
    targetType: "file",
    targetId: input.fileId,
    targetLabel: `File: ${resolved.name} (v${version})`,
    metadata: { version },
  });

  return { url, expires_in: CLIENT_DOWNLOAD_TTL_SECONDS, name: resolved.name, version };
}

async function assertClientMayUpload(subject: ClientSubject, projectId: string): Promise<void> {
  requireCapability(subject, "upload");
  await assertSubjectProject(db, subject, projectId);
  const setting = await db.query(`SELECT allow_client_uploads FROM project_client_settings WHERE project_id = $1`, [projectId]);
  if (setting.rows[0]?.allow_client_uploads !== true) throw forbidden("Uploads are turned off for this project", "UPLOADS_OFF");
}

/** Step 1 of a client upload, where the role and the project allow it. */
export async function presignClientUpload(subject: ClientSubject, projectId: string, body: PresignInput) {
  await assertClientMayUpload(subject, projectId);
  await assertUnderHourlyLimit(
    `SELECT COUNT(*)::int AS n FROM project_files
      WHERE uploaded_by_contact_id = $1 AND created_at > NOW() - INTERVAL '1 hour'`,
    [subject.contactId],
    CLIENT_HOURLY_LIMITS.uploads,
    "uploads"
  );
  return presignPortalFile({
    teamId: subject.teamId,
    projectId,
    uploader: { side: "client", contactId: subject.contactId, name: subject.name },
    // A client upload is Client Visible so its author can see it; staff always see it regardless.
    body: { ...body, visibility: "client", category: body.category ?? "Supporting Document" },
  });
}

/** Step 2 of a client upload: audited as `Client file uploaded`, and staff are notified. */
export async function confirmClientUpload(subject: ClientSubject, projectId: string, fileId: string) {
  await assertClientMayUpload(subject, projectId);
  return confirmPortalFile({
    teamId: subject.teamId,
    projectId,
    fileId,
    uploader: { side: "client", contactId: subject.contactId, name: subject.name },
    actor: clientActor(subject),
  });
}


/**
 * Toggles an emoji reaction on a thread message by a client contact.
 * The message must belong to an accessible thread and must not be deleted.
 */
export async function toggleClientMessageReaction(
  subject: ClientSubject,
  messageId: string,
  rawEmoji: unknown
): Promise<ClientThreadMessageReactionDto[]> {
  requireCapability(subject, "comment");

  if (!messageId || typeof messageId !== "string" || !UUID_PATTERN.test(messageId)) {
    throw badRequest("Invalid message id", "INVALID_MESSAGE");
  }

  const emoji = typeof rawEmoji === "string" ? rawEmoji.trim() : "";
  if (!emoji || emoji.length > 32) {
    throw badRequest("Please choose a valid emoji", "INVALID_EMOJI");
  }

  const projectIds = await getSubjectProjectIds(db, subject);
  if (projectIds.length === 0) throw notFound("Message");

  const messageResult = await db.query(
    `SELECT m.id, m.thread_id, m.deleted_at
       FROM client_portal_thread_messages m
       JOIN client_portal_threads th ON th.id = m.thread_id
      WHERE m.id = $1
        AND m.visibility IN ('client', 'client_only')
        AND th.project_id = ANY($2::uuid[])
        AND th.client_id = $3
        AND (${threadVisibleSql("$4", "$5")})`,
    [messageId, projectIds, subject.clientId, subject.contactId, subject.role]
  );

  if (messageResult.rows.length === 0) {
    throw notFound("Message");
  }

  if (messageResult.rows[0].deleted_at) {
    throw badRequest("Cannot react to a deleted message", "MESSAGE_DELETED");
  }

  return withTransaction(async tx => {
    const existing = await tx.query(
      `SELECT id, emoji FROM client_portal_thread_message_reactions
        WHERE message_id = $1 AND contact_id = $2`,
      [messageId, subject.contactId]
    );

    if (existing.rows.length > 0) {
      const currentReaction = existing.rows[0];
      if (currentReaction.emoji === emoji) {
        // Same emoji: toggle off (remove reaction)
        await tx.query(
          `DELETE FROM client_portal_thread_message_reactions WHERE id = $1`,
          [currentReaction.id]
        );
      } else {
        // Different emoji: switch reaction (replace previous emoji)
        await tx.query(
          `UPDATE client_portal_thread_message_reactions
              SET emoji = $1, created_at = CURRENT_TIMESTAMP
            WHERE id = $2`,
          [emoji, currentReaction.id]
        );
      }
    } else {
      await tx.query(
        `INSERT INTO client_portal_thread_message_reactions
           (message_id, reactor_side, contact_id, reactor_name, emoji)
         VALUES ($1, 'client', $2, $3, $4)
         ON CONFLICT DO NOTHING`,
        [messageId, subject.contactId, subject.name, emoji]
      );
    }

    const updated = await tx.query(
      `SELECT COALESCE(json_agg(json_build_object(
                'emoji', r_grp.emoji,
                'count', r_grp.cnt,
                'has_reacted', r_grp.has_reacted,
                'users', r_grp.users
              ) ORDER BY r_grp.cnt DESC, r_grp.first_at), '[]'::json) AS reactions
         FROM (
           SELECT r.emoji,
                  COUNT(*)::int AS cnt,
                  BOOL_OR(r.contact_id IS NOT DISTINCT FROM $2::uuid) AS has_reacted,
                  MIN(r.created_at) AS first_at,
                  json_agg(json_build_object(
                    'id', COALESCE(r.contact_id, r.user_id),
                    'name', r.reactor_name,
                    'side', r.reactor_side
                  ) ORDER BY r.created_at) AS users
             FROM client_portal_thread_message_reactions r
            WHERE r.message_id = $1
            GROUP BY r.emoji
         ) r_grp`,
      [messageId, subject.contactId]
    );

    return updated.rows[0]?.reactions ?? [];
  });
}
