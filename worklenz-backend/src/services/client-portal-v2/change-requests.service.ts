import db from "../../config/db";
import { withTransaction } from "../client-contacts-service";
import { AuditActor, recordAuditEvent } from "./audit.service";
import { mirrorChangeRequestMessage } from "./discussions.service";
import { badRequest, conflict, notFound } from "./errors";
import { cleanPortalRichText } from "./rich-text";
import { notifyClientUsers } from "./notify.service";
import { findStaff, StaffRef, toStaffRef } from "./staff";
import { PortalSide, Queryable } from "./types";
import { containsPattern } from "./list-params";

/**
 * Change requests: formal scope changes a client asks for inside a project. Staff review, ask for
 * more information, estimate, approve or reject, convert an approved request to project work, and
 * mark it complete. SUBMITTING NEVER CREATES A TASK (spec section 12).
 *
 * Lifecycle (status only ever moves through the explicit actions below, never an inline dropdown):
 *   submitted -> under_review -> approved | rejected | more_info
 *   more_info -> under_review (when the client replies, or staff return it to review)
 *   approved -> in_progress (convert to work) -> completed
 *   any non-terminal -> cancelled
 *
 * Terminal states (completed, rejected, cancelled) are read-only except for linking billing documents.
 * The client payload contains only: reference, title, description, notes, attachments, priority,
 * status, submitted date, requester, the response thread, the estimate and the progress timeline.
 * The assignee and the internal assessment never reach a client.
 */

export const CHANGE_REQUEST_STATUSES = [
  "submitted",
  "under_review",
  "more_info",
  "approved",
  "rejected",
  "in_progress",
  "completed",
  "cancelled",
] as const;
export type ChangeRequestStatus = (typeof CHANGE_REQUEST_STATUSES)[number];

export const CHANGE_REQUEST_PRIORITIES = ["low", "medium", "high"] as const;
export type ChangeRequestPriority = (typeof CHANGE_REQUEST_PRIORITIES)[number];

export const TERMINAL_STATUSES: readonly ChangeRequestStatus[] = ["completed", "rejected", "cancelled"];
/** Statuses a quote or invoice can be started from. */
export const BILLABLE_STATUSES: readonly ChangeRequestStatus[] = ["approved", "in_progress", "completed"];

const STATUS_LABEL: Record<ChangeRequestStatus, string> = {
  submitted: "Submitted",
  under_review: "Under Review",
  more_info: "More Information Required",
  approved: "Approved",
  rejected: "Rejected",
  in_progress: "In Progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

export interface ChangeRequestEstimate {
  hours: number | null;
  cost: number | null;
}

/** `file_id` is null once the project file behind it was removed; the name and size stay as a record. */
export interface ChangeRequestAttachmentView {
  id: string;
  file_id: string | null;
  name: string;
  size: number;
}

export interface ChangeRequestView {
  id: string;
  cr_no: string;
  organization_id: string;
  organization_name: string;
  project_id: string;
  project_name: string;
  project_color: string | null;
  title: string;
  description: string;
  notes: string;
  attachments: ChangeRequestAttachmentView[];
  priority: ChangeRequestPriority;
  requester_id: string;
  requester_name: string;
  submitted_at: string;
  updated_at: string;
  status: ChangeRequestStatus;
  assignee: StaffRef | null;
  estimate: ChangeRequestEstimate | null;
  response: string;
  internal_assessment: string;
  linked_work: { task_id: string; task_key: string; mode: "created" | "linked" } | null;
  messages: Array<{ id: string; from: "client" | "team"; author: string; text: string; at: string }>;
  history: Array<{ at: string; actor: string; side: PortalSide; text: string }>;
  billing: { quotes: string[]; invoices: string[] };
}

// $1 = team id.
const CR_SELECT = `
  SELECT r.id, r.cr_no, r.client_id, r.project_id, r.title, r.description, r.notes, r.priority,
         r.requester_contact_id, r.requester_name, r.submitted_at, r.updated_at, r.status,
         r.assignee_team_member_id, au.name AS assignee_name,
         r.estimate_hours::float AS estimate_hours, r.estimate_cost::float AS estimate_cost,
         r.response, r.internal_assessment, r.linked_task_id, r.linked_task_key, r.linked_task_mode,
         p.name AS project_name, p.color_code AS project_color,
         COALESCE(NULLIF(TRIM(c.company_name), ''), c.name) AS organization_name,
         COALESCE((SELECT json_agg(json_build_object('id', a.id, 'file_id', a.file_id, 'name', a.file_name, 'size', a.size)
                                   ORDER BY a.created_at)
                     FROM client_portal_change_request_attachments a WHERE a.change_request_id = r.id), '[]'::json) AS attachments,
         (SELECT COUNT(*)::int FROM client_portal_change_request_attachments a WHERE a.change_request_id = r.id) AS attachment_count
    FROM client_portal_change_requests r
    JOIN projects p ON p.id = r.project_id
    JOIN clients c ON c.id = r.client_id
    LEFT JOIN team_members atm ON atm.id = r.assignee_team_member_id
    LEFT JOIN users au ON au.id = atm.user_id
   WHERE r.organization_team_id = $1
`;

function toView(row: any): ChangeRequestView {
  const hasEstimate = row.estimate_hours != null || row.estimate_cost != null;
  return {
    id: row.id,
    cr_no: row.cr_no,
    organization_id: row.client_id,
    organization_name: row.organization_name,
    project_id: row.project_id,
    project_name: row.project_name,
    project_color: row.project_color ?? null,
    title: row.title,
    description: row.description,
    notes: row.notes,
    attachments: row.attachments ?? [],
    priority: row.priority,
    requester_id: row.requester_contact_id,
    requester_name: row.requester_name,
    submitted_at: row.submitted_at,
    updated_at: row.updated_at,
    status: row.status,
    assignee: row.assignee_team_member_id ? toStaffRef(row.assignee_team_member_id, row.assignee_name) : null,
    // A blank stays blank: the estimate is null unless staff entered something, and a zero is shown
    // only when staff entered zero.
    estimate: hasEstimate ? { hours: row.estimate_hours ?? null, cost: row.estimate_cost ?? null } : null,
    response: row.response,
    internal_assessment: row.internal_assessment,
    linked_work: row.linked_task_id
      ? { task_id: row.linked_task_id, task_key: row.linked_task_key, mode: row.linked_task_mode }
      : row.linked_task_key
        ? { task_id: "", task_key: row.linked_task_key, mode: row.linked_task_mode }
        : null,
    messages: [],
    history: [],
    billing: { quotes: [], invoices: [] },
  };
}

export interface ChangeRequestsParams {
  status?: string;
  organization_id?: string;
  priority?: string;
  search?: string;
  /** A key of CHANGE_REQUEST_SORTS. */
  sort?: string;
  order?: string;
  page?: number;
  limit?: number;
}

// Whitelist of sortable columns; the keys are the table column keys the admin UI sends.
const CHANGE_REQUEST_SORTS: Record<string, string> = {
  ref: "l.cr_no",
  request: "LOWER(l.title)",
  project: "LOWER(l.project_name)",
  requestedBy: "LOWER(l.requester_name)",
  client: "LOWER(l.organization_name)",
  priority: "CASE l.priority WHEN 'high' THEN 3 WHEN 'medium' THEN 2 ELSE 1 END",
  submitted: "l.submitted_at",
  updated: "l.updated_at",
  status: "l.status",
  assignee: "LOWER(l.assignee_name)",
  estimateTime: "l.estimate_hours",
  estimateCost: "l.estimate_cost",
  attachments: "l.attachment_count",
};

export async function getChangeRequestStats(q: Queryable, teamId: string) {
  const result = await q.query(
    `SELECT COUNT(*) FILTER (WHERE status IN ('submitted', 'under_review'))::int AS needs_review,
            COUNT(*) FILTER (WHERE status = 'more_info')::int AS waiting_on_client,
            COUNT(*) FILTER (WHERE status IN ('approved', 'in_progress'))::int AS approved_or_in_progress,
            COUNT(*) FILTER (WHERE status = 'completed')::int AS completed
       FROM client_portal_change_requests WHERE organization_team_id = $1`,
    [teamId]
  );
  const row = result.rows[0] ?? {};
  return {
    needs_review: row.needs_review ?? 0,
    waiting_on_client: row.waiting_on_client ?? 0,
    approved_or_in_progress: row.approved_or_in_progress ?? 0,
    completed: row.completed ?? 0,
  };
}

const splitList = (value?: string): string[] =>
  (value ?? "")
    .split(",")
    .map(item => item.trim())
    .filter(Boolean);

export async function listChangeRequests(teamId: string, params: ChangeRequestsParams) {
  const page = Math.max(Number(params.page) || 1, 1);
  const limit = Math.min(Math.max(Number(params.limit) || 10, 1), 100);
  const filters: string[] = [];
  const values: unknown[] = [teamId];

  // Every filter accepts a comma-separated list, so the admin UI can select several at once.
  const statuses = splitList(params.status);
  if (statuses.length) {
    if (statuses.some(s => !(CHANGE_REQUEST_STATUSES as readonly string[]).includes(s))) throw badRequest("Invalid status filter");
    filters.push(`r.status = ANY($${values.push(statuses)}::text[])`);
  }
  const priorities = splitList(params.priority);
  if (priorities.length) {
    if (priorities.some(p => !(CHANGE_REQUEST_PRIORITIES as readonly string[]).includes(p))) throw badRequest("Invalid priority filter");
    filters.push(`r.priority = ANY($${values.push(priorities)}::text[])`);
  }
  const clientIds = splitList(params.organization_id);
  if (clientIds.length) filters.push(`r.client_id = ANY($${values.push(clientIds)}::uuid[])`);
  const search = (params.search ?? "").trim();
  if (search) {
    const n = values.push(containsPattern(search));
    filters.push(
      `(r.cr_no ILIKE $${n} OR r.title ILIKE $${n} OR r.requester_name ILIKE $${n} OR r.description ILIKE $${n} OR r.notes ILIKE $${n}
        OR r.linked_task_key ILIKE $${n} OR p.name ILIKE $${n} OR c.name ILIKE $${n} OR c.company_name ILIKE $${n}
        OR au.name ILIKE $${n})`
    );
  }

  const where = filters.length ? `AND ${filters.join(" AND ")}` : "";
  const limitParam = values.push(limit);
  const offsetParam = values.push((page - 1) * limit);

  const sortSql = params.sort ? CHANGE_REQUEST_SORTS[params.sort] : undefined;
  if (params.sort && !sortSql) throw badRequest("Invalid sort column");
  const direction = params.order === "desc" ? "DESC" : "ASC";
  const orderBy = sortSql ? `${sortSql} ${direction} NULLS LAST, l.submitted_at DESC, l.id` : "l.submitted_at DESC, l.id";

  const rows = await db.query(
    `SELECT l.*, COUNT(*) OVER()::int AS total_count
       FROM (${CR_SELECT} ${where}) l
      ORDER BY ${orderBy}
      LIMIT $${limitParam} OFFSET $${offsetParam}`,
    values
  );

  return {
    items: rows.rows.map(toView),
    total: rows.rows[0]?.total_count ?? 0,
    page,
    limit,
    stats: await getChangeRequestStats(db, teamId),
  };
}

/** One change request with its conversation, history timeline and linked quotes / invoices. */
export async function getChangeRequest(q: Queryable, teamId: string, id: string): Promise<ChangeRequestView> {
  const result = await q.query(`${CR_SELECT} AND r.id = $2`, [teamId, id]);
  if (result.rows.length === 0) throw notFound("Change request");
  const view = toView(result.rows[0]);

  const [messages, events, quotes, invoices] = await Promise.all([
    q.query(
      `SELECT id, from_side, author_name, body, created_at
         FROM client_portal_change_request_messages WHERE change_request_id = $1 ORDER BY created_at, id`,
      [id]
    ),
    q.query(
      `SELECT actor_name, actor_side, text, created_at
         FROM client_portal_change_request_events WHERE change_request_id = $1 ORDER BY created_at, id`,
      [id]
    ),
    q.query(`SELECT quote_no FROM client_portal_quotes WHERE change_request_id = $1 ORDER BY created_at`, [id]),
    q.query(
      `SELECT invoice_no FROM client_portal_invoices WHERE change_request_id = $1 AND deleted_at IS NULL ORDER BY created_at`,
      [id]
    ),
  ]);

  view.messages = messages.rows.map(row => ({
    id: row.id,
    from: row.from_side,
    author: row.author_name,
    text: row.body,
    at: row.created_at,
  }));
  view.history = events.rows.map(row => ({
    at: row.created_at,
    actor: row.actor_name,
    side: row.actor_side,
    text: row.text,
  }));
  view.billing = {
    quotes: quotes.rows.map(row => row.quote_no as string),
    invoices: invoices.rows.map(row => row.invoice_no as string),
  };
  return view;
}

async function lockRequest(tx: Queryable, teamId: string, id: string): Promise<any> {
  const result = await tx.query(
    `SELECT r.*, COALESCE(NULLIF(TRIM(c.company_name), ''), c.name) AS client_name, p.name AS project_name, p.key AS project_key
       FROM client_portal_change_requests r
       JOIN clients c ON c.id = r.client_id
       JOIN projects p ON p.id = r.project_id
      WHERE r.id = $1 AND r.organization_team_id = $2
      FOR UPDATE OF r`,
    [id, teamId]
  );
  if (result.rows.length === 0) throw notFound("Change request");
  return result.rows[0];
}

async function addEvent(tx: Queryable, id: string, side: PortalSide, actor: string, text: string) {
  await tx.query(
    `INSERT INTO client_portal_change_request_events (change_request_id, actor_side, actor_name, text)
     VALUES ($1, $2, $3, $4)`,
    [id, side, actor, text]
  );
}

async function addTeamMessage(
  tx: Queryable,
  request: { id: string; organization_team_id: string; project_id: string; client_id: string },
  userId: string,
  name: string,
  text: string
) {
  const id = request.id;
  await tx.query(
    `INSERT INTO client_portal_change_request_messages (change_request_id, from_side, author_user_id, author_name, body)
     VALUES ($1, 'team', $2, $3, $4)`,
    [id, userId, name, text]
  );
  await tx.query(`UPDATE client_portal_change_requests SET response = $2 WHERE id = $1`, [id, text]);
  // The same message appears in the request's discussion thread.
  await mirrorChangeRequestMessage(tx, {
    teamId: request.organization_team_id,
    changeRequestId: id,
    projectId: request.project_id,
    clientId: request.client_id,
    side: "team",
    userId,
    authorName: name,
    body: text,
  });
}

const formatEstimate = (hours: number | null, cost: number | null): string => {
  const parts: string[] = [];
  if (hours != null) parts.push(`${hours} hours`);
  if (cost != null) parts.push(`$${cost.toLocaleString("en-US")}`);
  return parts.join(" / ");
};

export type ChangeRequestAction =
  | { action: "start_review" }
  | { action: "approve"; response?: string; estimate?: { hours?: number | null; cost?: number | null } }
  | { action: "ask_more_info"; response: string }
  | { action: "reject"; response: string }
  | { action: "return_to_review" }
  | { action: "complete"; response?: string }
  | { action: "cancel" }
  | { action: "send_response"; response: string };

/** Which actions are allowed from each status. Terminal states allow none. */
const ALLOWED_ACTIONS: Record<ChangeRequestStatus, string[]> = {
  submitted: ["start_review", "cancel", "send_response"],
  under_review: ["approve", "ask_more_info", "reject", "cancel", "send_response"],
  more_info: ["return_to_review", "cancel", "send_response"],
  approved: ["cancel", "send_response"],
  in_progress: ["complete", "cancel", "send_response"],
  rejected: [],
  completed: [],
  cancelled: [],
};

const parseAmount = (value: unknown, label: string): number | null => {
  if (value === undefined || value === null || value === "") return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) throw badRequest(`${label} must be zero or more`);
  return number;
};

/**
 * Moves a request through one explicit action. Ask-for-more-info and Reject require a written
 * response. Every status change writes an audit event and, where it concerns the client, notifies the
 * requester.
 */
export async function applyChangeRequestAction(input: {
  teamId: string;
  id: string;
  userId: string;
  actorMemberId?: string | null;
  actor: AuditActor;
  body: ChangeRequestAction;
}): Promise<ChangeRequestView> {
  const { teamId, id, actor, body } = input;

  await withTransaction(async tx => {
    const request = await lockRequest(tx, teamId, id);
    const from = request.status as ChangeRequestStatus;

    if (!ALLOWED_ACTIONS[from].includes(body.action)) {
      throw conflict(
        TERMINAL_STATUSES.includes(from)
          ? `A ${STATUS_LABEL[from].toLowerCase()} request can no longer change`
          : `That action is not available while the request is ${STATUS_LABEL[from].toLowerCase()}`,
        "INVALID_TRANSITION"
      );
    }

    const base = {
      teamId,
      actor,
      clientId: request.client_id,
      clientName: request.client_name,
      projectId: request.project_id,
      targetType: "change_request",
      targetId: id,
    };
    const response = "response" in body ? cleanPortalRichText(body.response, 5000, "The response") : "";
    let to: ChangeRequestStatus = from;
    let eventText = "";
    let clientMessage = "";

    switch (body.action) {
      case "start_review":
        to = "under_review";
        eventText = "Status changed to Under Review";
        // Assigned to whoever starts the review unless it already has an assignee.
        if (!request.assignee_team_member_id && input.actorMemberId) {
          await tx.query(`UPDATE client_portal_change_requests SET assignee_team_member_id = $2 WHERE id = $1`, [
            id,
            input.actorMemberId,
          ]);
        }
        break;
      case "approve": {
        const hours = body.estimate ? parseAmount(body.estimate.hours, "Hours") : null;
        const cost = body.estimate ? parseAmount(body.estimate.cost, "Cost") : null;
        if (body.estimate) {
          await tx.query(
            `UPDATE client_portal_change_requests SET estimate_hours = $2, estimate_cost = $3 WHERE id = $1`,
            [id, hours, cost]
          );
        }
        const effectiveHours = body.estimate ? hours : request.estimate_hours != null ? Number(request.estimate_hours) : null;
        const effectiveCost = body.estimate ? cost : request.estimate_cost != null ? Number(request.estimate_cost) : null;
        to = "approved";
        const estimateText = formatEstimate(effectiveHours, effectiveCost);
        eventText = estimateText ? `Approved with an estimate of ${estimateText}` : "Approved";
        clientMessage = response || "Approved.";
        break;
      }
      case "ask_more_info":
        if (!response) throw badRequest("Write what you need to know before asking the client", "RESPONSE_REQUIRED");
        to = "more_info";
        eventText = "Status changed to More Information Required";
        clientMessage = response;
        break;
      case "reject":
        if (!response) throw badRequest("Write a response before rejecting", "RESPONSE_REQUIRED");
        to = "rejected";
        eventText = "Rejected with a response";
        clientMessage = response;
        break;
      case "return_to_review":
        to = "under_review";
        eventText = "Status changed to Under Review";
        break;
      case "complete":
        to = "completed";
        eventText = "Status changed to Completed";
        clientMessage = response;
        break;
      case "cancel":
        to = "cancelled";
        eventText = "Cancelled";
        break;
      case "send_response":
        if (!response) throw badRequest("Write a response to send", "RESPONSE_REQUIRED");
        eventText = "Sent a response to the client";
        clientMessage = response;
        break;
    }

    if (clientMessage) await addTeamMessage(tx, request, input.userId, actor.name, clientMessage);

    if (to !== from) {
      await tx.query(
        `UPDATE client_portal_change_requests
            SET status = $2, closed_at = CASE WHEN $3::boolean THEN NOW() ELSE closed_at END, updated_at = CURRENT_TIMESTAMP
          WHERE id = $1`,
        [id, to, TERMINAL_STATUSES.includes(to)]
      );
      await recordAuditEvent(tx, {
        ...base,
        event: to === "completed" ? "Change request completed" : "Change request status changed",
        targetLabel:
          to === "completed"
            ? `${request.cr_no} · ${request.title}`
            : `${request.cr_no} · ${STATUS_LABEL[from]} → ${STATUS_LABEL[to]}`,
        metadata: { from, to },
      });
    }
    await addEvent(tx, id, "internal", actor.name, eventText);

    // The requester hears about every change that concerns them: the response, status and estimate.
    if (to !== from || clientMessage) {
      void notifyClientUsers({
        teamId,
        clientId: request.client_id,
        projectId: request.project_id,
        type: "change_request",
        title: `${request.cr_no}: ${STATUS_LABEL[to]}`,
        message: clientMessage || `${request.title} is now ${STATUS_LABEL[to].toLowerCase()}.`,
        referenceId: id,
        referenceNumber: request.cr_no,
        emailEvent: "change_request_update",
        onlyContactIds: request.requester_contact_id ? [request.requester_contact_id] : undefined,
        portalPath: `/change-requests/${id}`,
      });
    }
  });

  return getChangeRequest(db, teamId, id);
}

export interface UpdateChangeRequestInput {
  assignee_id?: string | null;
  estimate?: { hours?: number | null; cost?: number | null } | null;
  internal_assessment?: string;
}

/**
 * Edits the assignee (never shown to the client), the estimate (nullable, a blank stays blank) and
 * the private internal assessment. A closed request is read-only.
 */
export async function updateChangeRequest(input: {
  teamId: string;
  id: string;
  patch: UpdateChangeRequestInput;
}): Promise<ChangeRequestView> {
  const { teamId, id, patch } = input;

  await withTransaction(async tx => {
    const request = await lockRequest(tx, teamId, id);
    if (TERMINAL_STATUSES.includes(request.status)) {
      throw conflict("A closed request can no longer be edited", "READ_ONLY");
    }

    const sets: string[] = [];
    const values: unknown[] = [id];
    const set = (column: string, value: unknown) => sets.push(`${column} = $${values.push(value)}`);

    if (patch.assignee_id !== undefined) {
      if (patch.assignee_id !== null && !(await findStaff(tx, teamId, patch.assignee_id))) {
        throw badRequest("The assignee must be an active workspace member");
      }
      set("assignee_team_member_id", patch.assignee_id);
    }
    if (patch.estimate !== undefined) {
      set("estimate_hours", patch.estimate ? parseAmount(patch.estimate.hours, "Hours") : null);
      set("estimate_cost", patch.estimate ? parseAmount(patch.estimate.cost, "Cost") : null);
    }
    if (patch.internal_assessment !== undefined) set("internal_assessment", cleanPortalRichText(patch.internal_assessment, 5000, "The internal assessment"));

    if (sets.length > 0) {
      await tx.query(
        `UPDATE client_portal_change_requests SET ${sets.join(", ")}, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        values
      );
    }
  });

  return getChangeRequest(db, teamId, id);
}

/** Project tasks that are not already linked to a change request, for "Link an existing task". */
export async function listLinkableTasks(q: Queryable, teamId: string, projectId: string) {
  const result = await q.query(
    `SELECT t.id, (p.key || '-' || t.task_no::text) AS key, t.name
       FROM tasks t
       JOIN projects p ON p.id = t.project_id
      WHERE t.project_id = $1 AND p.team_id = $2 AND t.archived IS FALSE
        AND NOT EXISTS (SELECT 1 FROM client_portal_change_requests r WHERE r.linked_task_id = t.id)
      ORDER BY t.task_no`,
    [projectId, teamId]
  );
  return result.rows.map(row => ({ id: row.id as string, key: row.key as string, title: row.name as string }));
}

export type ConvertToWorkInput =
  | { mode: "create"; title?: string; assignee_id?: string | null; visibility?: string }
  | { mode: "link"; task_id: string };

/**
 * Converts an Approved request to project work and moves it to In Progress. Two modes:
 *   create  a new task in the same project (title defaults to "CR-0048: title", Internal Only unless
 *           staff pick Client Visible). The task estimate is copied from the request when it has one
 *           and otherwise left blank, never written as 0.
 *   link    an existing task of the project that is not already linked to a change request. The task
 *           keeps its own visibility and assignee.
 * Either way the request records the task key and the Approved decision stays in history.
 */
export async function convertChangeRequestToWork(input: {
  teamId: string;
  id: string;
  userId: string;
  actor: AuditActor;
  body: ConvertToWorkInput;
}): Promise<ChangeRequestView> {
  const { teamId, id, actor, body } = input;

  await withTransaction(async tx => {
    const request = await lockRequest(tx, teamId, id);
    if (request.status !== "approved") {
      throw conflict("Only an approved request can be converted to work", "NOT_APPROVED");
    }

    let taskId: string;
    let taskKey: string;
    let mode: "created" | "linked";

    if (body.mode === "link") {
      const task = await tx.query(
        `SELECT t.id, (p.key || '-' || t.task_no::text) AS key
           FROM tasks t JOIN projects p ON p.id = t.project_id
          WHERE t.id = $1 AND t.project_id = $2 AND p.team_id = $3 AND t.archived IS FALSE`,
        [body.task_id, request.project_id, teamId]
      );
      if (task.rows.length === 0) throw badRequest("Choose a task from this project", "INVALID_TASK");
      const taken = await tx.query(`SELECT cr_no FROM client_portal_change_requests WHERE linked_task_id = $1`, [body.task_id]);
      if (taken.rows.length > 0) {
        throw conflict(`That task is already linked to ${taken.rows[0].cr_no}`, "TASK_ALREADY_LINKED");
      }
      taskId = task.rows[0].id;
      taskKey = task.rows[0].key;
      mode = "linked";
    } else {
      const visibility = body.visibility ?? "internal";
      if (visibility !== "internal" && visibility !== "client") throw badRequest("Invalid visibility");
      if (body.assignee_id && !(await findStaff(tx, teamId, body.assignee_id))) {
        throw badRequest("The assignee must be an active workspace member");
      }

      const status = await tx.query(
        `SELECT id FROM task_statuses
          WHERE project_id = $1 AND category_id IN (SELECT id FROM sys_task_status_categories WHERE is_todo IS TRUE)
          ORDER BY sort_order ASC LIMIT 1`,
        [request.project_id]
      );
      const priority = await tx.query(`SELECT id FROM task_priorities WHERE LOWER(name) = LOWER($1)`, [request.priority]);

      const taskBody: Record<string, unknown> = {
        name: (body.title ?? "").trim() || `${request.cr_no}: ${request.title}`,
        project_id: request.project_id,
        reporter_id: input.userId,
        team_id: teamId,
        description: request.description,
        status_id: status.rows[0]?.id ?? null,
        priority_id: priority.rows[0]?.id ?? null,
        assignees: body.assignee_id ? [body.assignee_id] : [],
        attachments: [],
        labels: [],
      };
      // Left out when the request has no hours so the task estimate stays blank, never 0.
      if (request.estimate_hours != null) taskBody.total_minutes = Math.round(Number(request.estimate_hours) * 60);

      const created = await tx.query("SELECT create_task($1) AS task;", [JSON.stringify(taskBody)]);
      taskId = created.rows[0]?.task?.id;
      if (!taskId) throw new Error("Failed to create the task");

      const key = await tx.query(
        `SELECT (p.key || '-' || t.task_no::text) AS key FROM tasks t JOIN projects p ON p.id = t.project_id WHERE t.id = $1`,
        [taskId]
      );
      taskKey = key.rows[0].key;
      mode = "created";

      // A task created from a request is Internal Only unless staff chose Client Visible.
      if (visibility === "client") {
        await tx.query(
          `INSERT INTO client_portal_task_settings (task_id, project_id, visibility, updated_by)
           VALUES ($1, $2, 'client', $3)
           ON CONFLICT (task_id) DO UPDATE SET visibility = 'client', updated_at = CURRENT_TIMESTAMP`,
          [taskId, request.project_id, input.userId]
        );
        await recordAuditEvent(tx, {
          teamId,
          event: "Entity made Client Visible",
          actor,
          clientId: request.client_id,
          clientName: request.client_name,
          projectId: request.project_id,
          targetType: "task",
          targetId: taskId,
          targetLabel: `Task: ${taskKey}`,
        });
      }
    }

    await tx.query(
      `UPDATE client_portal_change_requests
          SET status = 'in_progress', linked_task_id = $2, linked_task_key = $3, linked_task_mode = $4,
              updated_at = CURRENT_TIMESTAMP
        WHERE id = $1`,
      [id, taskId, taskKey, mode]
    );
    await addEvent(tx, id, "internal", actor.name, mode === "created" ? `Converted to work item ${taskKey}` : `Linked to work item ${taskKey}`);
    await recordAuditEvent(tx, {
      teamId,
      event: "Change request status changed",
      actor,
      clientId: request.client_id,
      clientName: request.client_name,
      projectId: request.project_id,
      targetType: "change_request",
      targetId: id,
      targetLabel: `${request.cr_no} · Approved → In Progress`,
      metadata: { from: "approved", to: "in_progress", task_key: taskKey, mode },
    });
  });

  return getChangeRequest(db, teamId, id);
}

/** Requests a quote or invoice can start from (Approved, In Progress, Completed), with how many invoices exist. */
export async function listBillableChangeRequests(
  teamId: string,
  params: { organization_id?: string; search?: string }
) {
  const values: unknown[] = [teamId, [...BILLABLE_STATUSES]];
  const filters: string[] = [];
  if (params.organization_id) filters.push(`r.client_id = $${values.push(params.organization_id)}`);
  const search = (params.search ?? "").trim();
  if (search) {
    const n = values.push(containsPattern(search));
    filters.push(`(r.cr_no ILIKE $${n} OR r.title ILIKE $${n})`);
  }

  const result = await db.query(
    `SELECT r.id, r.cr_no, r.title, r.client_id, r.status,
            (SELECT COUNT(*)::int FROM client_portal_invoices i
              WHERE i.change_request_id = r.id AND i.deleted_at IS NULL) AS existing_invoice_count
       FROM client_portal_change_requests r
      WHERE r.organization_team_id = $1 AND r.status = ANY($2::text[])
        ${filters.length ? `AND ${filters.join(" AND ")}` : ""}
      ORDER BY r.submitted_at DESC
      LIMIT 100`,
    values
  );
  return result.rows.map(row => ({
    id: row.id as string,
    cr_no: row.cr_no as string,
    title: row.title as string,
    organization_id: row.client_id as string,
    status: row.status as ChangeRequestStatus,
    existing_invoice_count: row.existing_invoice_count as number,
  }));
}
