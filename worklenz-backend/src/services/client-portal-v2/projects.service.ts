import db from "../../config/db";
import { withTransaction } from "../client-contacts-service";
import { badRequest, notFound } from "./errors";
import { htmlToPlainText } from "../../shared/utils";
import { cleanPortalRichText } from "./rich-text";
import { containsPattern, splitList } from "./list-params";
import { EFFECTIVE_MILESTONES_SQL, MilestoneSource, isMilestoneSource } from "./milestone-source";
import { AuditActor } from "./audit.service";
import { notifyClientUsers, notifyStaff } from "./notify.service";
import {
  disableProjectPortal,
  enableProjectPortal,
  ensureProjectSettings,
  getProjectRef,
} from "./project-core";
import { StaffRef, findStaff, toStaffRef } from "./staff";
import { Queryable } from "./types";
import { USER_VIEW_SQL } from "./users.service";

export const CLIENT_PROJECT_STATUSES = ["on_track", "at_risk", "on_hold", "completed"] as const;
export const PROJECT_PHASES = ["Discovery", "Design", "Development", "UAT", "Deployment"] as const;
export type ClientProjectStatus = (typeof CLIENT_PROJECT_STATUSES)[number];
export type ProjectPhase = (typeof PROJECT_PHASES)[number];
export type ProgressSource = "worklenz" | "manual";

/**
 * Progress that follows the project's tasks: the share of its top-level, non-archived tasks that are
 * done. It updates as tasks complete. A manual value does not.
 */
export const WORKLENZ_PROGRESS_SQL = `
  COALESCE((
    SELECT ROUND(100.0 * COUNT(*) FILTER (WHERE stc.is_done) / NULLIF(COUNT(*), 0))::int
      FROM tasks t
      JOIN task_statuses ts ON ts.id = t.status_id
      JOIN sys_task_status_categories stc ON stc.id = ts.category_id
     WHERE t.project_id = p.id AND t.archived IS FALSE AND t.parent_task_id IS NULL
  ), 0)
`;

export interface PortalProjectRow {
  id: string;
  name: string;
  color: string;
  organization_id: string | null;
  organization_name: string | null;
  portal_enabled: boolean;
  status: ClientProjectStatus;
  phase: ProjectPhase | null;
  progress: number;
  next_milestone: { name: string; target_date: string } | null;
  active_client_users: number;
}

const mapProjectRow = (row: any): PortalProjectRow => ({
  id: row.id,
  name: row.name,
  color: row.color,
  organization_id: row.client_id ?? null,
  organization_name: row.client_name ?? null,
  portal_enabled: row.portal_enabled === true,
  status: row.client_status,
  phase: row.current_phase ?? null,
  progress: row.progress ?? 0,
  next_milestone: row.next_milestone_name
    ? { name: row.next_milestone_name, target_date: row.next_milestone_date }
    : null,
  active_client_users: row.active_client_users ?? 0,
});

// $1 = team id. One row per workspace project with its portal fields.
const PROJECT_LIST_SQL = `
  SELECT p.id, p.name, p.color_code AS color, p.client_id,
         COALESCE(NULLIF(TRIM(c.company_name), ''), c.name) AS client_name,
         COALESCE(pcs.portal_enabled, FALSE) AS portal_enabled,
         COALESCE(pcs.client_status, 'on_track') AS client_status,
         pcs.current_phase,
         CASE WHEN pcs.progress_source = 'manual' THEN pcs.manual_progress
              ELSE ${WORKLENZ_PROGRESS_SQL} END AS progress,
         nm.name AS next_milestone_name,
         nm.target_date::text AS next_milestone_date,
         COALESCE(au.n, 0)::int AS active_client_users
    FROM projects p
    LEFT JOIN clients c ON c.id = p.client_id AND c.deleted_at IS NULL
    LEFT JOIN project_client_settings pcs ON pcs.project_id = p.id
    LEFT JOIN LATERAL (
      SELECT m.name, m.target_date
        FROM ${EFFECTIVE_MILESTONES_SQL} m
       WHERE m.project_id = p.id AND m.visibility = 'client' AND m.status <> 'completed'
       ORDER BY m.target_date, m.created_at
       LIMIT 1
    ) nm ON TRUE
    LEFT JOIN LATERAL (
      SELECT COUNT(*) AS n
        FROM client_contact_project_access a
        JOIN client_contacts cc ON cc.id = a.client_contact_id
        JOIN client_users cu ON cu.id = cc.client_user_id
       WHERE a.project_id = p.id
         AND cc.disabled_at IS NULL AND cc.activated_at IS NOT NULL AND cu.status = 'active'
    ) au ON TRUE
   WHERE p.team_id = $1
`;

/** `organization_id=none` lists the projects that have no client yet. */
export const NO_CLIENT_FILTER = "none";

export interface PortalProjectsParams {
  search?: string;
  /** A client id, or `none` for projects without a client. */
  organization_id?: string;
  portal?: string;
  /** `true` keeps only projects that belong to a client. */
  has_client?: string;
  /** A client-facing status: on_track, at_risk, on_hold or completed. */
  status?: string;
  phase?: string;
  /** A key of PROJECT_SORTS. */
  sort?: string;
  order?: string;
  page?: number;
  limit?: number;
}

// Whitelist of sortable columns; the keys are the table column keys the admin UI sends.
const PROJECT_SORTS: Record<string, string> = {
  project: "LOWER(l.name)",
  client: "LOWER(l.client_name)",
  status: "l.client_status",
  phase: "l.current_phase",
  progress: "l.progress",
  next_milestone: "l.next_milestone_date",
  users: "l.active_client_users",
  portal: "l.portal_enabled",
};

const CLIENT_STATUSES = ["on_track", "at_risk", "on_hold", "completed"];

export async function listPortalProjects(teamId: string, params: PortalProjectsParams) {
  const page = Math.max(Number(params.page) || 1, 1);
  const limit = Math.min(Math.max(Number(params.limit) || 10, 1), 100);
  const filters: string[] = [];
  const values: unknown[] = [teamId];

  const search = (params.search ?? "").trim();
  if (search) {
    const n = values.push(containsPattern(search));
    filters.push(
      `(p.name ILIKE $${n} OR p.key ILIKE $${n} OR c.name ILIKE $${n} OR c.company_name ILIKE $${n}
        OR pcs.current_phase ILIKE $${n} OR nm.name ILIKE $${n})`
    );
  }
  // Every filter accepts a comma-separated list; a project matches when any chosen value matches.
  const clientIds = splitList(params.organization_id);
  if (clientIds.length) {
    const realIds = clientIds.filter(id => id !== NO_CLIENT_FILTER);
    // `none` lists workspace projects that are not linked to any client yet (the Add Client wizard offers these).
    const clauses: string[] = [];
    if (realIds.length) clauses.push(`p.client_id = ANY($${values.push(realIds)}::uuid[])`);
    if (realIds.length !== clientIds.length) clauses.push(`p.client_id IS NULL`);
    filters.push(`(${clauses.join(" OR ")})`);
  }
  if (params.has_client === "true") filters.push(`p.client_id IS NOT NULL`);
  const portalStates = splitList(params.portal);
  if (portalStates.length === 1 && portalStates[0] === "on") filters.push(`COALESCE(pcs.portal_enabled, FALSE) IS TRUE`);
  if (portalStates.length === 1 && portalStates[0] === "off") filters.push(`COALESCE(pcs.portal_enabled, FALSE) IS FALSE`);

  const statuses = splitList(params.status);
  if (statuses.length) {
    if (!statuses.every(status => CLIENT_STATUSES.includes(status))) throw badRequest("Invalid status filter");
    filters.push(`COALESCE(pcs.client_status, 'on_track') = ANY($${values.push(statuses)}::text[])`);
  }
  const phases = splitList(params.phase);
  if (phases.length) filters.push(`pcs.current_phase = ANY($${values.push(phases)}::text[])`);

  const sortSql = params.sort ? PROJECT_SORTS[params.sort] : undefined;
  if (params.sort && !sortSql) throw badRequest("Invalid sort column");
  const direction = params.order === "desc" ? "DESC" : "ASC";
  const orderBy = sortSql ? `${sortSql} ${direction} NULLS LAST, l.name, l.id` : "l.name, l.id";

  values.push(limit, (page - 1) * limit);
  const where = filters.length ? `AND ${filters.join(" AND ")}` : "";

  const rows = await db.query(
    `SELECT l.*, COUNT(*) OVER()::int AS total_count
       FROM (${PROJECT_LIST_SQL} ${where}) l
      ORDER BY ${orderBy}
      LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values
  );

  const stats = await getPortalProjectStats(db, teamId);
  return {
    items: rows.rows.map(mapProjectRow),
    total: rows.rows[0]?.total_count ?? 0,
    page,
    limit,
    stats,
  };
}

export interface PortalProjectStats {
  portal_enabled: number;
  total: number;
  awaiting_client_approval: number;
  open_change_requests: number;
  delayed_milestones: number;
}

export async function getPortalProjectStats(q: Queryable, teamId: string): Promise<PortalProjectStats> {
  const result = await q.query(
    `SELECT
       (SELECT COUNT(*)::int FROM projects p WHERE p.team_id = $1) AS total,
       (SELECT COUNT(*)::int FROM project_client_settings s WHERE s.team_id = $1 AND s.portal_enabled IS TRUE) AS portal_enabled,
       (SELECT COUNT(*)::int FROM client_portal_approvals a
         WHERE a.organization_team_id = $1 AND a.status = 'awaiting') AS awaiting_client_approval,
       (SELECT COUNT(*)::int FROM client_portal_change_requests r
         WHERE r.organization_team_id = $1 AND r.status NOT IN ('completed', 'rejected', 'cancelled')) AS open_change_requests,
       (SELECT COUNT(*)::int FROM client_portal_milestones m
          JOIN project_client_settings s ON s.project_id = m.project_id AND s.milestone_source = 'manual'
         WHERE s.team_id = $1 AND s.portal_enabled IS TRUE AND m.status = 'delayed') AS delayed_milestones`,
    [teamId]
  );
  const row = result.rows[0] ?? {};
  return {
    total: row.total ?? 0,
    portal_enabled: row.portal_enabled ?? 0,
    awaiting_client_approval: row.awaiting_client_approval ?? 0,
    open_change_requests: row.open_change_requests ?? 0,
    delayed_milestones: row.delayed_milestones ?? 0,
  };
}

export async function getPortalProject(q: Queryable, teamId: string, projectId: string): Promise<PortalProjectRow> {
  const result = await q.query(`${PROJECT_LIST_SQL} AND p.id = $2`, [teamId, projectId]);
  if (result.rows.length === 0) throw notFound("Project");
  return mapProjectRow(result.rows[0]);
}

export interface ProjectUpdateView {
  id: string;
  project_id: string;
  author: StaffRef;
  body: string;
  published_at: string;
}

export interface ProjectOverviewView {
  project_id: string;
  status: ClientProjectStatus;
  phase: ProjectPhase | null;
  progress_source: ProgressSource;
  milestone_source: MilestoneSource;
  worklenz_progress: number;
  manual_progress: number | null;
  start_date: string | null;
  expected_completion: string | null;
  /** The WorkLenz project's own dates, shown read-only while progress follows WorkLenz. */
  worklenz_start_date: string | null;
  worklenz_end_date: string | null;
  primary_contact_id: string | null;
  client_summary: string;
  allow_client_uploads: boolean;
  internal_notes: string;
  updates: ProjectUpdateView[];
}

const UPDATES_SHOWN = 4;

async function loadUpdates(q: Queryable, projectId: string): Promise<ProjectUpdateView[]> {
  const result = await q.query(
    `SELECT u.id, u.project_id, u.author_name, u.author_user_id, u.body, u.published_at,
            (SELECT tm.id FROM team_members tm
              WHERE tm.user_id = u.author_user_id AND tm.team_id = u.team_id LIMIT 1) AS author_member_id
       FROM project_client_updates u
      WHERE u.project_id = $1
      ORDER BY u.published_at DESC
      LIMIT ${UPDATES_SHOWN}`,
    [projectId]
  );
  return result.rows.map(row => ({
    id: row.id,
    project_id: row.project_id,
    author: toStaffRef(row.author_member_id ?? row.author_user_id ?? row.id, row.author_name),
    body: row.body,
    published_at: row.published_at,
  }));
}

export async function getProjectOverview(
  q: Queryable,
  teamId: string,
  projectId: string
): Promise<ProjectOverviewView> {
  await getProjectRef(q, teamId, projectId);
  await ensureProjectSettings(q, teamId, projectId);

  const result = await q.query(
    `SELECT s.client_status, s.current_phase, s.progress_source, s.milestone_source, s.manual_progress,
            s.start_date::text AS start_date, s.expected_completion::text AS expected_completion,
            s.primary_contact_member_id, s.client_summary, s.allow_client_uploads, s.internal_notes,
            p.start_date::date::text AS worklenz_start_date, p.end_date::date::text AS worklenz_end_date,
            ${WORKLENZ_PROGRESS_SQL} AS worklenz_progress
       FROM project_client_settings s
       JOIN projects p ON p.id = s.project_id
      WHERE s.project_id = $1`,
    [projectId]
  );
  const row = result.rows[0];
  if (!row) throw notFound("Project");

  return {
    project_id: projectId,
    status: row.client_status,
    phase: row.current_phase ?? null,
    progress_source: row.progress_source,
    milestone_source: row.milestone_source === "worklenz" ? "worklenz" : "manual",
    worklenz_progress: row.worklenz_progress ?? 0,
    manual_progress: row.manual_progress ?? null,
    start_date: row.start_date ?? null,
    expected_completion: row.expected_completion ?? null,
    worklenz_start_date: row.worklenz_start_date ?? null,
    worklenz_end_date: row.worklenz_end_date ?? null,
    primary_contact_id: row.primary_contact_member_id ?? null,
    client_summary: row.client_summary ?? "",
    allow_client_uploads: row.allow_client_uploads === true,
    internal_notes: row.internal_notes ?? "",
    updates: await loadUpdates(q, projectId),
  };
}

export interface UpdateOverviewInput {
  status?: string;
  phase?: string | null;
  progress_source?: string;
  milestone_source?: string;
  manual_progress?: number | null;
  start_date?: string | null;
  expected_completion?: string | null;
  primary_contact_id?: string | null;
  client_summary?: string;
  allow_client_uploads?: boolean;
  internal_notes?: string;
}

const isIsoDate = (value: unknown): value is string =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);

/**
 * Saves the client-facing fields. A blank Expected completion stays blank (the portal shows
 * "Not set" and never invents a date). Switching progress from manual back to WorkLenz discards the
 * manual value. Private internal notes are stored here but never leave the admin API.
 */
export async function updateProjectOverview(input: {
  teamId: string;
  projectId: string;
  patch: UpdateOverviewInput;
}): Promise<ProjectOverviewView> {
  const { teamId, projectId, patch } = input;
  await getProjectRef(db, teamId, projectId);
  await ensureProjectSettings(db, teamId, projectId);

  const current = await db.query(
    `SELECT progress_source, manual_progress FROM project_client_settings WHERE project_id = $1`,
    [projectId]
  );
  const sets: string[] = [];
  const values: unknown[] = [projectId];
  const set = (column: string, value: unknown) => {
    values.push(value);
    sets.push(`${column} = $${values.length}`);
  };

  if (patch.status !== undefined) {
    if (!(CLIENT_PROJECT_STATUSES as readonly string[]).includes(patch.status)) {
      throw badRequest("Invalid project status");
    }
    set("client_status", patch.status);
  }
  if (patch.phase !== undefined) {
    if (patch.phase !== null && !(PROJECT_PHASES as readonly string[]).includes(patch.phase)) {
      throw badRequest("Invalid project phase");
    }
    set("current_phase", patch.phase);
  }

  const source = (patch.progress_source ?? current.rows[0].progress_source) as string;
  if (patch.progress_source !== undefined || patch.manual_progress !== undefined) {
    if (source !== "worklenz" && source !== "manual") throw badRequest("Invalid progress source");
    if (source === "manual") {
      const manual = patch.manual_progress ?? current.rows[0].manual_progress;
      if (typeof manual !== "number" || !Number.isFinite(manual) || manual < 0 || manual > 100) {
        throw badRequest("Manual progress must be a number from 0 to 100");
      }
      set("progress_source", "manual");
      set("manual_progress", Math.round(manual));
    } else {
      // Back on WorkLenz progress: the manual value is discarded.
      set("progress_source", "worklenz");
      set("manual_progress", null);
    }
  }

  if (patch.milestone_source !== undefined) {
    if (!isMilestoneSource(patch.milestone_source)) throw badRequest("Invalid milestone source");
    set("milestone_source", patch.milestone_source);
  }

  for (const [key, column] of [
    ["start_date", "start_date"],
    ["expected_completion", "expected_completion"],
  ] as const) {
    const value = patch[key];
    if (value === undefined) continue;
    if (value !== null && !isIsoDate(value)) throw badRequest(`${key} must be a YYYY-MM-DD date`);
    set(column, value);
  }

  if (patch.primary_contact_id !== undefined) {
    if (patch.primary_contact_id !== null) {
      const member = await findStaff(db, teamId, patch.primary_contact_id);
      if (!member) throw badRequest("The primary contact must be an active workspace member");
    }
    set("primary_contact_member_id", patch.primary_contact_id);
  }
  if (patch.client_summary !== undefined) set("client_summary", cleanPortalRichText(String(patch.client_summary), 2000, "The client summary"));
  if (patch.internal_notes !== undefined) set("internal_notes", cleanPortalRichText(String(patch.internal_notes), 4000, "Internal notes"));
  if (patch.allow_client_uploads !== undefined) {
    if (typeof patch.allow_client_uploads !== "boolean") throw badRequest("allow_client_uploads must be true or false");
    set("allow_client_uploads", patch.allow_client_uploads);
  }

  if (sets.length > 0) {
    await db.query(
      `UPDATE project_client_settings SET ${sets.join(", ")}, updated_at = CURRENT_TIMESTAMP WHERE project_id = $1`,
      values
    );
  }

  return getProjectOverview(db, teamId, projectId);
}

/**
 * Publishes a short update every client user on the project sees as "Latest update". Clients are
 * notified in the portal and, if the event is on, by email. Staff get an already-read entry so the
 * bell badge does not rise for their own action.
 */
export async function publishProjectUpdate(input: {
  teamId: string;
  projectId: string;
  authorUserId: string;
  authorName: string;
  body: string;
}): Promise<ProjectUpdateView> {
  const body = cleanPortalRichText(input.body, 2000, "An update");
  if (!body) throw badRequest("Write an update to publish");

  const project = await getProjectRef(db, input.teamId, input.projectId);
  const portal = await db.query(`SELECT portal_enabled FROM project_client_settings WHERE project_id = $1`, [
    input.projectId,
  ]);
  if (!project.clientId || portal.rows[0]?.portal_enabled !== true) {
    throw badRequest("Turn the Client Portal on for this project before publishing an update", "PORTAL_OFF");
  }

  const inserted = await db.query(
    `INSERT INTO project_client_updates (project_id, team_id, author_user_id, author_name, body)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, project_id, author_name, published_at`,
    [input.projectId, input.teamId, input.authorUserId, input.authorName, body]
  );
  const row = inserted.rows[0];

  const plain = htmlToPlainText(body);
  const preview = plain.length > 140 ? `${plain.slice(0, 137)}...` : plain;
  void notifyClientUsers({
    teamId: input.teamId,
    clientId: project.clientId,
    projectId: project.id,
    type: "project_update",
    title: `New update on ${project.name}`,
    message: preview,
    referenceId: row.id,
    emailEvent: "project_update",
    portalPath: `/projects/${project.id}`,
  });
  void notifyStaff({
    teamId: input.teamId,
    kind: "Project",
    title: `Update published on ${project.name}`,
    body: preview,
    url: `/worklenz/client-portal/projects/${project.id}`,
    projectId: project.id,
    alreadyRead: true,
  });

  return {
    id: row.id,
    project_id: row.project_id,
    author: toStaffRef(input.authorUserId, row.author_name),
    body,
    published_at: row.published_at,
  };
}

export interface ProjectAccessUserView {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  last_access_at: string | null;
}

export interface ProjectAccessView {
  project_id: string;
  organization_id: string | null;
  assigned: ProjectAccessUserView[];
  assignable: ProjectAccessUserView[];
}

/** Who is assigned to the project and which organization users can still be added. */
export async function getProjectAccess(q: Queryable, teamId: string, projectId: string): Promise<ProjectAccessView> {
  const project = await getProjectRef(q, teamId, projectId);
  if (!project.clientId) {
    return { project_id: projectId, organization_id: null, assigned: [], assignable: [] };
  }

  const result = await q.query(
    `SELECT u.id, u.name, u.email, u.role, u.status_key, u.last_access_at,
            (u.role = 'admin' OR EXISTS (
               SELECT 1 FROM client_contact_project_access a
                WHERE a.client_contact_id = u.id AND a.project_id = $3
             )) AS is_assigned
       FROM (${USER_VIEW_SQL}) u
      WHERE u.client_id = $2
      ORDER BY u.name`,
    [teamId, project.clientId, projectId]
  );

  const toView = (row: any): ProjectAccessUserView => ({
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    status: row.status_key,
    last_access_at: row.last_access_at ?? null,
  });

  return {
    project_id: projectId,
    organization_id: project.clientId,
    // Client Admins open every org project automatically; Members/Viewers need an access row.
    assigned: result.rows.filter(row => row.is_assigned).map(toView),
    // Organization users not yet assigned and not Deactivated (admins are never assignable).
    assignable: result.rows.filter(row => !row.is_assigned && row.status_key !== "deactivated").map(toView),
  };
}

export async function setProjectPortal(input: {
  teamId: string;
  projectId: string;
  enabled: boolean;
  actor: AuditActor;
}) {
  const { teamId, projectId, actor } = input;
  return withTransaction(async tx => {
    if (input.enabled) {
      const result = await enableProjectPortal(tx, { teamId, projectId, actor });
      return { portal_enabled: true, affected_users: 0, changed: result.changed };
    }
    const result = await disableProjectPortal(tx, { teamId, projectId, actor });
    return { portal_enabled: false, affected_users: result.affectedUsers, changed: result.changed };
  });
}

