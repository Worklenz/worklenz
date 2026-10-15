import db from "../../config/db";
import { withTransaction } from "../client-contacts-service";
import { AuditActor, recordAuditEvent } from "./audit.service";
import { clientRoleCan } from "../../shared/client-portal-permissions";
import { htmlToPlainText } from "../../shared/utils";
import { badRequest, conflict, forbidden, notFound } from "./errors";
import { cleanPortalRichText } from "./rich-text";
import { notifyClientUsers, notifyStaff } from "./notify.service";
import { getProjectRef } from "./project-core";
import { CONTACT_CAN_OPEN_PROJECT_SQL, assertSubjectProject } from "./scope";
import { nextApprovalRef } from "./sequences";
import { ClientSubject } from "./subject";
import { PortalSide, Queryable } from "./types";
import { USER_VIEW_SQL } from "./users.service";
import { containsPattern } from "./list-params";

/**
 * Approvals: a formal, auditable sign-off of one Client Visible file (at an exact version),
 * milestone or task, or of a free-form item described in the request itself.
 *
 * Statuses: draft -> awaiting -> approved | changes_requested | cancelled. A Draft is never visible
 * to the client. A decision is recorded once per revision (idempotent) with the decider, the time
 * and what was approved (the file version, or the item name and revision for items without
 * versions). Re-approval and resubmission create a NEW revision, so an earlier decision is never
 * overwritten and the file version an approval points at never changes when the file is replaced.
 */

export const APPROVAL_STATUSES = ["draft", "awaiting", "approved", "changes_requested", "cancelled"] as const;
export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];
export type ApprovalLinkType = "file" | "milestone" | "task" | "freeform";
export type ApprovalOutcome = "approved" | "changes_requested";

export interface ApprovalView {
  id: string;
  ref_no: string;
  organization_id: string;
  organization_name: string;
  project_id: string;
  project_name: string;
  project_color: string | null;
  title: string;
  linked_item: {
    type: ApprovalLinkType;
    id: string | null;
    name: string;
    file_version: number | null;
    task_key: string | null;
    description: string | null;
  };
  /** The primary (first named) approver. */
  approver_id: string;
  /** Every approver's name, joined, for display and sorting. */
  approver_name: string;
  /** Everyone named as an approver; the first to decide settles the request. */
  approvers: Array<{ id: string; name: string }>;
  instructions: string;
  due_date: string | null;
  /** When the approval was created. */
  requested_at: string;
  status: ApprovalStatus;
  revision: number;
  created_by: string;
  decision: {
    outcome: ApprovalOutcome;
    decided_by: string;
    decided_at: string;
    comment: string;
    reference: string;
  } | null;
  visible_to_client: boolean;
  is_overdue: boolean;
  newer_file_version: number | null;
  history: Array<{ at: string; actor: string; side: PortalSide; text: string }>;
  earlier_revisions: Array<{ revision: number; description: string }>;
  discussion: { thread_id: string; message_count: number } | null;
}

/** "Homepage Wireframe.fig v3" for a file, "Content migration plan, revision 1" for anything else. */
export const decisionReference = (input: {
  type: ApprovalLinkType;
  name: string;
  file_version: number | null;
  revision: number;
}): string =>
  input.type === "file" && input.file_version
    ? `${input.name} v${input.file_version}`
    : `${input.name}, revision ${input.revision}`;

// $1 = team id.
const APPROVAL_SELECT = `
  SELECT a.id, a.ref_no, a.client_id, a.project_id, a.title, a.linked_type, a.item_name, a.item_task_key,
         a.linked_file_id, a.linked_file_version, a.linked_milestone_id, a.linked_task_id,
         a.freeform_description, a.approver_contact_id, a.approver_name, a.instructions,
         a.due_date::text AS due_date, a.created_at AS requested_at, a.status, a.revision, a.created_by_name,
         p.name AS project_name, p.color_code AS project_color,
         COALESCE(NULLIF(TRIM(c.company_name), ''), c.name) AS organization_name,
         (a.status = 'awaiting' AND a.due_date IS NOT NULL AND a.due_date < CURRENT_DATE) AS is_overdue,
         CASE WHEN a.linked_type = 'file' AND pf.current_version > a.linked_file_version
              THEN pf.current_version END AS newer_file_version,
         rev.outcome, rev.decided_by_name, rev.decided_at, rev.comment AS decision_comment,
         rev.file_version AS rev_file_version, rev.item_name AS rev_item_name,
         th.id AS thread_id,
         (SELECT COALESCE(json_agg(json_build_object('id', ap.contact_id, 'name', ap.contact_name) ORDER BY ap.position), '[]'::json)
            FROM client_portal_approval_approvers ap WHERE ap.approval_id = a.id) AS approvers,
         (SELECT COUNT(*)::int FROM client_portal_thread_messages m WHERE m.thread_id = th.id AND m.visibility <> 'client_only' AND m.deleted_at IS NULL) AS thread_messages
    FROM client_portal_approvals a
    JOIN projects p ON p.id = a.project_id
    JOIN clients c ON c.id = a.client_id
    LEFT JOIN project_files pf ON pf.id = a.linked_file_id
    LEFT JOIN client_portal_approval_revisions rev ON rev.approval_id = a.id AND rev.revision = a.revision
    LEFT JOIN client_portal_threads th ON th.context_approval_id = a.id
   WHERE a.organization_team_id = $1
`;

function toView(row: any): ApprovalView {
  const type = row.linked_type as ApprovalLinkType;
  const decided = row.outcome != null;
  return {
    id: row.id,
    ref_no: row.ref_no,
    organization_id: row.client_id,
    organization_name: row.organization_name,
    project_id: row.project_id,
    project_name: row.project_name,
    project_color: row.project_color ?? null,
    title: row.title,
    linked_item: {
      type,
      id: row.linked_file_id ?? row.linked_milestone_id ?? row.linked_task_id ?? null,
      name: row.item_name,
      file_version: row.linked_file_version ?? null,
      task_key: row.item_task_key ?? null,
      description: type === "freeform" ? row.freeform_description ?? "" : null,
    },
    approver_id: row.approver_contact_id,
    approver_name: row.approver_name,
    approvers: Array.isArray(row.approvers) ? row.approvers : [],
    instructions: row.instructions,
    due_date: row.due_date ?? null,
    requested_at: row.requested_at,
    status: row.status,
    revision: row.revision,
    created_by: row.created_by_name,
    decision: decided
      ? {
          outcome: row.outcome,
          decided_by: row.decided_by_name,
          decided_at: row.decided_at,
          comment: row.decision_comment ?? "",
          reference: decisionReference({
            type,
            name: row.rev_item_name ?? row.item_name,
            file_version: row.rev_file_version ?? null,
            revision: row.revision,
          }),
        }
      : null,
    visible_to_client: row.status !== "draft",
    is_overdue: row.is_overdue === true,
    newer_file_version: row.newer_file_version ?? null,
    history: [],
    earlier_revisions: [],
    discussion: row.thread_id ? { thread_id: row.thread_id, message_count: row.thread_messages ?? 0 } : null,
  };
}

export interface ApprovalsParams {
  status?: string;
  organization_id?: string;
  search?: string;
  /** A key of APPROVAL_SORTS. */
  sort?: string;
  order?: string;
  page?: number;
  limit?: number;
}

// Whitelist of sortable columns; the keys are the table column keys the admin UI sends.
const APPROVAL_SORTS: Record<string, string> = {
  ref: "l.ref_no",
  approval: "LOWER(l.title)",
  client: "LOWER(l.organization_name)",
  project: "LOWER(l.project_name)",
  linked: "LOWER(l.item_name)",
  type: "l.linked_type",
  approver: "LOWER(l.approver_name)",
  due: "l.due_date",
  requested: "l.requested_at",
  status: "l.status",
};

export interface ApprovalStats {
  awaiting: number;
  overdue: number;
  approved: number;
  changes_requested: number;
  drafts: number;
}

export async function getApprovalStats(q: Queryable, teamId: string): Promise<ApprovalStats> {
  const result = await q.query(
    `SELECT COUNT(*) FILTER (WHERE status = 'awaiting')::int AS awaiting,
            COUNT(*) FILTER (WHERE status = 'awaiting' AND due_date IS NOT NULL AND due_date < CURRENT_DATE)::int AS overdue,
            COUNT(*) FILTER (WHERE status = 'approved')::int AS approved,
            COUNT(*) FILTER (WHERE status = 'changes_requested')::int AS changes_requested,
            COUNT(*) FILTER (WHERE status = 'draft')::int AS drafts
       FROM client_portal_approvals WHERE organization_team_id = $1`,
    [teamId]
  );
  const row = result.rows[0] ?? {};
  return {
    awaiting: row.awaiting ?? 0,
    overdue: row.overdue ?? 0,
    approved: row.approved ?? 0,
    changes_requested: row.changes_requested ?? 0,
    drafts: row.drafts ?? 0,
  };
}

const splitList = (value?: string): string[] =>
  (value ?? "")
    .split(",")
    .map(item => item.trim())
    .filter(Boolean);

export async function listApprovals(teamId: string, params: ApprovalsParams) {
  const page = Math.max(Number(params.page) || 1, 1);
  const limit = Math.min(Math.max(Number(params.limit) || 10, 1), 100);
  const filters: string[] = [];
  const values: unknown[] = [teamId];

  // Both filters accept a comma-separated list, so the admin UI can select several at once.
  const statuses = splitList(params.status);
  if (statuses.length) {
    if (statuses.some(s => !(APPROVAL_STATUSES as readonly string[]).includes(s))) throw badRequest("Invalid status filter");
    filters.push(`a.status = ANY($${values.push(statuses)}::text[])`);
  }
  const clientIds = splitList(params.organization_id);
  if (clientIds.length) filters.push(`a.client_id = ANY($${values.push(clientIds)}::uuid[])`);
  const search = (params.search ?? "").trim();
  if (search) {
    const n = values.push(containsPattern(search));
    filters.push(
      `(a.ref_no ILIKE $${n} OR a.title ILIKE $${n} OR a.item_name ILIKE $${n} OR a.item_task_key ILIKE $${n}
        OR a.approver_name ILIKE $${n} OR a.created_by_name ILIKE $${n} OR p.name ILIKE $${n}
        OR c.name ILIKE $${n} OR c.company_name ILIKE $${n}
        OR EXISTS (SELECT 1 FROM client_portal_approval_approvers sap WHERE sap.approval_id = a.id AND sap.contact_name ILIKE $${n}))`
    );
  }

  const where = filters.length ? `AND ${filters.join(" AND ")}` : "";
  const limitParam = values.push(limit);
  const offsetParam = values.push((page - 1) * limit);

  const sortSql = params.sort ? APPROVAL_SORTS[params.sort] : undefined;
  if (params.sort && !sortSql) throw badRequest("Invalid sort column");
  const direction = params.order === "desc" ? "DESC" : "ASC";
  const orderBy = sortSql ? `${sortSql} ${direction} NULLS LAST, l.ref_no DESC` : "l.ref_no DESC";

  const rows = await db.query(
    `SELECT l.*, COUNT(*) OVER()::int AS total_count
       FROM (${APPROVAL_SELECT} ${where}) l
      ORDER BY ${orderBy}
      LIMIT $${limitParam} OFFSET $${offsetParam}`,
    values
  );

  return {
    items: rows.rows.map(toView),
    total: rows.rows[0]?.total_count ?? 0,
    page,
    limit,
    stats: await getApprovalStats(db, teamId),
  };
}

/** One approval with its full history timeline and any earlier free-form descriptions. */
export async function getApproval(q: Queryable, teamId: string, approvalId: string): Promise<ApprovalView> {
  const result = await q.query(`${APPROVAL_SELECT} AND a.id = $2`, [teamId, approvalId]);
  if (result.rows.length === 0) throw notFound("Approval");
  const view = toView(result.rows[0]);

  const events = await q.query(
    `SELECT actor_name, actor_side, text, created_at
       FROM client_portal_approval_events WHERE approval_id = $1 ORDER BY created_at, id`,
    [approvalId]
  );
  view.history = events.rows.map(row => ({
    at: row.created_at,
    actor: row.actor_name,
    side: row.actor_side,
    text: row.text,
  }));

  if (view.linked_item.type === "freeform") {
    const earlier = await q.query(
      `SELECT revision, description_snapshot
         FROM client_portal_approval_revisions
        WHERE approval_id = $1 AND revision < $2 AND description_snapshot IS NOT NULL
        ORDER BY revision DESC`,
      [approvalId, view.revision]
    );
    view.earlier_revisions = earlier.rows.map(row => ({
      revision: row.revision,
      description: row.description_snapshot,
    }));
  }
  return view;
}

export interface ApprovalOptions {
  linkable: {
    files: Array<{ id: string; name: string; current_version: number }>;
    milestones: Array<{ id: string; name: string }>;
    tasks: Array<{ id: string; key: string; client_title: string }>;
    internal_counts: { files: number; milestones: number; tasks: number };
  };
  /** Every active user of the client. Naming one as approver also gives them access to the project. */
  approvers: Array<{ id: string; name: string; email: string; role: string }>;
}

/**
 * What an approval for a project can link to and who can approve it. Only Client Visible files,
 * milestones and tasks are offered (the hint counts how many are still Internal Only), and any
 * active user of the project's client can be an approver (they are given project access when named).
 */
export async function getApprovalOptions(q: Queryable, teamId: string, projectId: string): Promise<ApprovalOptions> {
  const project = await getProjectRef(q, teamId, projectId);

  const [files, milestones, tasks, approvers] = await Promise.all([
    q.query(
      `SELECT id, name, current_version, portal_visibility FROM project_files
        WHERE project_id = $1 AND team_id = $2 AND status = 'active' ORDER BY name`,
      [projectId, teamId]
    ),
    q.query(`SELECT id, name, visibility FROM client_portal_milestones WHERE project_id = $1 ORDER BY target_date`, [
      projectId,
    ]),
    q.query(
      `SELECT t.id, (p.key || '-' || t.task_no::text) AS key, t.name,
              COALESCE(cts.visibility, 'internal') AS visibility,
              COALESCE(NULLIF(cts.client_title, ''), t.name) AS client_title
         FROM tasks t
         JOIN projects p ON p.id = t.project_id
         LEFT JOIN client_portal_task_settings cts ON cts.task_id = t.id
        WHERE t.project_id = $1 AND t.archived IS FALSE ORDER BY t.task_no`,
      [projectId]
    ),
    project.clientId
      ? q.query(
          `SELECT u.id, u.name, u.email, u.role
             FROM (${USER_VIEW_SQL}) u
            WHERE u.client_id = $2 AND u.status_key = 'active'
            ORDER BY (u.role = 'admin') DESC, u.name`,
          [teamId, project.clientId]
        )
      : Promise.resolve({ rows: [] as any[] }),
  ]);

  return {
    linkable: {
      files: files.rows
        .filter(row => row.portal_visibility === "client")
        .map(row => ({ id: row.id, name: row.name, current_version: row.current_version })),
      milestones: milestones.rows.filter(row => row.visibility === "client").map(row => ({ id: row.id, name: row.name })),
      tasks: tasks.rows
        .filter(row => row.visibility === "client")
        .map(row => ({ id: row.id, key: row.key, client_title: row.client_title })),
      internal_counts: {
        files: files.rows.filter(row => row.portal_visibility !== "client").length,
        milestones: milestones.rows.filter(row => row.visibility !== "client").length,
        tasks: tasks.rows.filter(row => row.visibility !== "client").length,
      },
    },
    approvers: approvers.rows.map(row => ({ id: row.id, name: row.name, email: row.email, role: row.role })),
  };
}

interface LinkedSnapshot {
  type: ApprovalLinkType;
  fileId: string | null;
  fileVersion: number | null;
  milestoneId: string | null;
  taskId: string | null;
  itemName: string;
  taskKey: string | null;
  description: string | null;
}

/**
 * Resolves a linked item as it stands now and requires it to still be Client Visible. Used when an
 * approval is created, sent and resubmitted, so the client never receives a link to an item they
 * cannot open.
 */
async function snapshotExistingItem(
  q: Queryable,
  teamId: string,
  projectId: string,
  link: { type: "file" | "milestone" | "task"; id: string }
): Promise<LinkedSnapshot> {
  if (link.type === "file") {
    const result = await q.query(
      `SELECT id, name, current_version, portal_visibility
         FROM project_files WHERE id = $1 AND project_id = $2 AND team_id = $3 AND status = 'active'`,
      [link.id, projectId, teamId]
    );
    const row = result.rows[0];
    if (!row) throw badRequest("The linked file is not in this project", "INVALID_LINK");
    if (row.portal_visibility !== "client") {
      throw badRequest(`"${row.name}" is Internal Only. Share it with the client first.`, "ITEM_NOT_SHARED");
    }
    return {
      type: "file",
      fileId: row.id,
      fileVersion: row.current_version,
      milestoneId: null,
      taskId: null,
      itemName: row.name,
      taskKey: null,
      description: null,
    };
  }

  if (link.type === "milestone") {
    const result = await q.query(
      `SELECT id, name, visibility FROM client_portal_milestones WHERE id = $1 AND project_id = $2`,
      [link.id, projectId]
    );
    const row = result.rows[0];
    if (!row) throw badRequest("The linked milestone is not in this project", "INVALID_LINK");
    if (row.visibility !== "client") {
      throw badRequest(`"${row.name}" is Internal Only. Share it with the client first.`, "ITEM_NOT_SHARED");
    }
    return {
      type: "milestone",
      fileId: null,
      fileVersion: null,
      milestoneId: row.id,
      taskId: null,
      itemName: row.name,
      taskKey: null,
      description: null,
    };
  }

  const result = await q.query(
    `SELECT t.id, (p.key || '-' || t.task_no::text) AS key, t.name,
            COALESCE(cts.visibility, 'internal') AS visibility,
            COALESCE(NULLIF(cts.client_title, ''), t.name) AS client_title
       FROM tasks t
       JOIN projects p ON p.id = t.project_id
       LEFT JOIN client_portal_task_settings cts ON cts.task_id = t.id
      WHERE t.id = $1 AND t.project_id = $2`,
    [link.id, projectId]
  );
  const row = result.rows[0];
  if (!row) throw badRequest("The linked task is not in this project", "INVALID_LINK");
  if (row.visibility !== "client") {
    throw badRequest(`"${row.name}" is Internal Only. Share it with the client first.`, "ITEM_NOT_SHARED");
  }
  // The client sees the task's client-facing title, never the internal one.
  return {
    type: "task",
    fileId: null,
    fileVersion: null,
    milestoneId: null,
    taskId: row.id,
    itemName: row.client_title,
    taskKey: row.key,
    description: null,
  };
}

export interface CreateApprovalInput {
  project_id: string;
  title: string;
  linked_item:
    | { type: "file" | "milestone" | "task"; id: string }
    | { type: "freeform"; name: string; description?: string };
  approver_ids: string[];
  instructions?: string;
  due_date?: string | null;
  send?: boolean;
}

const isIsoDate = (value: unknown): value is string =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);

async function addEvent(
  q: Queryable,
  approvalId: string,
  revision: number,
  side: PortalSide,
  actor: string,
  text: string
): Promise<void> {
  await q.query(
    `INSERT INTO client_portal_approval_events (approval_id, revision, actor_side, actor_name, text)
     VALUES ($1, $2, $3, $4, $5)`,
    [approvalId, revision, side, actor, text]
  );
}

const uniqueIds = (ids: unknown): string[] =>
  Array.from(new Set((Array.isArray(ids) ? ids : []).filter((id): id is string => typeof id === "string" && id !== "")));

/**
 * Resolves the named approvers. Any Active user of the project's client can be named, whatever their
 * role: naming someone is what lets them decide this request. They are also given access to the
 * project (view level, never lowering an existing level) so the request is visible to them.
 */
async function loadApprovers(
  q: Queryable,
  teamId: string,
  clientId: string,
  projectId: string,
  approverIds: string[],
  audit?: AuditActor
): Promise<Array<{ id: string; name: string }>> {
  const ids = uniqueIds(approverIds);
  if (ids.length === 0) throw badRequest("Choose at least one approver", "INVALID_APPROVER");

  const result = await q.query(
    `SELECT u.id, u.name
       FROM (${USER_VIEW_SQL}) u
      WHERE u.id = ANY($2::uuid[]) AND u.client_id = $3 AND u.status_key = 'active'`,
    [teamId, ids, clientId]
  );
  const byId = new Map<string, { id: string; name: string }>(
    result.rows.map((row: any) => [row.id as string, { id: row.id as string, name: row.name as string }])
  );
  if (ids.some(id => !byId.has(id))) {
    throw badRequest("Approvers must be active users of this project's client", "INVALID_APPROVER");
  }

  // Naming an approver can open the project to them. Anyone who can already open it (a Client Admin, or an
  // assigned user) is left alone; a genuinely new grant is audited, so it is never a silent re-grant.
  const granted = await q.query(
    `INSERT INTO client_contact_project_access (client_contact_id, project_id, permission_level)
     SELECT c.id, $2, 'view'
       FROM unnest($1::uuid[]) AS c(id)
      WHERE NOT ${CONTACT_CAN_OPEN_PROJECT_SQL("c.id", "$2::uuid")}
     ON CONFLICT (client_contact_id, project_id) DO NOTHING
     RETURNING client_contact_id`,
    [ids, projectId]
  );
  if (granted.rows.length > 0) {
    const project = await getProjectRef(q, teamId, projectId);
    for (const row of granted.rows) {
      const person = byId.get(row.client_contact_id as string);
      await recordAuditEvent(q, {
        teamId,
        event: "Project access assigned",
        actor: audit ?? { side: "internal", name: "System" },
        clientId,
        clientName: project.clientName,
        projectId,
        targetType: "client_user",
        targetId: row.client_contact_id as string,
        targetLabel: `${person?.name ?? "Approver"} · ${project.name} (named as approver)`,
      });
    }
  }
  return ids.map(id => byId.get(id) as { id: string; name: string });
}

/** Replaces the approver rows of a request. The first one is the primary approver. */
async function saveApprovers(q: Queryable, approvalId: string, approvers: Array<{ id: string; name: string }>) {
  await q.query(`DELETE FROM client_portal_approval_approvers WHERE approval_id = $1`, [approvalId]);
  for (const [position, approver] of approvers.entries()) {
    await q.query(
      `INSERT INTO client_portal_approval_approvers (approval_id, contact_id, contact_name, position)
       VALUES ($1, $2, $3, $4)`,
      [approvalId, approver.id, approver.name, position]
    );
  }
}

async function notifyApprover(input: {
  teamId: string;
  clientId: string;
  projectId: string;
  approvalId: string;
  approverIds: string[];
  title: string;
  refNo: string;
  dueDate: string | null;
  revision: number;
}): Promise<void> {
  await notifyClientUsers({
    teamId: input.teamId,
    clientId: input.clientId,
    projectId: input.projectId,
    type: "approval",
    title: input.revision > 1 ? `Approval resubmitted: ${input.title}` : `Approval requested: ${input.title}`,
    message: input.dueDate ? `${input.refNo} is waiting for your decision by ${input.dueDate}.` : `${input.refNo} is waiting for your decision.`,
    referenceId: input.approvalId,
    referenceNumber: input.refNo,
    emailEvent: "approval_request",
    onlyContactIds: input.approverIds,
    portalPath: `/approvals/${input.approvalId}`,
  });
}

/**
 * Notifications run on their own pool connection, so they must wait for the transaction to commit: sent
 * from inside it they could run before the new rows are visible, and would still fire if it rolled back.
 */
const runAfterCommit = (tasks: Array<() => Promise<void>>): void => {
  for (const task of tasks) void task().catch(error => console.error("[Approvals] notification failed:", error));
};

/**
 * Creates an approval request. Save-as-draft is invisible to the client and uncounted; Send makes it
 * Awaiting Approval and notifies the approver by email and in the portal.
 */
export async function createApproval(input: {
  teamId: string;
  userId: string;
  actor: AuditActor;
  body: CreateApprovalInput;
}): Promise<ApprovalView> {
  const { teamId, actor, body } = input;

  const title = (body.title ?? "").trim();
  if (!title) throw badRequest("Say what is being approved", "MISSING_FIELDS");
  if (title.length > 200) throw badRequest("A title can be at most 200 characters");
  const approverIds = uniqueIds(body.approver_ids);
  if (!body.project_id || approverIds.length === 0 || !body.linked_item) {
    throw badRequest("Project, linked item and at least one approver are required", "MISSING_FIELDS");
  }
  if (body.due_date != null && !isIsoDate(body.due_date)) throw badRequest("The due date must be a YYYY-MM-DD date");
  const send = body.send === true;

  const afterCommit: Array<() => Promise<void>> = [];
  const approvalId = await withTransaction(async tx => {
    const project = await getProjectRef(tx, teamId, body.project_id);
    if (!project.clientId) throw badRequest("This project is not linked to a client", "PROJECT_HAS_NO_CLIENT");

    const portal = await tx.query(`SELECT portal_enabled FROM project_client_settings WHERE project_id = $1`, [
      body.project_id,
    ]);
    if (portal.rows[0]?.portal_enabled !== true) {
      throw badRequest("Only a project with the Client Portal on can have an approval", "PORTAL_OFF");
    }

    const approvers = await loadApprovers(tx, teamId, project.clientId, body.project_id, approverIds, actor);

    let snapshot: LinkedSnapshot;
    if (body.linked_item.type === "freeform") {
      const name = (body.linked_item.name ?? "").trim();
      if (!name) throw badRequest("A free-form item needs a name", "MISSING_FIELDS");
      if (name.length > 200) throw badRequest("An item name can be at most 200 characters");
      snapshot = {
        type: "freeform",
        fileId: null,
        fileVersion: null,
        milestoneId: null,
        taskId: null,
        itemName: name,
        taskKey: null,
        description: cleanPortalRichText(body.linked_item.description, 2000, "The description") || null,
      };
    } else {
      snapshot = await snapshotExistingItem(tx, teamId, body.project_id, body.linked_item);
    }

    const refNo = await nextApprovalRef(tx, teamId);
    const inserted = await tx.query(
      `INSERT INTO client_portal_approvals (
         ref_no, organization_team_id, client_id, project_id, title, linked_type,
         linked_file_id, linked_file_version, linked_milestone_id, linked_task_id,
         item_name, item_task_key, freeform_description, approver_contact_id, approver_name,
         instructions, due_date, status, revision, created_by, created_by_name
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, 1, $19, $20)
       RETURNING id`,
      [
        refNo,
        teamId,
        project.clientId,
        body.project_id,
        title,
        snapshot.type,
        snapshot.fileId,
        snapshot.fileVersion,
        snapshot.milestoneId,
        snapshot.taskId,
        snapshot.itemName,
        snapshot.taskKey,
        snapshot.description,
        approvers[0].id,
        approvers.map(a => a.name).join(", "),
        cleanPortalRichText(body.instructions, 2000, "The instructions"),
        body.due_date ?? null,
        send ? "awaiting" : "draft",
        input.userId,
        actor.name,
      ]
    );
    const id = inserted.rows[0].id as string;

    await tx.query(
      `INSERT INTO client_portal_approval_revisions (approval_id, revision, file_version, item_name, description_snapshot)
       VALUES ($1, 1, $2, $3, $4)`,
      [id, snapshot.fileVersion, snapshot.itemName, snapshot.description]
    );
    await saveApprovers(tx, id, approvers);

    if (send) {
      await addEvent(tx, id, 1, "internal", actor.name, `Approval requested for ${snapshot.itemName}`);
      await addEvent(tx, id, 1, "internal", "System", `${approvers.map(a => a.name).join(", ")} notified by email and in the portal`);
    } else {
      await addEvent(tx, id, 1, "internal", actor.name, "Draft created. Not visible to the client until sent.");
    }

    await recordAuditEvent(tx, {
      teamId,
      event: send ? "Approval requested" : "Approval drafted",
      actor,
      clientId: project.clientId,
      clientName: project.clientName,
      projectId: project.id,
      targetType: "approval",
      targetId: id,
      targetLabel: `${refNo} · ${title}`,
    });

    if (send) {
      const notifyClientId = project.clientId;
      afterCommit.push(() => notifyApprover({
        teamId,
        clientId: notifyClientId,
        projectId: project.id,
        approvalId: id,
        approverIds: approvers.map(a => a.id),
        title,
        refNo,
        dueDate: body.due_date ?? null,
        revision: 1,
      }));
    }
    return id;
  });

  runAfterCommit(afterCommit);
  return getApproval(db, teamId, approvalId);
}

async function lockApproval(tx: Queryable, teamId: string, approvalId: string): Promise<any> {
  const result = await tx.query(
    `SELECT a.*, COALESCE(NULLIF(TRIM(c.company_name), ''), c.name) AS client_name,
            (SELECT COALESCE(array_agg(ap.contact_id ORDER BY ap.position), '{}'::uuid[])
               FROM client_portal_approval_approvers ap WHERE ap.approval_id = a.id) AS approver_ids
       FROM client_portal_approvals a
       JOIN clients c ON c.id = a.client_id
      WHERE a.id = $1 AND a.organization_team_id = $2
      FOR UPDATE OF a`,
    [approvalId, teamId]
  );
  if (result.rows.length === 0) throw notFound("Approval");
  return result.rows[0];
}

/** Sends a Draft to the client. The linked item must still be Client Visible. */
export async function sendApproval(input: {
  teamId: string;
  approvalId: string;
  actor: AuditActor;
}): Promise<ApprovalView> {
  const { teamId, approvalId, actor } = input;

  const afterCommit: Array<() => Promise<void>> = [];
  await withTransaction(async tx => {
    const approval = await lockApproval(tx, teamId, approvalId);
    if (approval.status !== "draft") throw conflict("Only a draft can be sent", "NOT_A_DRAFT");

    // A linked item may have been withdrawn since the draft was saved.
    if (approval.linked_type !== "freeform") {
      const link =
        approval.linked_type === "file"
          ? { type: "file" as const, id: approval.linked_file_id }
          : approval.linked_type === "milestone"
            ? { type: "milestone" as const, id: approval.linked_milestone_id }
            : { type: "task" as const, id: approval.linked_task_id };
      if (!link.id) throw badRequest("The linked item no longer exists", "INVALID_LINK");
      await snapshotExistingItem(tx, teamId, approval.project_id, link);
    }
    // Re-checked, and project access re-granted, in case a user was removed or deactivated since the draft.
    await loadApprovers(tx, teamId, approval.client_id, approval.project_id, approval.approver_ids, actor);

    await tx.query(`UPDATE client_portal_approvals SET status = 'awaiting', updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [
      approvalId,
    ]);
    await addEvent(tx, approvalId, approval.revision, "internal", actor.name, `Approval requested for ${approval.item_name}`);
    await addEvent(tx, approvalId, approval.revision, "internal", "System", `${approval.approver_name} notified by email and in the portal`);

    await recordAuditEvent(tx, {
      teamId,
      event: "Approval requested",
      actor,
      clientId: approval.client_id,
      clientName: approval.client_name,
      projectId: approval.project_id,
      targetType: "approval",
      targetId: approvalId,
      targetLabel: `${approval.ref_no} · ${approval.title}`,
    });

    afterCommit.push(() => notifyApprover({
      teamId,
      clientId: approval.client_id,
      projectId: approval.project_id,
      approvalId,
      approverIds: approval.approver_ids,
      title: approval.title,
      refNo: approval.ref_no,
      dueDate: approval.due_date,
      revision: approval.revision,
    }));
  });

  runAfterCommit(afterCommit);
  return getApproval(db, teamId, approvalId);
}

export interface UpdateApprovalInput {
  title?: string;
  instructions?: string;
  due_date?: string | null;
  approver_ids?: string[];
  /** Free-form items only: the name and description the client sees. */
  freeform?: { name?: string; description?: string };
}

/**
 * Edits a request the client has not reacted to yet (Draft or Awaiting). The project and the linked
 * item cannot change, since the client is approving that exact item. Changing the approver of an
 * Awaiting request notifies the new approver.
 */
export async function updateApproval(input: {
  teamId: string;
  approvalId: string;
  actor: AuditActor;
  body: UpdateApprovalInput;
}): Promise<ApprovalView> {
  const { teamId, approvalId, actor, body } = input;

  const afterCommit: Array<() => Promise<void>> = [];
  await withTransaction(async tx => {
    const approval = await lockApproval(tx, teamId, approvalId);
    if (approval.status !== "draft" && approval.status !== "awaiting") {
      throw conflict("A request can only be edited until the client reacts to it", "NOT_EDITABLE");
    }

    const title = body.title === undefined ? approval.title : body.title.trim();
    if (!title) throw badRequest("Say what is being approved", "MISSING_FIELDS");
    if (title.length > 200) throw badRequest("A title can be at most 200 characters");
    if (body.due_date != null && !isIsoDate(body.due_date)) throw badRequest("The due date must be a YYYY-MM-DD date");
    const dueProvided = body.due_date !== undefined;
    const dueDate = dueProvided ? body.due_date ?? null : null;
    const instructions = body.instructions === undefined ? approval.instructions : cleanPortalRichText(body.instructions, 2000, "The instructions");

    let approverId: string = approval.approver_contact_id;
    let approverName: string = approval.approver_name;
    let approvers: Array<{ id: string; name: string }> | null = null;
    let addedApproverIds: string[] = [];
    if (body.approver_ids !== undefined) {
      approvers = await loadApprovers(tx, teamId, approval.client_id, approval.project_id, body.approver_ids, actor);
      approverId = approvers[0].id;
      approverName = approvers.map(a => a.name).join(", ");
      const before = new Set<string>(approval.approver_ids ?? []);
      addedApproverIds = approvers.map(a => a.id).filter(id => !before.has(id));
    }

    let itemName: string = approval.item_name;
    let description: string | null = approval.freeform_description;
    if (approval.linked_type === "freeform" && body.freeform) {
      if (body.freeform.name !== undefined) {
        itemName = body.freeform.name.trim();
        if (!itemName) throw badRequest("A free-form item needs a name", "MISSING_FIELDS");
        if (itemName.length > 200) throw badRequest("An item name can be at most 200 characters");
      }
      if (body.freeform.description !== undefined) description = cleanPortalRichText(body.freeform.description, 2000, "The description") || null;
    }

    await tx.query(
      `UPDATE client_portal_approvals
          SET title = $2, instructions = $3,
              due_date = CASE WHEN $9::boolean THEN $4::date ELSE due_date END,
              approver_contact_id = $5, approver_name = $6,
              item_name = $7, freeform_description = $8, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1`,
      [approvalId, title, instructions, dueDate, approverId, approverName, itemName, description, dueProvided]
    );
    if (approvers) await saveApprovers(tx, approvalId, approvers);
    if (approval.linked_type === "freeform") {
      await tx.query(
        `UPDATE client_portal_approval_revisions SET item_name = $3, description_snapshot = $4
          WHERE approval_id = $1 AND revision = $2`,
        [approvalId, approval.revision, itemName, description]
      );
    }

    await addEvent(tx, approvalId, approval.revision, "internal", actor.name, "Request edited");
    await recordAuditEvent(tx, {
      teamId,
      event: "Approval edited",
      actor,
      clientId: approval.client_id,
      clientName: approval.client_name,
      projectId: approval.project_id,
      targetType: "approval",
      targetId: approvalId,
      targetLabel: `${approval.ref_no} · ${title}`,
    });

    if (approval.status === "awaiting" && addedApproverIds.length > 0) {
      afterCommit.push(() => notifyApprover({
        teamId,
        clientId: approval.client_id,
        projectId: approval.project_id,
        approvalId,
        approverIds: addedApproverIds,
        title,
        refNo: approval.ref_no,
        dueDate: dueProvided ? dueDate : approval.due_date,
        revision: approval.revision,
      }));
    }
  });

  runAfterCommit(afterCommit);
  return getApproval(db, teamId, approvalId);
}

/** Deletes a request the client has not reacted to yet (Draft or Awaiting), with its history. */
export async function deleteApproval(input: { teamId: string; approvalId: string; actor: AuditActor }): Promise<void> {
  const { teamId, approvalId, actor } = input;

  await withTransaction(async tx => {
    const approval = await lockApproval(tx, teamId, approvalId);
    if (approval.status !== "draft" && approval.status !== "awaiting") {
      throw conflict("A request can only be deleted until the client reacts to it. Cancel it instead.", "NOT_DELETABLE");
    }

    await tx.query(`DELETE FROM client_portal_approvals WHERE id = $1`, [approvalId]);
    await recordAuditEvent(tx, {
      teamId,
      event: "Approval deleted",
      actor,
      clientId: approval.client_id,
      clientName: approval.client_name,
      projectId: approval.project_id,
      targetType: "approval",
      targetId: approvalId,
      targetLabel: `${approval.ref_no} · ${approval.title}`,
    });
  });
}

/**
 * Withdraws a request that has been sent: Awaiting, or already decided by the client (Approved or
 * Changes Requested). It leaves the client's pending list; the history is kept. A Draft is deleted
 * instead, and a Cancelled one is already withdrawn.
 */
export async function cancelApproval(input: {
  teamId: string;
  approvalId: string;
  actor: AuditActor;
}): Promise<ApprovalView> {
  const { teamId, approvalId, actor } = input;

  await withTransaction(async tx => {
    const approval = await lockApproval(tx, teamId, approvalId);
    if (!["awaiting", "approved", "changes_requested"].includes(approval.status)) {
      throw conflict("Only a request that has been sent can be cancelled", "NOT_CANCELLABLE");
    }

    await tx.query(`UPDATE client_portal_approvals SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [
      approvalId,
    ]);
    await addEvent(tx, approvalId, approval.revision, "internal", actor.name, "Request cancelled");
    await recordAuditEvent(tx, {
      teamId,
      event: "Approval cancelled",
      actor,
      clientId: approval.client_id,
      clientName: approval.client_name,
      projectId: approval.project_id,
      targetType: "approval",
      targetId: approvalId,
      targetLabel: `${approval.ref_no} · ${approval.title}`,
    });
  });

  return getApproval(db, teamId, approvalId);
}

/**
 * Resubmits as a NEW revision (from Changes Requested, or to request re-approval of an Approved one).
 * The revision number increments, the status returns to Awaiting, the current decision is cleared
 * from the approval (the earlier one stays on its revision and in history), a linked file is
 * refreshed to its current version, a linked task to its current client title, the due date is kept
 * and the approver is notified. A free-form item takes its edited description; the earlier text is
 * kept under "Earlier revisions".
 */
export async function resubmitApproval(input: {
  teamId: string;
  approvalId: string;
  actor: AuditActor;
  description?: string;
}): Promise<ApprovalView> {
  const { teamId, approvalId, actor } = input;

  const afterCommit: Array<() => Promise<void>> = [];
  await withTransaction(async tx => {
    const approval = await lockApproval(tx, teamId, approvalId);
    if (approval.status !== "changes_requested" && approval.status !== "approved") {
      throw conflict("Only an approval with changes requested, or an approved one, can be resubmitted", "NOT_RESUBMITTABLE");
    }
    const revision = approval.revision + 1;

    let snapshot: LinkedSnapshot;
    let descriptionNote = "";
    if (approval.linked_type === "freeform") {
      const edited = input.description === undefined ? null : cleanPortalRichText(input.description, 2000, "The description");
      const next = edited ?? approval.freeform_description ?? "";
      descriptionNote = next === (approval.freeform_description ?? "") ? " (description kept the same)" : " (description updated)";
      snapshot = {
        type: "freeform",
        fileId: null,
        fileVersion: null,
        milestoneId: null,
        taskId: null,
        itemName: approval.item_name,
        taskKey: null,
        description: next || null,
      };
    } else {
      const link =
        approval.linked_type === "file"
          ? { type: "file" as const, id: approval.linked_file_id }
          : approval.linked_type === "milestone"
            ? { type: "milestone" as const, id: approval.linked_milestone_id }
            : { type: "task" as const, id: approval.linked_task_id };
      if (!link.id) throw badRequest("The linked item no longer exists", "INVALID_LINK");
      snapshot = await snapshotExistingItem(tx, teamId, approval.project_id, link);
    }

    await tx.query(
      `UPDATE client_portal_approvals
          SET status = 'awaiting', revision = $2, linked_file_version = $3, item_name = $4,
              item_task_key = $5, freeform_description = $6, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1`,
      [approvalId, revision, snapshot.fileVersion, snapshot.itemName, snapshot.taskKey, snapshot.description]
    );
    await tx.query(
      `INSERT INTO client_portal_approval_revisions (approval_id, revision, file_version, item_name, description_snapshot)
       VALUES ($1, $2, $3, $4, $5)`,
      [approvalId, revision, snapshot.fileVersion, snapshot.itemName, snapshot.description]
    );

    const versionNote = snapshot.fileVersion ? ` v${snapshot.fileVersion}` : "";
    await addEvent(tx, approvalId, revision, "internal", actor.name, `Resubmitted as revision ${revision}: ${snapshot.itemName}${versionNote}${descriptionNote}`);
    await addEvent(tx, approvalId, revision, "internal", "System", `${approval.approver_name} notified by email and in the portal`);

    await recordAuditEvent(tx, {
      teamId,
      event: "Approval requested",
      actor,
      clientId: approval.client_id,
      clientName: approval.client_name,
      projectId: approval.project_id,
      targetType: "approval",
      targetId: approvalId,
      targetLabel: `${approval.ref_no} · ${approval.title}`,
      metadata: { revision },
    });

    afterCommit.push(() => notifyApprover({
      teamId,
      clientId: approval.client_id,
      projectId: approval.project_id,
      approvalId,
      approverIds: approval.approver_ids,
      title: approval.title,
      refNo: approval.ref_no,
      dueDate: approval.due_date,
      revision,
    }));
  });

  runAfterCommit(afterCommit);
  return getApproval(db, teamId, approvalId);
}

/**
 * Records the client's decision. Mutually exclusive and idempotent: the first decision on the current
 * revision wins and a repeated request changes nothing. Only a named approver who is also a Client
 * Admin can decide (spec #2522), and only while the approval is Awaiting. Asking for changes wants a
 * comment: without one the client must confirm explicitly (`confirmEmpty`), which the app asks once.
 *
 * Writes the audit event (`Approval: approved` / `Approval: changes requested`) and notifies staff,
 * deep-linked to the approval.
 */
export async function recordApprovalDecision(input: {
  teamId: string;
  approvalId: string;
  subject: ClientSubject;
  outcome: ApprovalOutcome;
  comment?: string;
  /** The client chose "Request changes without a comment" after being asked once. */
  confirmEmpty?: boolean;
}): Promise<{ recorded: boolean }> {
  const { teamId, approvalId, subject, outcome } = input;
  if (outcome !== "approved" && outcome !== "changes_requested") throw badRequest("Invalid decision");
  const comment = cleanPortalRichText(input.comment, 2000, "The comment");
  const commentText = htmlToPlainText(comment);
  if (outcome === "changes_requested" && !comment && input.confirmEmpty !== true) {
    throw badRequest("Say what needs to change, or confirm you want to send it without a comment", "COMMENT_REQUIRED");
  }
  // Naming someone as approver is not enough: deciding is a Client Admin capability.
  if (!clientRoleCan(subject.role, "approve")) {
    throw forbidden("Only a Client Admin can decide an approval", "ROLE_FORBIDDEN");
  }

  let notification: { title: string; body: string; id: string; projectId: string } | null = null;

  const recorded = await withTransaction(async tx => {
    const approval = await lockApproval(tx, teamId, approvalId);

    // A client only ever sees an approval of their own organization that is not a draft.
    if (approval.client_id !== subject.clientId || approval.status === "draft") throw notFound("Approval");
    // Access is re-checked on every decision: a contact whose project assignment was removed, or whose
    // project had its Client Portal switch turned off, can no longer approve (404, like every other path).
    await assertSubjectProject(tx, subject, approval.project_id);
    if (!(approval.approver_ids ?? []).includes(subject.contactId)) {
      throw forbidden("Only a named approver can decide this approval", "NOT_THE_APPROVER");
    }
    // Idempotent: anything but Awaiting means a decision was already recorded (or it was cancelled).
    if (approval.status !== "awaiting") return false;

    const decided = await tx.query(
      `UPDATE client_portal_approval_revisions
          SET outcome = $3, decided_by_contact_id = $4, decided_by_name = $5, decided_at = NOW(), comment = $6
        WHERE approval_id = $1 AND revision = $2 AND outcome IS NULL
      RETURNING item_name, file_version`,
      [approvalId, approval.revision, outcome, subject.contactId, subject.name, comment]
    );
    if (decided.rows.length === 0) return false;

    await tx.query(`UPDATE client_portal_approvals SET status = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [
      approvalId,
      outcome,
    ]);

    const reference = decisionReference({
      type: approval.linked_type,
      name: decided.rows[0].item_name,
      file_version: decided.rows[0].file_version,
      revision: approval.revision,
    });
    const verb = outcome === "approved" ? "Approved" : "Requested changes";
    await addEvent(
      tx,
      approvalId,
      approval.revision,
      "client",
      subject.name,
      commentText ? `${verb}: "${commentText}" (${reference})` : `${verb} (${reference})`
    );

    await recordAuditEvent(tx, {
      teamId,
      event: outcome === "approved" ? "Approval: approved" : "Approval: changes requested",
      actor: { side: "client", name: subject.name, contactId: subject.contactId },
      clientId: approval.client_id,
      clientName: approval.client_name,
      projectId: approval.project_id,
      targetType: "approval",
      targetId: approvalId,
      targetLabel: `${approval.ref_no} · ${approval.title}`,
      metadata: { revision: approval.revision, reference },
    });

    notification = {
      id: approvalId,
      projectId: approval.project_id,
      title:
        outcome === "approved"
          ? `${subject.name} approved ${approval.ref_no}`
          : `Changes requested on ${approval.ref_no}`,
      body: commentText ? `${subject.name}: ${commentText}` : `${subject.name} · ${approval.title}`,
    };
    return true;
  });

  if (notification) {
    const n = notification as { title: string; body: string; id: string; projectId: string };
    void notifyStaff({
      teamId,
      kind: "Approval",
      title: n.title,
      body: n.body,
      url: `/worklenz/client-portal/approvals/${n.id}`,
      projectId: n.projectId,
      emailEvent: "approval_decision",
    });
  }

  return { recorded };
}
