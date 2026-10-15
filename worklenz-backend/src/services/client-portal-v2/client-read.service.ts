import { forbidden, notFound } from "./errors";
import { EFFECTIVE_MILESTONES_SQL, getMilestoneSource, listPhaseMilestones } from "./milestone-source";
import { WORKLENZ_PROGRESS_SQL } from "./projects.service";
import { assertSubjectProject, changeRequestVisibleSql, fileClientVisibleSql, getSubjectProjectIds, milestoneClientVisibleSql, taskClientVisibleSql } from "./scope";
import { ClientSubject } from "./subject";
import { clientRoleCan } from "../../shared/client-portal-permissions";
import { getPortalSettingsV2 } from "./settings.service";
import { Queryable } from "./types";

/**
 * What a client user may read, and the ONLY place client payloads are built.
 *
 * Every function takes the resolved `ClientSubject` and starts from the projects that subject can
 * currently open (assigned, portal on, same organization). Items are then filtered by their own
 * visibility, and the response is assembled from an explicit allow-list of fields. Nothing here
 * selects `*` or spreads a database row, so a column added to a table later can never leak.
 *
 * Never part of any client payload, whatever the visibility: time estimates and logs, costs and
 * billing rates, dependencies, internal comments, internal notes, assignees, internal assessments,
 * internal milestone notes, and the hidden items themselves (which are not even counted).
 *
 * The staff-side "Preview as client" calls these same functions with the previewed user as subject.
 */

const TASK_STATUS_CLIENT = { todo: "not_started", in_progress: "in_progress", done: "done" } as const;

export interface ClientProjectDto {
  id: string;
  name: string;
  status: "on_track" | "at_risk" | "on_hold" | "completed";
  phase: string | null;
  progress: number;
  start_date: string | null;
  /** Null renders as "Not set": the portal never invents a date. */
  expected_completion: string | null;
  primary_contact: string | null;
  summary: string;
  latest_update: { body: string; published_at: string } | null;
  shared_counts: { milestones: number; tasks: number; files: number };
  allow_uploads: boolean;
  /** Approvals awaiting a decision and change requests still open on this project, for the project list. */
  open_approvals: number;
  open_change_requests: number;
  contact_email: string | null;
  /** The project's colour, for its progress bar and avatar. */
  color: string | null;
}

const idsOrEmpty = async (q: Queryable, subject: ClientSubject): Promise<string[]> =>
  getSubjectProjectIds(q, subject);

export async function listClientProjects(q: Queryable, subject: ClientSubject): Promise<ClientProjectDto[]> {
  const projectIds = await idsOrEmpty(q, subject);
  if (projectIds.length === 0) return [];

  const result = await q.query(
    `SELECT p.id, p.name, pcs.client_status, pcs.current_phase,
            CASE WHEN pcs.progress_source = 'manual' THEN pcs.manual_progress ELSE ${WORKLENZ_PROGRESS_SQL} END AS progress,
            -- Dates follow the progress source: the WorkLenz project's own, or the ones set by hand.
            CASE WHEN pcs.progress_source = 'manual' THEN pcs.start_date::text ELSE p.start_date::date::text END AS start_date,
            CASE WHEN pcs.progress_source = 'manual' THEN pcs.expected_completion::text ELSE p.end_date::date::text END AS expected_completion,
            pcs.client_summary, pcs.allow_client_uploads, p.color_code AS color,
            u.name AS contact_name, u.email AS contact_email,
            (SELECT COUNT(*)::int FROM client_portal_approvals ap
              WHERE ap.project_id = p.id AND ap.client_id = $2 AND ap.status = 'awaiting') AS open_approvals,
            (SELECT COUNT(*)::int FROM client_portal_change_requests cr
              WHERE cr.project_id = p.id AND cr.client_id = $2 AND ${changeRequestVisibleSql("cr", "$3", "$4")}
                AND cr.status IN ('submitted', 'under_review', 'more_info')) AS open_change_requests,
            lu.body AS update_body, lu.published_at AS update_at,
            (SELECT COUNT(*)::int FROM ${EFFECTIVE_MILESTONES_SQL} m
              WHERE m.project_id = p.id AND ${milestoneClientVisibleSql("m")}) AS milestones_shared,
            (SELECT COUNT(*)::int FROM tasks t
              WHERE t.project_id = p.id AND ${taskClientVisibleSql("t")}) AS tasks_shared,
            (SELECT COUNT(*)::int FROM project_files pf
              WHERE pf.project_id = p.id AND ${fileClientVisibleSql("pf")}) AS files_shared
       FROM projects p
       JOIN project_client_settings pcs ON pcs.project_id = p.id
       LEFT JOIN team_members tm ON tm.id = pcs.primary_contact_member_id
       LEFT JOIN users u ON u.id = tm.user_id
       LEFT JOIN LATERAL (
         SELECT pu.body, pu.published_at FROM project_client_updates pu
          WHERE pu.project_id = p.id ORDER BY pu.published_at DESC LIMIT 1
       ) lu ON TRUE
      WHERE p.id = ANY($1::uuid[])
      ORDER BY p.name`,
    [projectIds, subject.clientId, subject.contactId, subject.role]
  );

  return result.rows.map(row => ({
    id: row.id,
    name: row.name,
    status: row.client_status,
    phase: row.current_phase ?? null,
    progress: row.progress ?? 0,
    start_date: row.start_date ?? null,
    expected_completion: row.expected_completion ?? null,
    primary_contact: row.contact_name ?? null,
    summary: row.client_summary ?? "",
    latest_update: row.update_body ? { body: row.update_body, published_at: row.update_at } : null,
    shared_counts: { milestones: row.milestones_shared, tasks: row.tasks_shared, files: row.files_shared },
    allow_uploads: row.allow_client_uploads === true && clientRoleCan(subject.role, "upload"),
    open_approvals: row.open_approvals ?? 0,
    open_change_requests: row.open_change_requests ?? 0,
    contact_email: row.contact_email ?? null,
    color: row.color ?? null,
  }));
}

export interface ClientProjectListParams {
  page: number;
  size: number;
  search?: string;
  sort?: string;
  order?: "asc" | "desc";
  status?: string[];
  phase?: string[];
}

const PROJECT_SORT_KEYS = ["name", "status", "phase", "progress", "expected_completion"] as const;
const PROJECT_PAGE_SIZES = [10, 20, 50, 100];

/**
 * The same projects as `listClientProjects`, filtered, ordered and cut to one page. The list is already
 * scoped to what the subject may open, so filtering it in memory never widens access.
 */
export async function listClientProjectsPaged(
  q: Queryable,
  subject: ClientSubject,
  params: ClientProjectListParams
): Promise<{ data: ClientProjectDto[]; total: number; phases: string[] }> {
  const all = await listClientProjects(q, subject);
  const phases = Array.from(new Set(all.map(project => project.phase).filter((value): value is string => Boolean(value)))).sort((a, b) => a.localeCompare(b));
  const search = (params.search ?? "").trim().toLowerCase();
  const status = params.status ?? [];
  const phase = params.phase ?? [];
  const filtered = all.filter(
    project =>
      (status.length === 0 || status.includes(project.status)) &&
      (phase.length === 0 || (project.phase !== null && phase.includes(project.phase))) &&
      (search === "" ||
        [project.name, project.phase, project.primary_contact].some(value => (value ?? "").toLowerCase().includes(search)))
  );

  const sortKey = (PROJECT_SORT_KEYS as readonly string[]).includes(params.sort ?? "") ? (params.sort as (typeof PROJECT_SORT_KEYS)[number]) : "name";
  const direction = params.order === "desc" ? -1 : 1;
  const compare = (a: ClientProjectDto, b: ClientProjectDto): number => {
    const left = a[sortKey];
    const right = b[sortKey];
    if (left === right) return 0;
    if (left === null || left === undefined) return 1;
    if (right === null || right === undefined) return -1;
    if (typeof left === "number" && typeof right === "number") return (left - right) * direction;
    return String(left).localeCompare(String(right)) * direction;
  };
  filtered.sort((a, b) => compare(a, b) || a.name.localeCompare(b.name));

  const size = PROJECT_PAGE_SIZES.includes(params.size) ? params.size : 10;
  const page = Math.max(1, Math.floor(params.page) || 1);
  return { data: filtered.slice((page - 1) * size, page * size), total: filtered.length, phases };
}

export async function getClientProject(q: Queryable, subject: ClientSubject, projectId: string) {
  await assertSubjectProject(q, subject, projectId);
  const projects = await listClientProjects(q, subject);
  const project = projects.find(item => item.id === projectId);
  if (!project) throw notFound("Project");
  return project;
}

export interface ClientMilestoneDto {
  id: string;
  name: string;
  description: string;
  target_date: string;
  status: "upcoming" | "in_progress" | "completed" | "delayed";
  completed_at: string | null;
  completion_note: string;
  /** A Delayed milestone shows the moved date and a neutral line, never the internal reason. */
  date_moved: boolean;
  linked_tasks: Array<{ id: string; title: string }>;
  linked_files: Array<{ id: string; name: string }>;
}

export async function listClientMilestones(
  q: Queryable,
  subject: ClientSubject,
  projectId: string
): Promise<ClientMilestoneDto[]> {
  await assertSubjectProject(q, subject, projectId);

  // On WorkLenz milestones the client sees the project's phases with their real dates.
  if ((await getMilestoneSource(q, projectId)) === "worklenz") {
    const phases = await listPhaseMilestones(q, projectId);
    return phases.map(phase => ({
      id: phase.id,
      name: phase.name,
      description: "",
      target_date: phase.target_date,
      status: phase.status,
      completed_at: phase.completed_at,
      completion_note: "",
      date_moved: false,
      linked_tasks: [],
      linked_files: [],
    }));
  }

  const result = await q.query(
    `SELECT m.id, m.name, m.description, m.target_date::text AS target_date, m.status,
            m.completed_at::text AS completed_at, m.completion_note,
            COALESCE((SELECT json_agg(json_build_object('id', t.id, 'title', COALESCE(NULLIF(cts.client_title, ''), t.name)) ORDER BY t.task_no)
                        FROM client_portal_milestone_links l
                        JOIN tasks t ON t.id = l.task_id
                        JOIN client_portal_task_settings cts ON cts.task_id = t.id AND cts.visibility = 'client'
                       WHERE l.milestone_id = m.id AND t.archived IS FALSE), '[]'::json) AS linked_tasks,
            COALESCE((SELECT json_agg(json_build_object('id', pf.id, 'name', pf.name) ORDER BY pf.name)
                        FROM client_portal_milestone_links l
                        JOIN project_files pf ON pf.id = l.file_id AND ${fileClientVisibleSql("pf")}
                       WHERE l.milestone_id = m.id), '[]'::json) AS linked_files
       FROM client_portal_milestones m
      WHERE m.project_id = $1 AND ${milestoneClientVisibleSql("m")}
      ORDER BY m.target_date, m.created_at`,
    [projectId]
  );

  return result.rows.map(row => ({
    id: row.id,
    name: row.name,
    description: row.description,
    target_date: row.target_date,
    status: row.status,
    completed_at: row.completed_at ?? null,
    completion_note: row.status === "completed" ? row.completion_note : "",
    date_moved: row.status === "delayed",
    linked_tasks: row.linked_tasks,
    linked_files: row.linked_files,
  }));
}

export interface ClientTaskDto {
  id: string;
  key: string;
  title: string;
  description: string;
  status: "not_started" | "in_progress" | "done";
  due_date: string | null;
  attachments: Array<{ id: string; name: string; version: number }>;
}

export async function listClientTasks(q: Queryable, subject: ClientSubject, projectId: string): Promise<ClientTaskDto[]> {
  await assertSubjectProject(q, subject, projectId);

  const result = await q.query(
    `SELECT t.id, (p.key || '-' || t.task_no::text) AS key,
            COALESCE(NULLIF(cts.client_title, ''), t.name) AS title,
            cts.client_description AS description,
            CASE WHEN stc.is_done THEN 'done' WHEN stc.is_doing THEN 'in_progress' ELSE 'todo' END AS status,
            t.end_date::date::text AS due_date,
            COALESCE((SELECT json_agg(json_build_object('id', pf.id, 'name', pf.name, 'version', pf.current_version) ORDER BY pf.name)
                        FROM client_portal_task_files tf
                        JOIN project_files pf ON pf.id = tf.file_id AND ${fileClientVisibleSql("pf")}
                       WHERE tf.task_id = t.id), '[]'::json) AS attachments
       FROM tasks t
       JOIN projects p ON p.id = t.project_id
       JOIN client_portal_task_settings cts ON cts.task_id = t.id AND cts.visibility = 'client'
       JOIN task_statuses ts ON ts.id = t.status_id
       JOIN sys_task_status_categories stc ON stc.id = ts.category_id
      WHERE t.project_id = $1 AND t.archived IS FALSE
      ORDER BY t.task_no`,
    [projectId]
  );

  return result.rows.map(row => ({
    id: row.id,
    key: row.key,
    title: row.title,
    description: row.description ?? "",
    status: TASK_STATUS_CLIENT[row.status as keyof typeof TASK_STATUS_CLIENT],
    due_date: row.due_date ?? null,
    attachments: row.attachments,
  }));
}

export interface ClientFileDto {
  id: string;
  name: string;
  category: string;
  version: number;
  size_label: string;
  uploaded_at: string;
  /** "Client upload" for a file the client added themselves. */
  source: "team" | "client";
  /** Who uploaded the current version, as a display name. */
  uploaded_by: string;
  /** How many versions the file has, counting the first. */
  version_count: number;
}

const formatBytes = (bytes: number): string => {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 KB";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
};

export async function listClientFiles(q: Queryable, subject: ClientSubject, projectId: string): Promise<ClientFileDto[]> {
  await assertSubjectProject(q, subject, projectId);

  const result = await q.query(
    `SELECT pf.id, pf.name, pf.category, pf.current_version, pf.size, pf.uploaded_by_side,
            COALESCE(lv.created_at, pf.created_at) AS uploaded_at,
            COALESCE(NULLIF(lv.uploaded_by_name, ''), NULLIF(pf.uploaded_by_name, ''), u.name, '') AS uploaded_by,
            GREATEST(1, (1 + COALESCE(vc.n, 0)) - (COALESCE(pf.first_shared_version, 1) - 1)) AS version_count
       FROM project_files pf
       LEFT JOIN users u ON u.id = pf.uploaded_by
       LEFT JOIN LATERAL (
         SELECT v.created_at, v.uploaded_by_name FROM project_file_versions v
          WHERE v.file_id = pf.id AND v.status = 'active' ORDER BY v.version_no DESC LIMIT 1
       ) lv ON TRUE
       LEFT JOIN LATERAL (
         SELECT COUNT(*)::int AS n FROM project_file_versions v WHERE v.file_id = pf.id AND v.status = 'active'
       ) vc ON TRUE
      WHERE pf.project_id = $1 AND ${fileClientVisibleSql("pf")}
      ORDER BY pf.created_at DESC`,
    [projectId]
  );

  return result.rows.map(row => ({
    id: row.id,
    name: row.name,
    category: row.category,
    version: row.current_version,
    size_label: formatBytes(Number(row.size)),
    uploaded_at: row.uploaded_at,
    source: row.uploaded_by_side,
    uploaded_by: row.uploaded_by ?? "",
    version_count: row.version_count ?? 1,
  }));
}

export interface ClientApprovalDto {
  id: string;
  ref_no: string;
  project_id: string;
  project_name: string;
  title: string;
  status: "awaiting" | "approved" | "changes_requested" | "cancelled";
  revision: number;
  linked_item: {
    type: "file" | "milestone" | "task" | "freeform";
    name: string;
    task_key: string | null;
    file_version: number | null;
    description: string | null;
    /** False once the linked file, milestone or task was made Internal Only: the client sees "No longer shared". */
    available: boolean;
    /** The linked file, milestone or task, for the "Open ..." button. Null for a free-form approval. */
    id: string | null;
    /** The file's current version, so the page can say "this approval covers v3, the file is now v4". */
    current_file_version: number | null;
  };
  instructions: string;
  due_date: string | null;
  is_overdue: boolean;
  /**
   * Only the named approver who is also a Client Admin, while the approval is Awaiting. Everyone else
   * sees it read-only. Enforced again by recordApprovalDecision: this flag only chooses what to render.
   */
  can_decide: boolean;
  approver_name: string;
  requested_by: string;
  /** When the team requested the approval, and when it last changed. */
  requested_at: string;
  updated_at: string;
  decision: { outcome: string; decided_by: string; decided_at: string; comment: string } | null;
}

export async function listClientApprovals(q: Queryable, subject: ClientSubject): Promise<ClientApprovalDto[]> {
  const projectIds = await idsOrEmpty(q, subject);
  if (projectIds.length === 0) return [];

  // A Draft is never visible to a client and is excluded from every client count.
  const result = await q.query(
    `SELECT a.id, a.ref_no, a.project_id, p.name AS project_name, a.title, a.status, a.revision,
            a.linked_type, a.item_name, a.item_task_key, a.linked_file_version, a.freeform_description,
            a.instructions, a.due_date::text AS due_date, a.created_by_name, a.created_at AS requested_at, a.updated_at,
            a.linked_file_id, a.linked_milestone_id, a.linked_task_id, pf.current_version AS current_file_version,
            COALESCE((SELECT string_agg(ap.contact_name, ', ' ORDER BY ap.position)
                        FROM client_portal_approval_approvers ap WHERE ap.approval_id = a.id), a.approver_name) AS approver_names,
            EXISTS (SELECT 1 FROM client_portal_approval_approvers ap
                     WHERE ap.approval_id = a.id AND ap.contact_id = $3) AS is_approver,
            (a.status = 'awaiting' AND a.due_date IS NOT NULL AND a.due_date < CURRENT_DATE) AS is_overdue,
            CASE a.linked_type
              WHEN 'file'      THEN COALESCE(pf.portal_visibility = 'client' AND pf.status = 'active', FALSE)
              WHEN 'milestone' THEN COALESCE(ms.visibility = 'client', FALSE)
              WHEN 'task'      THEN COALESCE(cts.visibility = 'client', FALSE)
              ELSE TRUE
            END AS item_available,
            rev.outcome, rev.decided_by_name, rev.decided_at, rev.comment AS decision_comment
       FROM client_portal_approvals a
       JOIN projects p ON p.id = a.project_id
       LEFT JOIN project_files pf ON pf.id = a.linked_file_id
       LEFT JOIN client_portal_milestones ms ON ms.id = a.linked_milestone_id
       LEFT JOIN client_portal_task_settings cts ON cts.task_id = a.linked_task_id
       LEFT JOIN client_portal_approval_revisions rev ON rev.approval_id = a.id AND rev.revision = a.revision
      WHERE a.project_id = ANY($1::uuid[])
        AND a.client_id = $2
        AND a.status <> 'draft'
      ORDER BY a.ref_no DESC`,
    [projectIds, subject.clientId, subject.contactId]
  );

  return result.rows.map(row => ({
    id: row.id,
    ref_no: row.ref_no,
    project_id: row.project_id,
    project_name: row.project_name,
    title: row.title,
    status: row.status,
    revision: row.revision,
    linked_item: {
      type: row.linked_type,
      name: row.item_name,
      task_key: row.item_task_key ?? null,
      file_version: row.linked_file_version ?? null,
      description: row.linked_type === "freeform" ? row.freeform_description ?? "" : null,
      available: row.item_available === true,
      id: row.linked_file_id ?? row.linked_milestone_id ?? row.linked_task_id ?? null,
      current_file_version: row.linked_type === "file" ? row.current_file_version ?? null : null,
    },
    instructions: row.instructions,
    due_date: row.due_date ?? null,
    is_overdue: row.is_overdue === true,
    // Being named is not enough: deciding is a Client Admin capability (spec #2522).
    can_decide: row.status === "awaiting" && row.is_approver === true && clientRoleCan(subject.role, "approve"),
    approver_name: row.approver_names ?? "",
    requested_by: row.created_by_name ?? "",
    requested_at: row.requested_at,
    updated_at: row.updated_at,
    decision: row.outcome
      ? { outcome: row.outcome, decided_by: row.decided_by_name, decided_at: row.decided_at, comment: row.decision_comment ?? "" }
      : null,
  }));
}

export interface ClientChangeRequestDto {
  id: string;
  cr_no: string;
  project_id: string;
  project_name: string;
  title: string;
  description: string;
  notes: string;
  attachments: string[];
  priority: "low" | "medium" | "high";
  status: string;
  submitted_at: string;
  requester_name: string;
  /** Last change to the request, and when it was closed (completed, rejected or cancelled). */
  updated_at: string;
  closed_at: string | null;
  /** Null when staff set none. The client never sees 0 unless staff entered 0. */
  estimate: { hours: number | null; cost: number | null } | null;
  response: string;
  /** True when the request is waiting on this user's reply (More Information Required, and they are the requester). */
  needs_your_reply: boolean;
}

export async function listClientChangeRequests(q: Queryable, subject: ClientSubject): Promise<ClientChangeRequestDto[]> {
  const projectIds = await idsOrEmpty(q, subject);
  if (projectIds.length === 0) return [];

  // Allow-list only: no assignee, no internal assessment, no linked task, no billing.
  const result = await q.query(
    `SELECT r.id, r.cr_no, r.project_id, p.name AS project_name, r.title, r.description, r.notes, r.priority,
            r.status, r.submitted_at, r.requester_name, r.requester_contact_id, r.updated_at, r.closed_at,
            r.estimate_hours::float AS estimate_hours, r.estimate_cost::float AS estimate_cost, r.response,
            COALESCE((SELECT array_agg(att.file_name ORDER BY att.created_at)
                        FROM client_portal_change_request_attachments att WHERE att.change_request_id = r.id), '{}') AS attachments
       FROM client_portal_change_requests r
       JOIN projects p ON p.id = r.project_id
      WHERE r.project_id = ANY($1::uuid[]) AND r.client_id = $2 AND ${changeRequestVisibleSql("r", "$3", "$4")}
      ORDER BY r.submitted_at DESC`,
    [projectIds, subject.clientId, subject.contactId, subject.role]
  );

  return result.rows.map(row => ({
    id: row.id,
    cr_no: row.cr_no,
    project_id: row.project_id,
    project_name: row.project_name,
    title: row.title,
    description: row.description,
    notes: row.notes,
    attachments: row.attachments ?? [],
    priority: row.priority,
    status: row.status,
    submitted_at: row.submitted_at,
    requester_name: row.requester_name,
    updated_at: row.updated_at,
    closed_at: row.closed_at ?? null,
    estimate:
      row.estimate_hours != null || row.estimate_cost != null
        ? { hours: row.estimate_hours ?? null, cost: row.estimate_cost ?? null }
        : null,
    response: row.response,
    needs_your_reply: row.status === "more_info" && row.requester_contact_id === subject.contactId,
  }));
}

export interface ClientDashboardDto {
  active_projects: number;
  pending_actions: number;
  upcoming_milestones: Array<{ id: string; name: string; project_id: string; project_name: string; target_date: string; status: string }>;
  needs_action: Array<{ kind: "approval" | "change_request"; id: string; ref_no: string; title: string; project_name: string; due_date: string | null }>;
  projects: ClientProjectDto[];
  /** Approvals this person is not the one to decide, so they can see who the team is waiting on. */
  waiting_on_others: Array<{ id: string; ref_no: string; title: string; waiting_for: string }>;
  /** The latest things that happened on their projects, newest first. Each is filtered by the same visibility rules. */
  recent_activity: ClientActivityDto[];
  /** Only present when the operator turned Invoices on for the portal. */
  unpaid_amount?: number;
}

export type ClientTargetDto =
  | { page: "approval"; id: string }
  | { page: "change_request"; id: string }
  | { page: "project"; projectId: string }
  | { page: "milestone"; projectId: string; id: string }
  | { page: "task"; projectId: string; id: string }
  | { page: "file"; projectId: string; id: string }
  | { page: "thread"; projectId: string; id: string };

export interface ClientActivityDto {
  id: string;
  kind: "approval" | "file" | "project" | "milestone" | "comment" | "change_request";
  text: string;
  at: string;
  target: ClientTargetDto;
}

const ACTIVITY_LIMIT = 6;
// Approval and change request events that belong to the team's own working notes, not to the client.
const INTERNAL_APPROVAL_EVENT_SQL = `NOT (ev.actor_name = 'System' OR ev.text LIKE 'Draft created%')`;
const INTERNAL_REQUEST_EVENT_SQL = `ev.text NOT LIKE '%work item%'`;

/**
 * The newest activity on the client's projects, assembled from client-visible sources only: published
 * project updates, shared files, milestones, and the history of their own approvals and change
 * requests. Nothing here selects an internal comment, a draft or an Internal Only item.
 */
export async function listRecentActivity(
  q: Queryable,
  subject: ClientSubject,
  projectIds: string[]
): Promise<ClientActivityDto[]> {
  if (projectIds.length === 0) return [];

  const [updates, files, milestones, approvals, requests] = await Promise.all([
    q.query(
      `SELECT u.id, u.project_id, p.name AS project_name, u.published_at AS at
         FROM project_client_updates u JOIN projects p ON p.id = u.project_id
        WHERE u.project_id = ANY($1::uuid[]) ORDER BY u.published_at DESC LIMIT ${ACTIVITY_LIMIT}`,
      [projectIds]
    ),
    q.query(
      `SELECT pf.id, pf.project_id, pf.name, pf.current_version,
              COALESCE(lv.created_at, pf.created_at) AS at
         FROM project_files pf
         LEFT JOIN LATERAL (
           SELECT v.created_at FROM project_file_versions v
            WHERE v.file_id = pf.id AND v.status = 'active' ORDER BY v.version_no DESC LIMIT 1
         ) lv ON TRUE
        WHERE pf.project_id = ANY($1::uuid[]) AND ${fileClientVisibleSql("pf")}
        ORDER BY COALESCE(lv.created_at, pf.created_at) DESC LIMIT ${ACTIVITY_LIMIT}`,
      [projectIds]
    ),
    q.query(
      `SELECT m.id, m.project_id, m.name, m.status, COALESCE(m.completed_at::timestamptz, m.updated_at) AS at
         FROM client_portal_milestones m
        WHERE m.project_id = ANY($1::uuid[]) AND ${milestoneClientVisibleSql("m")} AND m.status IN ('completed', 'delayed')
        ORDER BY COALESCE(m.completed_at::timestamptz, m.updated_at) DESC LIMIT ${ACTIVITY_LIMIT}`,
      [projectIds]
    ),
    q.query(
      `SELECT ev.id, a.id AS approval_id, a.ref_no, ev.actor_name, ev.text, ev.created_at AS at
         FROM client_portal_approval_events ev
         JOIN client_portal_approvals a ON a.id = ev.approval_id
        WHERE a.project_id = ANY($1::uuid[]) AND a.client_id = $2 AND a.status <> 'draft' AND ${INTERNAL_APPROVAL_EVENT_SQL}
        ORDER BY ev.created_at DESC LIMIT ${ACTIVITY_LIMIT}`,
      [projectIds, subject.clientId]
    ),
    q.query(
      `SELECT ev.id, r.id AS request_id, r.cr_no, ev.actor_name, ev.text, ev.created_at AS at
         FROM client_portal_change_request_events ev
         JOIN client_portal_change_requests r ON r.id = ev.change_request_id
        WHERE r.project_id = ANY($1::uuid[]) AND r.client_id = $2 AND ${changeRequestVisibleSql("r", "$3", "$4")}
          AND ${INTERNAL_REQUEST_EVENT_SQL}
        ORDER BY ev.created_at DESC LIMIT ${ACTIVITY_LIMIT}`,
      [projectIds, subject.clientId, subject.contactId, subject.role]
    ),
  ]);

  const items: ClientActivityDto[] = [
    ...updates.rows.map(row => ({
      id: `update-${row.id}`,
      kind: "project" as const,
      text: `New update on ${row.project_name}`,
      at: row.at,
      target: { page: "project" as const, projectId: row.project_id },
    })),
    ...files.rows.map(row => ({
      id: `file-${row.id}`,
      kind: "file" as const,
      text: `${row.name} (v${row.current_version}) was shared`,
      at: row.at,
      target: { page: "file" as const, projectId: row.project_id, id: row.id },
    })),
    ...milestones.rows.map(row => ({
      id: `milestone-${row.id}`,
      kind: "milestone" as const,
      text: row.status === "completed" ? `Milestone completed: ${row.name}` : `${row.name} is now Delayed`,
      at: row.at,
      target: { page: "milestone" as const, projectId: row.project_id, id: row.id },
    })),
    ...approvals.rows.map(row => ({
      id: `approval-${row.id}`,
      kind: "approval" as const,
      text: `${row.ref_no}: ${row.actor_name} ${row.text}`,
      at: row.at,
      target: { page: "approval" as const, id: row.approval_id },
    })),
    ...requests.rows.map(row => ({
      id: `change-request-${row.id}`,
      kind: "change_request" as const,
      text: `${row.cr_no}: ${row.text}`,
      at: row.at,
      target: { page: "change_request" as const, id: row.request_id },
    })),
  ];

  return items
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, ACTIVITY_LIMIT);
}

/** What this person's organization still owes on invoices. Only read when the operator turned invoices on. */
async function getUnpaidAmount(q: Queryable, subject: ClientSubject): Promise<number> {
  const result = await q.query(
    `SELECT COALESCE(SUM(GREATEST(i.amount - COALESCE(i.paid_amount, 0), 0)), 0)::float AS unpaid
       FROM client_portal_invoices i
      WHERE i.client_id = $1 AND i.organization_team_id = $2 AND i.deleted_at IS NULL
        AND i.status NOT IN ('draft', 'cancelled') AND COALESCE(i.payment_status, '') <> 'paid'`,
    [subject.clientId, subject.teamId]
  );
  return result.rows[0]?.unpaid ?? 0;
}

/**
 * The client's dashboard: only assigned, portal-enabled projects. "Active projects" excludes Completed
 * ones; "Pending actions" counts approvals this user can decide plus change requests waiting on their reply.
 */
export async function getClientDashboard(q: Queryable, subject: ClientSubject): Promise<ClientDashboardDto> {
  const [projects, approvals, requests, settings] = await Promise.all([
    listClientProjects(q, subject),
    listClientApprovals(q, subject),
    listClientChangeRequests(q, subject),
    getPortalSettingsV2(q, subject.teamId),
  ]);

  const projectIds = projects.map(project => project.id);
  const [recentActivity, unpaid] = await Promise.all([
    listRecentActivity(q, subject, projectIds),
    settings.show_invoices ? getUnpaidAmount(q, subject) : Promise.resolve(undefined),
  ]);
  const milestones =
    projectIds.length === 0
      ? { rows: [] as any[] }
      : await q.query(
          `SELECT m.id, m.name, m.project_id, p.name AS project_name, m.target_date::text AS target_date, m.status
             FROM ${EFFECTIVE_MILESTONES_SQL} m
             JOIN projects p ON p.id = m.project_id
            WHERE m.project_id = ANY($1::uuid[]) AND ${milestoneClientVisibleSql("m")} AND m.status <> 'completed'
            ORDER BY m.target_date
            LIMIT 4`,
          [projectIds]
        );

  const decidable = approvals.filter(approval => approval.can_decide);
  const awaitingReply = requests.filter(request => request.needs_your_reply);

  return {
    active_projects: projects.filter(project => project.status !== "completed").length,
    pending_actions: decidable.length + awaitingReply.length,
    upcoming_milestones: milestones.rows.map(row => ({
      id: row.id,
      name: row.name,
      project_id: row.project_id,
      project_name: row.project_name,
      target_date: row.target_date,
      status: row.status,
    })),
    needs_action: [
      ...decidable.map(approval => ({
        kind: "approval" as const,
        id: approval.id,
        ref_no: approval.ref_no,
        title: approval.title,
        project_name: approval.project_name,
        due_date: approval.due_date,
      })),
      ...awaitingReply.map(request => ({
        kind: "change_request" as const,
        id: request.id,
        ref_no: request.cr_no,
        title: request.title,
        project_name: request.project_name,
        due_date: null,
      })),
    ],
    projects,
    waiting_on_others: approvals
      .filter(approval => approval.status === "awaiting" && !approval.can_decide)
      .map(approval => ({ id: approval.id, ref_no: approval.ref_no, title: approval.title, waiting_for: approval.approver_name })),
    recent_activity: recentActivity,
    ...(unpaid !== undefined ? { unpaid_amount: unpaid } : {}),
  };
}

export interface HiddenSummary {
  milestones: number;
  tasks: number;
  files: number;
  draft_approvals: number;
}

/**
 * Staff-only: what the client cannot see in the projects they can open. Shown in the admin Preview's
 * "Hidden from this view" panel and never reachable from the client router, because a client must not
 * be able to infer these counts from anything in the portal.
 */
export async function getHiddenSummary(q: Queryable, subject: ClientSubject): Promise<HiddenSummary> {
  const projectIds = await idsOrEmpty(q, subject);
  if (projectIds.length === 0) return { milestones: 0, tasks: 0, files: 0, draft_approvals: 0 };

  const result = await q.query(
    `SELECT
       (SELECT COUNT(*)::int FROM client_portal_milestones m
         WHERE m.project_id = ANY($1::uuid[]) AND m.visibility <> 'client') AS milestones,
       (SELECT COUNT(*)::int FROM tasks t
         WHERE t.project_id = ANY($1::uuid[]) AND t.archived IS FALSE
           AND NOT EXISTS (SELECT 1 FROM client_portal_task_settings cts WHERE cts.task_id = t.id AND cts.visibility = 'client')) AS tasks,
       (SELECT COUNT(*)::int FROM project_files pf
         WHERE pf.project_id = ANY($1::uuid[]) AND pf.status = 'active' AND pf.portal_visibility <> 'client') AS files,
       (SELECT COUNT(*)::int FROM client_portal_approvals a
         WHERE a.project_id = ANY($1::uuid[]) AND a.status = 'draft') AS draft_approvals`,
    [projectIds]
  );
  const row = result.rows[0] ?? {};
  return {
    milestones: row.milestones ?? 0,
    tasks: row.tasks ?? 0,
    files: row.files ?? 0,
    draft_approvals: row.draft_approvals ?? 0,
  };
}

export const requireCapability = (subject: ClientSubject, capability: Parameters<typeof clientRoleCan>[1]) => {
  if (!clientRoleCan(subject.role, capability)) {
    throw forbidden("Your role cannot do this", "ROLE_FORBIDDEN");
  }
};
