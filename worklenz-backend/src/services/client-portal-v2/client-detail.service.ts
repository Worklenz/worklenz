import db from "../../config/db";
import { withTransaction } from "../client-contacts-service";
import { recordAuditEvent } from "./audit.service";
import { listClientApprovals, listClientChangeRequests, requireCapability } from "./client-read.service";
import type { ClientApprovalDto, ClientChangeRequestDto } from "./client-read.service";
import { listClientThreads } from "./client-write.service";
import type { ClientThreadDto } from "./client-write.service";
import { conflict, forbidden, notFound } from "./errors";
import { notifyStaff } from "./notify.service";
import { assertSubjectProject } from "./scope";
import { ClientSubject } from "./subject";
import { Queryable } from "./types";

/**
 * Single-item reads and the actions that belong with them (spec #2520 gaps G2, G3, G6, G7).
 *
 * Every single read goes through the SAME list function the client app already uses and picks one out,
 * so the gating chain exists in exactly one place. A missing item, another organization's item, a draft
 * and an item on a project the person lost are therefore the identical 404: a deep link can never tell
 * a client whether something exists.
 */

// Internal working notes that sit in the same event tables but are not the client's to read.
const isClientApprovalEvent = (row: { actor_name: string; text: string }): boolean =>
  !(row.actor_name === "System" || row.text.startsWith("Draft created"));
const isClientRequestEvent = (row: { text: string }): boolean => !/work item/i.test(row.text);

export interface ClientApprovalDetailDto extends ClientApprovalDto {
  history: Array<{ at: string; actor: string; text: string }>;
  /** Free-form approvals only: what earlier revisions said, newest first. */
  earlier_revisions: Array<{ revision: number; description: string }>;
}

export async function getClientApproval(q: Queryable, subject: ClientSubject, approvalId: string): Promise<ClientApprovalDetailDto> {
  const approval = (await listClientApprovals(q, subject)).find(item => item.id === approvalId);
  if (!approval) throw notFound("Approval");

  const [events, revisions] = await Promise.all([
    q.query(
      `SELECT actor_name, text, created_at FROM client_portal_approval_events
        WHERE approval_id = $1 ORDER BY created_at, id`,
      [approvalId]
    ),
    approval.linked_item.type === "freeform"
      ? q.query(
          `SELECT revision, description_snapshot FROM client_portal_approval_revisions
            WHERE approval_id = $1 AND revision < $2 AND description_snapshot IS NOT NULL ORDER BY revision DESC`,
          [approvalId, approval.revision]
        )
      : Promise.resolve({ rows: [] as any[] }),
  ]);

  return {
    ...approval,
    history: events.rows
      .filter(isClientApprovalEvent)
      .map(row => ({ at: row.created_at, actor: row.actor_name, text: row.text })),
    earlier_revisions: revisions.rows.map(row => ({ revision: row.revision, description: row.description_snapshot })),
  };
}

export interface ClientChangeRequestDetailDto extends ClientChangeRequestDto {
  /** Attachments that can be opened through the file access link. */
  attachment_files: Array<{ id: string; name: string }>;
  thread: Array<{ from: "client" | "team"; author: string; text: string; at: string }>;
  timeline: Array<{ at: string; text: string }>;
  can_cancel: boolean;
}

/** Statuses from which a client may still withdraw a request. */
const CANCELLABLE = ["submitted", "under_review", "more_info"];

const mayCancel = (subject: ClientSubject, request: { status: string; requester_contact_id?: string | null }): boolean =>
  CANCELLABLE.includes(request.status) &&
  (request.requester_contact_id === subject.contactId || subject.role === "admin") &&
  subject.role !== "viewer";

export async function getClientChangeRequest(
  q: Queryable,
  subject: ClientSubject,
  requestId: string
): Promise<ClientChangeRequestDetailDto> {
  const request = (await listClientChangeRequests(q, subject)).find(item => item.id === requestId);
  if (!request) throw notFound("Change request");

  const [messages, events, files, owner] = await Promise.all([
    q.query(
      `SELECT from_side, author_name, body, created_at FROM client_portal_change_request_messages
        WHERE change_request_id = $1 ORDER BY created_at, id`,
      [requestId]
    ),
    q.query(
      `SELECT text, created_at FROM client_portal_change_request_events
        WHERE change_request_id = $1 ORDER BY created_at, id`,
      [requestId]
    ),
    q.query(
      `SELECT file_id, file_name FROM client_portal_change_request_attachments
        WHERE change_request_id = $1 AND file_id IS NOT NULL ORDER BY created_at`,
      [requestId]
    ),
    q.query(`SELECT requester_contact_id FROM client_portal_change_requests WHERE id = $1`, [requestId]),
  ]);

  return {
    ...request,
    attachment_files: files.rows.map(row => ({ id: row.file_id, name: row.file_name })),
    thread: messages.rows.map(row => ({ from: row.from_side, author: row.author_name, text: row.body, at: row.created_at })),
    timeline: events.rows.filter(isClientRequestEvent).map(row => ({ at: row.created_at, text: row.text })),
    can_cancel: mayCancel(subject, { status: request.status, requester_contact_id: owner.rows[0]?.requester_contact_id }),
  };
}

/**
 * Withdraws a change request. Only the person who submitted it or a Client Admin may, and only while it
 * is still open on the team's side (Submitted, Under Review, More Information Required). The history,
 * audit log and the team's notification record it; a closed request answers 409.
 */
export async function cancelClientChangeRequest(subject: ClientSubject, requestId: string): Promise<void> {
  requireCapability(subject, "submit_change_request");

  const request = await withTransaction(async tx => {
    const found = await tx.query(
      `SELECT r.id, r.cr_no, r.title, r.status, r.project_id, r.client_id, r.requester_contact_id,
              COALESCE(NULLIF(TRIM(c.company_name), ''), c.name) AS client_name
         FROM client_portal_change_requests r JOIN clients c ON c.id = r.client_id
        WHERE r.id = $1 AND r.client_id = $2 AND r.organization_team_id = $3
        FOR UPDATE OF r`,
      [requestId, subject.clientId, subject.teamId]
    );
    const row = found.rows[0];
    if (!row) throw notFound("Change request");
    await assertSubjectProject(tx, subject, row.project_id);

    if (!CANCELLABLE.includes(row.status)) {
      throw conflict("This request can no longer be cancelled.", "REQUEST_CLOSED");
    }
    if (row.requester_contact_id !== subject.contactId && subject.role !== "admin") {
      // Another contact's request is not visible to this person at all.
      throw notFound("Change request");
    }

    await tx.query(
      `UPDATE client_portal_change_requests
          SET status = 'cancelled', closed_at = NOW(), updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [requestId]
    );
    await tx.query(
      `INSERT INTO client_portal_change_request_events (change_request_id, actor_side, actor_name, text)
       VALUES ($1, 'client', $2, 'Cancelled the request')`,
      [requestId, subject.name]
    );
    await recordAuditEvent(tx, {
      teamId: subject.teamId,
      event: "Change request status changed",
      actor: { side: "client", name: subject.name, contactId: subject.contactId },
      clientId: subject.clientId,
      clientName: row.client_name,
      projectId: row.project_id,
      targetType: "change_request",
      targetId: requestId,
      targetLabel: `${row.cr_no} · ${row.status} → cancelled`,
      metadata: { from: row.status, to: "cancelled" },
    });
    return row;
  });

  void notifyStaff({
    teamId: subject.teamId,
    kind: "Change Request",
    title: `${request.cr_no} was cancelled`,
    body: `${subject.name} cancelled: ${request.title}`,
    url: `/worklenz/client-portal/change-requests/${requestId}`,
    projectId: request.project_id,
    emailEvent: "change_request",
  });
}

/** One discussion thread, or the same 404 whether it is missing, hidden or on a project the person lost. */
export async function getClientThread(subject: ClientSubject, threadId: string): Promise<ClientThreadDto> {
  const thread = (await listClientThreads(subject)).find(item => item.id === threadId);
  if (!thread) throw notFound("Discussion");
  return thread;
}

/**
 * Marks a thread read for this person (their own mark, not anyone else's). It is idempotent, and a
 * thread they cannot see is a 404 so the call can't be used to probe for threads.
 */
export async function markClientThreadRead(subject: ClientSubject, threadId: string): Promise<void> {
  await getClientThread(subject, threadId);
  await db.query(
    `INSERT INTO client_portal_thread_client_reads (thread_id, contact_id, last_read_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (thread_id, contact_id) DO UPDATE SET last_read_at = NOW()`,
    [threadId, subject.contactId]
  );
}
