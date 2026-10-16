import db from "../../config/db";
import { htmlToPlainText, sanitizeDiscussionHtml } from "../../shared/utils";
import { withTransaction } from "../client-contacts-service";
import { AuditActor, recordAuditEvent } from "./audit.service";
import { badRequest, conflict, notFound } from "./errors";
import { notifyClientUsers, notifyMentionedMembers } from "./notify.service";
import { getProjectRef } from "./project-core";
import { CONTACT_CAN_OPEN_PROJECT_SQL } from "./scope";
import { PortalSide, Queryable } from "./types";
import { USER_VIEW_SQL } from "./users.service";
import { containsPattern } from "./list-params";

/**
 * Discussions keep project communication attached to what it is about: the project in general, a
 * Client Visible task, a Client Visible file, or an approval. A thread mixes client-visible replies
 * and internal comments, strictly separated per message:
 *   - an internal comment is never returned by any client-facing API and never notifies a client
 *   - a client-user mention exists only on a client-visible message, and only for client users on the project
 *   - a team-member mention exists only on an internal comment, and only for members of the project
 *   - starting a thread always sends a client-visible first message
 *
 * "Hidden from the client" is derived, not stored: it is true when the linked task or file is
 * Internal Only (or the approval is a Draft), so switching the item back to Client Visible restores
 * the thread for the client.
 */

export type ThreadContextType = "project" | "task" | "file" | "approval" | "change_request";
export type MessageVisibility = "client" | "internal";

export interface ThreadAttachmentView {
  id: string;
  /** The project file staff download from. Null once the file was removed from the project. */
  file_id: string | null;
  name: string;
  /** File extension without the dot, lower case. */
  type: string;
  size: number;
}

export const THREAD_MAX_ATTACHMENTS = 5;
export const THREAD_MAX_ATTACHMENT_BYTES = 100 * 1024 * 1024;

export interface ThreadMessageView {
  id: string;
  author: string;
  side: PortalSide;
  visibility: MessageVisibility;
  text: string;
  at: string;
  mentions: string[];
  attachments: ThreadAttachmentView[];
  /** True for the signed-in staff member's own messages: only those can be edited or deleted. */
  mine: boolean;
  edited: boolean;
  /** A deleted message stays as a tombstone: no text, no attachments, so replies keep their quote. */
  deleted: boolean;
  reply_to: { id: string; author: string; snippet: string; deleted: boolean } | null;
}

export interface ThreadView {
  id: string;
  /** Short reference staff can copy and search by, e.g. DS-000123. */
  ref_no: string;
  organization_id: string;
  organization_name: string;
  project_id: string;
  project_name: string;
  context: { type: ThreadContextType; ref_id: string | null; label: string };
  unread: boolean;
  hidden_from_client: boolean;
  last_message: { text: string; visibility: MessageVisibility; at: string; attachment_count: number };
  messages: ThreadMessageView[];
}

// $1 = team id, $2 = staff user id (for per-user unread).
const THREAD_SELECT = `
  SELECT th.id, th.ref_no, th.ref_seq, th.client_id, th.project_id, th.context_type, th.created_at,
         COALESCE(th.context_task_id, th.context_file_id, th.context_approval_id, th.context_change_request_id) AS context_ref,
         p.name AS project_name,
         COALESCE(NULLIF(TRIM(c.company_name), ''), c.name) AS organization_name,
         CASE th.context_type
           WHEN 'project'  THEN 'General'
           WHEN 'task'     THEN 'Task: ' || COALESCE(NULLIF(cts.client_title, ''), t.name)
           WHEN 'file'     THEN 'File: ' || pf.name
           WHEN 'approval' THEN 'Approval: ' || ap.ref_no
           WHEN 'change_request' THEN 'Change request: ' || cr.cr_no
         END AS context_label,
         CASE th.context_type
           WHEN 'task'     THEN COALESCE(cts.visibility, 'internal') <> 'client'
           WHEN 'file'     THEN pf.portal_visibility <> 'client'
           WHEN 'approval' THEN ap.status = 'draft'
           ELSE FALSE
         END AS hidden_from_client,
         EXISTS (
           SELECT 1 FROM client_portal_thread_messages m
            WHERE m.thread_id = th.id AND m.author_side = 'client' AND m.visibility <> 'client_only' AND m.deleted_at IS NULL
              AND m.created_at > COALESCE(
                    (SELECT r.last_read_at FROM client_portal_thread_reads r
                      WHERE r.thread_id = th.id AND r.user_id = $2), '-infinity'::timestamptz)
         ) AS unread,
         lm.body AS last_text, lm.visibility AS last_visibility, lm.created_at AS last_at,
         lm.attachment_count AS last_attachment_count
    FROM client_portal_threads th
    JOIN projects p ON p.id = th.project_id
    JOIN clients c ON c.id = th.client_id
    LEFT JOIN tasks t ON t.id = th.context_task_id
    LEFT JOIN client_portal_task_settings cts ON cts.task_id = th.context_task_id
    LEFT JOIN project_files pf ON pf.id = th.context_file_id
    LEFT JOIN client_portal_approvals ap ON ap.id = th.context_approval_id
    LEFT JOIN client_portal_change_requests cr ON cr.id = th.context_change_request_id
    LEFT JOIN LATERAL (
      SELECT m.body, m.visibility, m.created_at,
             (SELECT COUNT(*)::int FROM client_portal_thread_message_attachments a WHERE a.message_id = m.id) AS attachment_count
        FROM client_portal_thread_messages m WHERE m.thread_id = th.id AND m.visibility <> 'client_only' AND m.deleted_at IS NULL ORDER BY m.created_at DESC LIMIT 1
    ) lm ON TRUE
   WHERE th.organization_team_id = $1
`;

function toView(row: any): ThreadView {
  return {
    id: row.id,
    ref_no: row.ref_no,
    organization_id: row.client_id,
    organization_name: row.organization_name,
    project_id: row.project_id,
    project_name: row.project_name,
    context: { type: row.context_type, ref_id: row.context_ref ?? null, label: row.context_label },
    unread: row.unread === true,
    hidden_from_client: row.hidden_from_client === true,
    last_message: { text: htmlToPlainText(row.last_text ?? ""), visibility: row.last_visibility ?? "client", at: row.last_at ?? row.created_at, attachment_count: row.last_attachment_count ?? 0 },
    messages: [],
  };
}

export interface ThreadsParams {
  project_id?: string;
  unread?: boolean | string;
  context_type?: string;
  search?: string;
  page?: number;
  limit?: number;
}

const THREAD_CONTEXT_TYPES = ["project", "task", "file", "approval", "change_request"];

/** Counts the threads that have unread client messages for this staff user (the sidebar badge). */
export async function countUnreadThreads(q: Queryable, teamId: string, userId: string): Promise<number> {
  const result = await q.query(
    `SELECT COUNT(*)::int AS n FROM (${THREAD_SELECT}) u WHERE u.unread`,
    [teamId, userId]
  );
  return result.rows[0]?.n ?? 0;
}

/** Threads of one client organization that have unread client messages for this staff user. */
export async function listUnreadThreadsForClient(
  q: Queryable,
  teamId: string,
  userId: string,
  clientId: string
): Promise<ThreadView[]> {
  const result = await q.query(
    `SELECT u.* FROM (${THREAD_SELECT}) u WHERE u.unread AND u.client_id = $3 ORDER BY u.last_at DESC NULLS LAST`,
    [teamId, userId, clientId]
  );
  return result.rows.map(toView);
}

export async function listThreads(teamId: string, userId: string, params: ThreadsParams) {
  const page = Math.max(Number(params.page) || 1, 1);
  const limit = Math.min(Math.max(Number(params.limit) || 30, 1), 100);
  const filters: string[] = [];
  const values: unknown[] = [teamId, userId];

  if (params.project_id) filters.push(`th.project_id = $${values.push(params.project_id)}`);
  if (params.context_type && THREAD_CONTEXT_TYPES.includes(params.context_type)) {
    filters.push(`th.context_type = $${values.push(params.context_type)}`);
  }
  const search = (params.search ?? "").trim();
  if (search) {
    const n = values.push(containsPattern(search));
    // A reference can be typed as DS-000123, DS-123 or just 123.
    const refNumber = /^(?:ds-?)?(\d{1,15})$/i.exec(search)?.[1];
    const refMatch = refNumber ? `th.ref_seq = $${values.push(refNumber)}::bigint OR ` : "";
    filters.push(`(${refMatch}th.ref_no ILIKE $${n} OR p.name ILIKE $${n}
      OR EXISTS (SELECT 1 FROM client_portal_thread_messages sm WHERE sm.thread_id = th.id AND sm.visibility <> 'client_only' AND sm.deleted_at IS NULL AND regexp_replace(sm.body, '<[^>]+>', ' ', 'g') ILIKE $${n})
      OR COALESCE(NULLIF(cts.client_title, ''), t.name, pf.name, ap.ref_no, cr.cr_no, 'General') ILIKE $${n})`);
  }
  const onlyUnread = params.unread === true || params.unread === "true";

  const where = filters.length ? `AND ${filters.join(" AND ")}` : "";
  const limitParam = values.push(limit);
  const offsetParam = values.push((page - 1) * limit);

  const rows = await db.query(
    `SELECT l.*, COUNT(*) OVER()::int AS total_count
       FROM (${THREAD_SELECT} ${where}) l
      ${onlyUnread ? "WHERE l.unread" : ""}
      ORDER BY l.last_at DESC NULLS LAST, l.id
      LIMIT $${limitParam} OFFSET $${offsetParam}`,
    values
  );

  return {
    items: rows.rows.map(toView),
    total: rows.rows[0]?.total_count ?? 0,
    page,
    limit,
  };
}

/** One thread with every message, both client-visible and internal, as staff see it. */
export async function getThread(q: Queryable, teamId: string, userId: string, threadId: string): Promise<ThreadView> {
  const result = await q.query(`${THREAD_SELECT} AND th.id = $3`, [teamId, userId, threadId]);
  if (result.rows.length === 0) throw notFound("Discussion");
  const view = toView(result.rows[0]);

  const messages = await q.query(
    `SELECT m.id, m.author_name, m.author_side, m.visibility, m.body, m.created_at, m.mentioned_contact_ids,
            m.author_user_id IS NOT DISTINCT FROM $2::uuid AS mine,
            m.edited_at IS NOT NULL AS edited, m.deleted_at IS NOT NULL AS deleted,
            pm.id AS parent_id, pm.author_name AS parent_author, pm.body AS parent_body,
            pm.deleted_at IS NOT NULL AS parent_deleted,
            COALESCE((SELECT array_agg(cc.name ORDER BY cc.name)
                        FROM client_contacts cc WHERE cc.id = ANY(m.mentioned_contact_ids)), '{}')
            || COALESCE((SELECT array_agg(u.name ORDER BY u.name)
                           FROM users u WHERE u.id = ANY(m.mentioned_user_ids)), '{}') AS mention_names,
            COALESCE((SELECT json_agg(json_build_object('id', a.id, 'file_id', pf.id, 'name', a.file_name,
                                                        'type', a.file_type, 'size', a.size::float)
                                      ORDER BY a.created_at, a.id)
                        FROM client_portal_thread_message_attachments a
                        LEFT JOIN project_files pf ON pf.id = a.file_id AND pf.status = 'active'
                       WHERE a.message_id = m.id), '[]'::json) AS attachments
       FROM client_portal_thread_messages m
       LEFT JOIN client_portal_thread_messages pm
              ON pm.id = m.parent_message_id AND pm.thread_id = m.thread_id AND pm.visibility <> 'client_only'
      WHERE m.thread_id = $1 AND m.visibility <> 'client_only'
      ORDER BY m.created_at, m.id`,
    [threadId, userId]
  );
  view.messages = messages.rows.map(row => ({
    id: row.id,
    author: row.author_name,
    side: row.author_side,
    visibility: row.visibility,
    text: row.deleted ? "" : row.body,
    at: row.created_at,
    mentions: row.deleted ? [] : row.mention_names ?? [],
    attachments: row.deleted ? [] : row.attachments ?? [],
    mine: row.mine === true,
    edited: row.edited === true && row.deleted !== true,
    deleted: row.deleted === true,
    reply_to: row.parent_id
      ? {
          id: row.parent_id,
          author: row.parent_author,
          snippet: row.parent_deleted ? "" : truncate(htmlToPlainText(row.parent_body), 140),
          deleted: row.parent_deleted === true,
        }
      : null,
  }));
  return view;
}

/** Opening a thread clears its unread flag for this staff user only. */
export async function markThreadRead(q: Queryable, teamId: string, userId: string, threadId: string): Promise<void> {
  const exists = await q.query(`SELECT 1 FROM client_portal_threads WHERE id = $1 AND organization_team_id = $2`, [
    threadId,
    teamId,
  ]);
  if (exists.rows.length === 0) throw notFound("Discussion");
  await q.query(
    `INSERT INTO client_portal_thread_reads (thread_id, user_id, last_read_at) VALUES ($1, $2, NOW())
     ON CONFLICT (thread_id, user_id) DO UPDATE SET last_read_at = NOW()`,
    [threadId, userId]
  );
}

export interface ContextOptions {
  tasks: Array<{ id: string; label: string }>;
  files: Array<{ id: string; label: string }>;
  approvals: Array<{ id: string; label: string }>;
}

/** What a client-visible discussion can be about: Client Visible tasks and files, and non-Draft approvals. */
export async function getContextOptions(q: Queryable, teamId: string, projectId: string): Promise<ContextOptions> {
  await getProjectRef(q, teamId, projectId);
  const [tasks, files, approvals] = await Promise.all([
    q.query(
      `SELECT t.id, (p.key || '-' || t.task_no::text) AS key, COALESCE(NULLIF(cts.client_title, ''), t.name) AS title
         FROM tasks t
         JOIN projects p ON p.id = t.project_id
         JOIN client_portal_task_settings cts ON cts.task_id = t.id AND cts.visibility = 'client'
        WHERE t.project_id = $1 AND t.archived IS FALSE ORDER BY t.task_no`,
      [projectId]
    ),
    q.query(
      `SELECT id, name FROM project_files
        WHERE project_id = $1 AND team_id = $2 AND status = 'active' AND portal_visibility = 'client' ORDER BY name`,
      [projectId, teamId]
    ),
    q.query(
      `SELECT id, ref_no, title FROM client_portal_approvals
        WHERE project_id = $1 AND organization_team_id = $2 AND status <> 'draft' ORDER BY ref_no DESC`,
      [projectId, teamId]
    ),
  ]);
  return {
    tasks: tasks.rows.map(row => ({ id: row.id, label: `${row.key} · ${row.title}` })),
    files: files.rows.map(row => ({ id: row.id, label: row.name })),
    approvals: approvals.rows.map(row => ({ id: row.id, label: `${row.ref_no} · ${row.title}` })),
  };
}

/** Active client users on the project: the people a client-visible message can mention and notify. */
export async function getMentionOptions(
  q: Queryable,
  teamId: string,
  projectId: string
): Promise<Array<{ id: string; name: string }>> {
  const project = await getProjectRef(q, teamId, projectId);
  if (!project.clientId) return [];
  const result = await q.query(
    `SELECT u.id, u.name
       FROM (${USER_VIEW_SQL}) u
      WHERE u.client_id = $2 AND u.status_key = 'active'
        AND ${CONTACT_CAN_OPEN_PROJECT_SQL("u.id", "$3")}
      ORDER BY u.name`,
    [teamId, project.clientId, projectId]
  );
  return result.rows.map(row => ({ id: row.id as string, name: row.name as string }));
}

/** Active members of the project: the staff an internal comment can mention. */
export async function getMemberMentionOptions(
  q: Queryable,
  teamId: string,
  projectId: string
): Promise<Array<{ id: string; name: string }>> {
  await getProjectRef(q, teamId, projectId);
  return activeProjectMembers(q, teamId, projectId);
}

/** Active project members as users (user id and name), optionally narrowed to given user ids. */
async function activeProjectMembers(
  q: Queryable,
  teamId: string,
  projectId: string,
  onlyIds?: string[]
): Promise<Array<{ id: string; name: string }>> {
  const result = await q.query(
    `SELECT DISTINCT u.id, u.name
       FROM project_members pm
       JOIN team_members tm ON tm.id = pm.team_member_id
       JOIN users u ON u.id = tm.user_id
      WHERE pm.project_id = $1 AND tm.team_id = $2
        AND tm.active IS TRUE AND u.is_deleted IS NOT TRUE
        AND ($3::uuid[] IS NULL OR u.id = ANY($3::uuid[]))
      ORDER BY u.name`,
    [projectId, teamId, onlyIds ?? null]
  );
  return result.rows.map(row => ({ id: row.id as string, name: row.name as string }));
}

export interface ThreadContextRef {
  type: ThreadContextType;
  ref_id: string | null;
}

/**
 * Finds or creates the one thread for a context. A task or file must be Client Visible and an
 * approval must not be a Draft: an Internal Only item cannot host a client-visible discussion.
 */
export async function ensureThread(
  tx: Queryable,
  input: { teamId: string; projectId: string; clientId: string; context: ThreadContextRef; userId?: string | null; contactId?: string | null }
): Promise<string> {
  const { teamId, projectId, clientId, context } = input;
  let taskId: string | null = null;
  let fileId: string | null = null;
  let approvalId: string | null = null;
  let changeRequestId: string | null = null;

  if (context.type === "task") {
    if (!context.ref_id) throw badRequest("Choose a task", "MISSING_FIELDS");
    const task = await tx.query(
      `SELECT t.id, COALESCE(cts.visibility, 'internal') AS visibility
         FROM tasks t LEFT JOIN client_portal_task_settings cts ON cts.task_id = t.id
        WHERE t.id = $1 AND t.project_id = $2`,
      [context.ref_id, projectId]
    );
    if (task.rows.length === 0) throw badRequest("That task is not in this project", "INVALID_CONTEXT");
    if (task.rows[0].visibility !== "client") {
      throw badRequest("An Internal Only task cannot host a client-visible discussion. Share it first.", "ITEM_NOT_SHARED");
    }
    taskId = context.ref_id;
  } else if (context.type === "file") {
    if (!context.ref_id) throw badRequest("Choose a file", "MISSING_FIELDS");
    const file = await tx.query(
      `SELECT portal_visibility FROM project_files WHERE id = $1 AND project_id = $2 AND team_id = $3 AND status = 'active'`,
      [context.ref_id, projectId, teamId]
    );
    if (file.rows.length === 0) throw badRequest("That file is not in this project", "INVALID_CONTEXT");
    if (file.rows[0].portal_visibility !== "client") {
      throw badRequest("An Internal Only file cannot host a client-visible discussion. Share it first.", "ITEM_NOT_SHARED");
    }
    fileId = context.ref_id;
  } else if (context.type === "approval") {
    if (!context.ref_id) throw badRequest("Choose an approval", "MISSING_FIELDS");
    const approval = await tx.query(
      `SELECT status FROM client_portal_approvals WHERE id = $1 AND project_id = $2 AND organization_team_id = $3`,
      [context.ref_id, projectId, teamId]
    );
    if (approval.rows.length === 0) throw badRequest("That approval is not in this project", "INVALID_CONTEXT");
    if (approval.rows[0].status === "draft") {
      throw badRequest("A draft approval cannot host a client-visible discussion", "ITEM_NOT_SHARED");
    }
    approvalId = context.ref_id;
  } else if (context.type === "change_request") {
    if (!context.ref_id) throw badRequest("Choose a change request", "MISSING_FIELDS");
    const request = await tx.query(
      `SELECT 1 FROM client_portal_change_requests WHERE id = $1 AND project_id = $2 AND client_id = $3 AND organization_team_id = $4`,
      [context.ref_id, projectId, clientId, teamId]
    );
    if (request.rows.length === 0) throw badRequest("That change request is not in this project", "INVALID_CONTEXT");
    changeRequestId = context.ref_id;
  } else if (context.type !== "project") {
    throw badRequest("Invalid discussion context", "INVALID_CONTEXT");
  }

  const existing = await tx.query(
    `SELECT id FROM client_portal_threads
      WHERE project_id = $1 AND context_type = $2
        AND context_task_id IS NOT DISTINCT FROM $3
        AND context_file_id IS NOT DISTINCT FROM $4
        AND context_approval_id IS NOT DISTINCT FROM $5
        AND context_change_request_id IS NOT DISTINCT FROM $6
      LIMIT 1`,
    [projectId, context.type, taskId, fileId, approvalId, changeRequestId]
  );
  if (existing.rows.length > 0) return existing.rows[0].id as string;

  const created = await tx.query(
    `INSERT INTO client_portal_threads
       (organization_team_id, client_id, project_id, context_type, context_task_id, context_file_id, context_approval_id,
        context_change_request_id, created_by_user_id, created_by_contact_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING id`,
    [teamId, clientId, projectId, context.type, taskId, fileId, approvalId, changeRequestId, input.userId ?? null, input.contactId ?? null]
  );
  return created.rows[0].id as string;
}

/**
 * Records a change request message in the request's discussion thread (created on first use), so the
 * conversation shows in Discussions as well as in the change request. A change request message is always
 * client-visible; a team message is the internal side of the thread.
 */
export async function mirrorChangeRequestMessage(
  tx: Queryable,
  input: {
    teamId: string;
    changeRequestId: string;
    projectId: string;
    clientId: string;
    side: "team" | "client";
    userId?: string | null;
    contactId?: string | null;
    authorName: string;
    body: string;
  }
): Promise<string> {
  const threadId = await ensureThread(tx, {
    teamId: input.teamId,
    projectId: input.projectId,
    clientId: input.clientId,
    context: { type: "change_request", ref_id: input.changeRequestId },
    userId: input.side === "team" ? input.userId : null,
    contactId: input.side === "client" ? input.contactId : null,
  });
  await tx.query(
    `INSERT INTO client_portal_thread_messages (thread_id, visibility, author_side, author_user_id, author_contact_id, author_name, body)
     VALUES ($1, 'client', $2, $3, $4, $5, $6)`,
    [
      threadId,
      input.side === "team" ? "internal" : "client",
      input.side === "team" ? (input.userId ?? null) : null,
      input.side === "client" ? (input.contactId ?? null) : null,
      input.authorName,
      input.body,
    ]
  );
  await tx.query(`UPDATE client_portal_threads SET last_message_at = NOW() WHERE id = $1`, [threadId]);
  return threadId;
}

/** Active client users on the project, optionally narrowed to given ids. */
export async function activeProjectContacts(
  q: Queryable,
  teamId: string,
  clientId: string,
  projectId: string,
  onlyIds?: string[]
): Promise<Array<{ id: string; name: string }>> {
  const result = await q.query(
    `SELECT u.id, u.name
       FROM (${USER_VIEW_SQL}) u
      WHERE u.client_id = $2 AND u.status_key = 'active'
        AND ${CONTACT_CAN_OPEN_PROJECT_SQL("u.id", "$3")}
        AND ($4::uuid[] IS NULL OR u.id = ANY($4::uuid[]))
      ORDER BY u.name`,
    [teamId, clientId, projectId, onlyIds ?? null]
  );
  return result.rows.map(row => ({ id: row.id as string, name: row.name as string }));
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface PostMessageInput {
  visibility?: string;
  text?: string;
  mention_ids?: string[];
  /** Project members (user ids) mentioned in an internal comment. Rejected on a client-visible message. */
  mention_user_ids?: string[];
  /**
   * Narrows who is notified to these client users (plus anyone mentioned). The thread stays readable
   * by every client user on the project. Empty or omitted notifies everyone on the project.
   */
  notify_contact_ids?: string[];
  /** Ids of project files this staff member already uploaded (presign + confirm) for this message. */
  attachment_file_ids?: string[];
}

const truncate = (value: string, max: number) => (value.length > max ? `${value.slice(0, max - 3)}...` : value);

/** Validates the shape and number of attached file ids before anything is read or written. */
function parseAttachmentIds(raw: unknown): string[] {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw) || raw.some(id => typeof id !== "string" || !UUID_PATTERN.test(id))) {
    throw badRequest("Attachments are invalid", "INVALID_ATTACHMENTS");
  }
  const ids = [...new Set(raw as string[])];
  if (ids.length > THREAD_MAX_ATTACHMENTS) {
    throw badRequest(`You can attach at most ${THREAD_MAX_ATTACHMENTS} files`, "TOO_MANY_ATTACHMENTS");
  }
  return ids;
}

/**
 * Reads the files being attached. Each must be a confirmed upload on this project by this same staff
 * member, not already attached to another message, and within the size limit.
 */
async function loadMessageAttachments(
  tx: Queryable,
  input: { teamId: string; userId: string; projectId: string; ids: string[] }
): Promise<Array<{ id: string; name: string; type: string; size: number }>> {
  if (input.ids.length === 0) return [];
  const result = await tx.query(
    `SELECT pf.id, pf.name, pf.type, pf.size::float AS size
       FROM project_files pf
      WHERE pf.id = ANY($1::uuid[]) AND pf.team_id = $2 AND pf.project_id = $3 AND pf.status = 'active'
        AND pf.uploaded_by_side = 'team' AND pf.uploaded_by = $4
        AND NOT EXISTS (SELECT 1 FROM client_portal_thread_message_attachments a WHERE a.file_id = pf.id)`,
    [input.ids, input.teamId, input.projectId, input.userId]
  );
  if (result.rows.length !== input.ids.length) {
    throw badRequest("One of the attached files could not be found. Upload it again.", "INVALID_ATTACHMENTS");
  }
  if (result.rows.some(row => row.size > THREAD_MAX_ATTACHMENT_BYTES)) {
    throw badRequest("Each attachment can be at most 100 MB", "ATTACHMENT_TOO_LARGE");
  }
  return result.rows.map(row => ({ id: row.id, name: row.name, type: String(row.type ?? "").toLowerCase(), size: row.size }));
}

/**
 * Posts a staff message. The composer states its audience: a client-visible message reaches the
 * client users on the project (and may mention some of them), an internal comment reaches no client
 * and cannot carry mentions. A client-visible message cannot be posted to a thread whose linked item
 * is Internal Only.
 */
export async function postStaffMessage(input: {
  teamId: string;
  userId: string;
  actor: AuditActor;
  threadId: string;
  body: PostMessageInput;
}) {
  const { teamId, threadId, body } = input;
  // The body is rich text. Sanitize first; the visible text is what is checked and previewed.
  const text = sanitizeDiscussionHtml((body.text ?? "").trim());
  const plainText = htmlToPlainText(text);
  const attachmentIds = parseAttachmentIds(body.attachment_file_ids);
  // A message can be just files, so the text may be empty when something is attached.
  if (!plainText && attachmentIds.length === 0) throw badRequest("Write a message to send", "MISSING_FIELDS");
  if (plainText.length > 5000) throw badRequest("A message can be at most 5000 characters");
  if (text.length > 30000) throw badRequest("This message is too large to send");
  if (body.visibility !== "client" && body.visibility !== "internal") throw badRequest("Choose who can see this message");
  const visibility = body.visibility as MessageVisibility;

  const mentionIds = Array.from(new Set(body.mention_ids ?? []));
  if (visibility === "internal" && mentionIds.length > 0) {
    throw badRequest("An internal comment cannot mention a client user", "MENTION_NOT_ALLOWED");
  }
  const mentionUserIds = Array.from(new Set(body.mention_user_ids ?? []));
  if (visibility === "client" && mentionUserIds.length > 0) {
    throw badRequest("A client-visible message cannot mention a team member", "MENTION_NOT_ALLOWED");
  }
  if (!mentionUserIds.every(id => UUID_PATTERN.test(id))) throw badRequest("Choose who to mention from the list", "INVALID_MENTION");
  const notifyIds = Array.from(new Set(body.notify_contact_ids ?? []));
  if (!notifyIds.every(id => UUID_PATTERN.test(id))) throw badRequest("Choose who to notify from the list", "INVALID_RECIPIENT");
  if (visibility === "internal" && notifyIds.length > 0) {
    throw badRequest("An internal comment cannot notify a client user", "NOTIFY_NOT_ALLOWED");
  }

  const result = await withTransaction(async tx => {
    const thread = await getThread(tx, teamId, input.userId, threadId);
    if (visibility === "client" && thread.hidden_from_client) {
      throw conflict(
        "The linked item is Internal Only, so the client cannot see this thread. Post an internal comment or share the item first.",
        "THREAD_HIDDEN"
      );
    }

    const files = await loadMessageAttachments(tx, {
      teamId,
      userId: input.userId,
      projectId: thread.project_id,
      ids: attachmentIds,
    });

    let mentioned: Array<{ id: string; name: string }> = [];
    if (mentionIds.length > 0) {
      mentioned = await activeProjectContacts(tx, teamId, thread.organization_id, thread.project_id, mentionIds);
      if (mentioned.length !== mentionIds.length) {
        throw badRequest("You can only mention active client users on this project", "INVALID_MENTION");
      }
    }

    let mentionedMembers: Array<{ id: string; name: string }> = [];
    if (mentionUserIds.length > 0) {
      mentionedMembers = await activeProjectMembers(tx, teamId, thread.project_id, mentionUserIds);
      if (mentionedMembers.length !== mentionUserIds.length) {
        throw badRequest("You can only mention active members of this project", "INVALID_MENTION");
      }
    }

    const inserted = await tx.query(
      `INSERT INTO client_portal_thread_messages
         (thread_id, visibility, author_side, author_user_id, author_name, body, mentioned_contact_ids, mentioned_user_ids)
       VALUES ($1, $2, 'internal', $3, $4, $5, $6::uuid[], $7::uuid[])
       RETURNING id, created_at`,
      [
        threadId,
        visibility,
        input.userId,
        input.actor.name,
        text || "<p></p>",
        mentioned.map(person => person.id),
        mentionedMembers.map(person => person.id),
      ]
    );
    await tx.query(`UPDATE client_portal_threads SET last_message_at = NOW() WHERE id = $1`, [threadId]);

    // A client-visible message on a change request's thread is also the team's response on the request.
    if (visibility === "client" && thread.context.type === "change_request" && thread.context.ref_id) {
      if (text.length > 5000) throw badRequest("A message on a change request can contain at most 5000 characters including formatting");
      await tx.query(
        `INSERT INTO client_portal_change_request_messages (change_request_id, from_side, author_user_id, author_name, body)
         VALUES ($1, 'team', $2, $3, $4)`,
        [thread.context.ref_id, input.userId, input.actor.name, text || "<p></p>"]
      );
      await tx.query(`UPDATE client_portal_change_requests SET response = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [
        thread.context.ref_id,
        text || "<p></p>",
      ]);
    }

    const attachments: ThreadAttachmentView[] = [];
    for (const file of files) {
      const row = await tx.query(
        `INSERT INTO client_portal_thread_message_attachments (message_id, file_id, file_name, file_type, size)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [inserted.rows[0].id, file.id, file.name, file.type, file.size]
      );
      attachments.push({ id: row.rows[0].id, file_id: file.id, name: file.name, type: file.type, size: file.size });
    }
    // Files are uploaded Internal Only. A client-visible message shares what it carries, and says so in
    // the audit log; an internal comment's files stay Internal Only.
    if (visibility === "client" && files.length > 0) {
      const shared = await tx.query(
        // Only the version that is attached (the current one) is shared, never the file's earlier drafts.
        `UPDATE project_files SET portal_visibility = 'client', first_shared_version = current_version
          WHERE id = ANY($1::uuid[]) AND portal_visibility <> 'client' RETURNING id, name`,
        [files.map(file => file.id)]
      );
      for (const file of shared.rows) {
        await recordAuditEvent(tx, {
          teamId,
          event: "Entity made Client Visible",
          actor: input.actor,
          clientId: thread.organization_id,
          projectId: thread.project_id,
          targetType: "file",
          targetId: file.id,
          targetLabel: `File: ${file.name}`,
        });
      }
    }

    // Who is notified: the chosen people and anyone mentioned, or everyone on the project when neither
    // is given. Every id must be an active client user on this project.
    const narrowedIds = Array.from(new Set([...notifyIds, ...mentioned.map(person => person.id)]));
    let audience: Array<{ id: string; name: string }> = [];
    if (visibility === "client") {
      audience = await activeProjectContacts(
        tx,
        teamId,
        thread.organization_id,
        thread.project_id,
        narrowedIds.length > 0 ? narrowedIds : undefined
      );
      if (narrowedIds.length > 0 && audience.length !== narrowedIds.length) {
        throw badRequest("You can only notify active client users on this project", "INVALID_RECIPIENT");
      }
    }

    return {
      thread,
      messageId: inserted.rows[0].id as string,
      createdAt: inserted.rows[0].created_at as string,
      mentioned,
      mentionedMembers,
      audience,
      attachments,
      isNarrowed: narrowedIds.length > 0,
    };
  });

  // Never the author, and a failure here must not undo the message.
  const membersToNotify = result.mentionedMembers.filter(person => person.id !== input.userId);
  if (membersToNotify.length > 0) {
    void notifyMentionedMembers({
      teamId,
      projectId: result.thread.project_id,
      threadId,
      authorName: input.actor.name,
      projectName: result.thread.project_name,
      text: plainText,
      userIds: membersToNotify.map(person => person.id),
    });
  }

  if (visibility === "client" && result.audience.length > 0) {
    void notifyClientUsers({
      teamId,
      clientId: result.thread.organization_id,
      projectId: result.thread.project_id,
      type: "discussion",
      title: `New message in ${result.thread.project_name}`,
      message: !plainText
        ? `Sent ${result.attachments.length} attachment${result.attachments.length === 1 ? "" : "s"}`
        : plainText.length > 140
          ? `${plainText.slice(0, 137)}...`
          : plainText,
      referenceId: threadId,
      emailEvent: "comment_or_reply",
      portalPath: `/discussions/${threadId}`,
      ...(result.isNarrowed ? { onlyContactIds: result.audience.map(person => person.id) } : {}),
    });
  }

  return {
    message: {
      id: result.messageId,
      author: input.actor.name,
      side: "internal" as const,
      visibility,
      text,
      at: result.createdAt,
      mentions: [...result.mentioned, ...result.mentionedMembers].map(person => person.name),
      attachments: result.attachments,
      mine: true,
      edited: false,
      deleted: false,
      reply_to: null,
    },
    // Names of the client users who will be notified. Empty for an internal comment.
    notified: result.audience.map(person => person.name),
  };
}


export interface StartThreadInput {
  project_id?: string;
  context?: { type?: string; ref_id?: string | null };
  message?: string;
  /** Narrows who is notified of the first message. Omitted or empty notifies everyone on the project. */
  notify_contact_ids?: string[];
  /** Files the first message carries (already uploaded to the project). */
  attachment_file_ids?: string[];
}

/** Starts a discussion (or adds to the existing one for that context). The first message is always client-visible. */
export async function startThread(input: {
  teamId: string;
  userId: string;
  actor: AuditActor;
  body: StartThreadInput;
}): Promise<ThreadView> {
  const { teamId, body } = input;
  if (!body.project_id || !body.context?.type) throw badRequest("Choose a project and what it is about", "MISSING_FIELDS");

  const project = await getProjectRef(db, teamId, body.project_id);
  if (!project.clientId) throw badRequest("This project is not linked to a client", "PROJECT_HAS_NO_CLIENT");
  const portal = await db.query(`SELECT portal_enabled FROM project_client_settings WHERE project_id = $1`, [project.id]);
  if (portal.rows[0]?.portal_enabled !== true) {
    throw badRequest("Only a project with the Client Portal on can have a discussion", "PORTAL_OFF");
  }

  // Check the recipients before a thread is created, so a bad choice leaves nothing behind.
  const recipientIds = Array.from(new Set(body.notify_contact_ids ?? []));
  if (recipientIds.length > 0) {
    const valid = recipientIds.every(id => UUID_PATTERN.test(id))
      ? await activeProjectContacts(db, teamId, project.clientId, project.id, recipientIds)
      : [];
    if (valid.length !== recipientIds.length) {
      throw badRequest("You can only notify active client users on this project", "INVALID_RECIPIENT");
    }
  }

  const threadId = await withTransaction(async tx =>
    ensureThread(tx, {
      teamId,
      projectId: project.id,
      clientId: project.clientId as string,
      context: { type: body.context!.type as ThreadContextType, ref_id: body.context!.ref_id ?? null },
      userId: input.userId,
    })
  );

  await postStaffMessage({
    teamId,
    userId: input.userId,
    actor: input.actor,
    threadId,
    body: {
      visibility: "client",
      text: body.message,
      notify_contact_ids: body.notify_contact_ids,
      attachment_file_ids: body.attachment_file_ids,
    },
  });

  return getThread(db, teamId, input.userId, threadId);
}
