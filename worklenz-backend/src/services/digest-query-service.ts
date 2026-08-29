import db from "../config/db";
import { getBaseUrl } from "../cron_jobs/helpers";
import { WorkspaceDigestRole } from "./digest-role-service";

// ─── Shared task row shape ───────────────────────────────────────────────────

export interface DigestTask {
  id: string;
  name: string;
  taskUrl: string;
  projectName: string;
  workspaceName: string | null; // null = single-workspace context, omit label
  priorityName: string | null;
  dueDate: string | null;       // ISO date string in user's local TZ
  daysOverdue: number | null;
  assigneeName: string | null;  // for "assigned by me" rows
  completedDay: string | null;  // e.g. "Monday" for weekly-end completed section
}

export interface DigestTaskSection {
  tasks: DigestTask[];
  totalCount: number; // includes tasks beyond the limit
}

// ─── Admin team overview shapes ──────────────────────────────────────────────

export interface AdminTeamRow {
  teamName: string;
  memberCount: number;
  dueToday: number;
  dueThisWeek: number;
  overdue: number;
  completed: number;
  overdueThisWeek: number;
  allTimeOverdue: number;
  dueNextWeek: number;
}

export interface AdminWorkspaceOverview {
  workspaceName: string;
  teams: AdminTeamRow[];
  totals: Omit<AdminTeamRow, "teamName" | "memberCount"> & { memberCount: number };
}

// ─── Common SQL fragments ────────────────────────────────────────────────────

function notCompleteFilter(): string {
  return `
    ts.category_id NOT IN (
      SELECT id FROM sys_task_status_categories WHERE is_done IS TRUE
    )
  `;
}

function notArchivedFilter(userIdParam: string): string {
  return `
    t.project_id NOT IN (
      SELECT project_id FROM archived_projects WHERE user_id = ${userIdParam}
    )
  `;
}

function dueDateNotNull(): string {
  return `t.end_date IS NOT NULL`;
}

function taskSelectFields(tz: string): string {
  return `
    t.id,
    t.name,
    p.name AS project_name,
    tm_ws.name AS workspace_name,
    tp.name AS priority_name,
    TO_CHAR(t.end_date AT TIME ZONE '${tz}', 'YYYY-MM-DD') AS due_date,
    GREATEST(
      DATE_PART('day',
        DATE_TRUNC('day', CURRENT_TIMESTAMP AT TIME ZONE '${tz}') -
        DATE_TRUNC('day', t.end_date AT TIME ZONE '${tz}')
      )::INT, 0
    ) AS days_overdue,
    NULL::TEXT AS assignee_name,
    NULL::TEXT AS completed_day
  `;
}

function taskSelectFieldsWithAssignee(tz: string): string {
  return `
    t.id,
    t.name,
    p.name AS project_name,
    tm_ws.name AS workspace_name,
    tp.name AS priority_name,
    TO_CHAR(t.end_date AT TIME ZONE '${tz}', 'YYYY-MM-DD') AS due_date,
    GREATEST(
      DATE_PART('day',
        DATE_TRUNC('day', CURRENT_TIMESTAMP AT TIME ZONE '${tz}') -
        DATE_TRUNC('day', t.end_date AT TIME ZONE '${tz}')
      )::INT, 0
    ) AS days_overdue,
    au.name AS assignee_name,
    NULL::TEXT AS completed_day
  `;
}

function taskJoins(): string {
  return `
    JOIN projects p ON p.id = t.project_id
    JOIN teams tm_ws ON tm_ws.id = p.team_id
    JOIN task_statuses ts ON ts.id = t.status_id
    LEFT JOIN task_priorities tp ON tp.id = t.priority_id
  `;
}

function buildTaskUrl(taskId: string): string {
  return `${getBaseUrl()}/worklenz/tasks/${taskId}`;
}

function mapRows(rows: any[], workspaceCount: number): DigestTask[] {
  return rows.map(r => ({
    id: r.id,
    name: r.name,
    taskUrl: buildTaskUrl(r.id),
    projectName: r.project_name ?? "No Project",
    workspaceName: workspaceCount > 1 ? r.workspace_name : null,
    priorityName: r.priority_name ?? null,
    dueDate: r.due_date ?? null,
    daysOverdue: r.days_overdue ?? null,
    assigneeName: r.assignee_name ?? null,
    completedDay: r.completed_day ?? null,
  }));
}

async function fetchWithCount(
  sql: string,
  params: any[],
  limit: number,
  workspaceCount: number
): Promise<DigestTaskSection> {
  const countSql = `SELECT COUNT(*) AS total FROM (${sql}) sub`;
  const [dataResult, countResult] = await Promise.all([
    db.query(sql + ` LIMIT ${limit}`, params),
    db.query(countSql, params),
  ]);
  return {
    tasks: mapRows(dataResult.rows, workspaceCount),
    totalCount: parseInt(countResult.rows[0].total, 10),
  };
}

// ─── "Assigned to me" queries ────────────────────────────────────────────────

/**
 * Tasks assigned to this user with due_date = today (in their timezone).
 */
export async function getAssignedToMeDueToday(
  userId: string,
  tz: string,
  workspaceCount: number,
  limit = 15
): Promise<DigestTaskSection> {
  const sql = `
    SELECT ${taskSelectFields(tz)}
    FROM tasks t
    ${taskJoins()}
    JOIN tasks_assignees ta ON ta.task_id = t.id
    JOIN team_members tm ON tm.id = ta.team_member_id
    WHERE tm.user_id = $1
      AND tm.active = TRUE
      AND ${dueDateNotNull()}
      AND DATE(t.end_date AT TIME ZONE $2) = DATE(CURRENT_TIMESTAMP AT TIME ZONE $2)
      AND ${notCompleteFilter()}
      AND ${notArchivedFilter("$1")}
    ORDER BY tp.value DESC NULLS LAST, t.name ASC
  `;
  return fetchWithCount(sql, [userId, tz], limit, workspaceCount);
}

/**
 * Tasks assigned to this user due tomorrow.
 */
export async function getAssignedToMeUpcomingTomorrow(
  userId: string,
  tz: string,
  workspaceCount: number,
  limit = 15
): Promise<DigestTaskSection> {
  const sql = `
    SELECT ${taskSelectFields(tz)}
    FROM tasks t
    ${taskJoins()}
    JOIN tasks_assignees ta ON ta.task_id = t.id
    JOIN team_members tm ON tm.id = ta.team_member_id
    WHERE tm.user_id = $1
      AND tm.active = TRUE
      AND ${dueDateNotNull()}
      AND DATE(t.end_date AT TIME ZONE $2) = DATE(CURRENT_TIMESTAMP AT TIME ZONE $2) + INTERVAL '1 day'
      AND ${notCompleteFilter()}
      AND ${notArchivedFilter("$1")}
    ORDER BY t.end_date ASC
  `;
  return fetchWithCount(sql, [userId, tz], limit, workspaceCount);
}

/**
 * Tasks assigned to this user with due_date < today (overdue).
 */
export async function getAssignedToMeOverdue(
  userId: string,
  tz: string,
  workspaceCount: number,
  limit = 15
): Promise<DigestTaskSection> {
  const sql = `
    SELECT ${taskSelectFields(tz)}
    FROM tasks t
    ${taskJoins()}
    JOIN tasks_assignees ta ON ta.task_id = t.id
    JOIN team_members tm ON tm.id = ta.team_member_id
    WHERE tm.user_id = $1
      AND tm.active = TRUE
      AND ${dueDateNotNull()}
      AND DATE(t.end_date AT TIME ZONE $2) < DATE(CURRENT_TIMESTAMP AT TIME ZONE $2)
      AND ${notCompleteFilter()}
      AND ${notArchivedFilter("$1")}
    ORDER BY t.end_date ASC
  `;
  return fetchWithCount(sql, [userId, tz], limit, workspaceCount);
}

/**
 * Tasks assigned to this user due Monday through Friday of the current week
 * (excluding today = Monday), grouped by day name.
 */
export async function getAssignedToMeDueThisWeek(
  userId: string,
  tz: string,
  workspaceCount: number,
  limit = 10
): Promise<DigestTaskSection> {
  const sql = `
    SELECT ${taskSelectFields(tz)},
           TO_CHAR(t.end_date AT TIME ZONE $2, 'Day') AS weekday_label,
           EXTRACT(DOW FROM t.end_date AT TIME ZONE $2) AS dow
    FROM tasks t
    ${taskJoins()}
    JOIN tasks_assignees ta ON ta.task_id = t.id
    JOIN team_members tm ON tm.id = ta.team_member_id
    WHERE tm.user_id = $1
      AND tm.active = TRUE
      AND ${dueDateNotNull()}
      AND DATE(t.end_date AT TIME ZONE $2) > DATE(CURRENT_TIMESTAMP AT TIME ZONE $2)
      AND DATE(t.end_date AT TIME ZONE $2) <= DATE_TRUNC('week', CURRENT_TIMESTAMP AT TIME ZONE $2)::DATE + 4
      AND ${notCompleteFilter()}
      AND ${notArchivedFilter("$1")}
    ORDER BY t.end_date ASC, tp.value DESC NULLS LAST
  `;
  return fetchWithCount(sql, [userId, tz], limit, workspaceCount);
}

// ─── "Assigned by me" queries ─────────────────────────────────────────────────

function buildAssignedByMeProjectFilter(
  roles: WorkspaceDigestRole[],
  projectIdParam: string
): string {
  const adminTeamIds = roles.filter(r => r.isAdmin).map(r => r.teamId);
  const pmProjectIds = roles.flatMap(r => r.pmProjectIds);

  if (adminTeamIds.length === 0 && pmProjectIds.length === 0) return "FALSE";

  const conditions: string[] = [];
  if (adminTeamIds.length > 0) {
    conditions.push(`p.team_id = ANY(ARRAY[${adminTeamIds.map(id => `'${id}'::uuid`).join(",")}])`);
  }
  if (pmProjectIds.length > 0) {
    conditions.push(`${projectIdParam} = ANY(ARRAY[${pmProjectIds.map(id => `'${id}'::uuid`).join(",")}])`);
  }
  return `(${conditions.join(" OR ")})`;
}

export async function getAssignedByMeDueToday(
  userId: string,
  tz: string,
  roles: WorkspaceDigestRole[],
  workspaceCount: number,
  limit = 15
): Promise<DigestTaskSection> {
  const scopeFilter = buildAssignedByMeProjectFilter(roles, "t.project_id");
  if (scopeFilter === "FALSE") return { tasks: [], totalCount: 0 };

  const sql = `
    SELECT ${taskSelectFieldsWithAssignee(tz)}
    FROM tasks t
    ${taskJoins()}
    JOIN tasks_assignees ta ON ta.task_id = t.id
    JOIN team_members atm ON atm.id = ta.team_member_id
    JOIN users au ON au.id = atm.user_id
    WHERE ta.assigned_by = $1
      AND atm.user_id <> $1
      AND ${dueDateNotNull()}
      AND DATE(t.end_date AT TIME ZONE $2) = DATE(CURRENT_TIMESTAMP AT TIME ZONE $2)
      AND ${notCompleteFilter()}
      AND ${notArchivedFilter("$1")}
      AND ${scopeFilter}
    ORDER BY t.name ASC
  `;
  return fetchWithCount(sql, [userId, tz], limit, workspaceCount);
}

export async function getAssignedByMeOverdue(
  userId: string,
  tz: string,
  roles: WorkspaceDigestRole[],
  workspaceCount: number,
  limit = 15
): Promise<DigestTaskSection> {
  const scopeFilter = buildAssignedByMeProjectFilter(roles, "t.project_id");
  if (scopeFilter === "FALSE") return { tasks: [], totalCount: 0 };

  const sql = `
    SELECT ${taskSelectFieldsWithAssignee(tz)}
    FROM tasks t
    ${taskJoins()}
    JOIN tasks_assignees ta ON ta.task_id = t.id
    JOIN team_members atm ON atm.id = ta.team_member_id
    JOIN users au ON au.id = atm.user_id
    WHERE ta.assigned_by = $1
      AND atm.user_id <> $1
      AND ${dueDateNotNull()}
      AND DATE(t.end_date AT TIME ZONE $2) < DATE(CURRENT_TIMESTAMP AT TIME ZONE $2)
      AND ${notCompleteFilter()}
      AND ${notArchivedFilter("$1")}
      AND ${scopeFilter}
    ORDER BY t.end_date ASC
  `;
  return fetchWithCount(sql, [userId, tz], limit, workspaceCount);
}

export async function getAssignedByMeDueThisWeek(
  userId: string,
  tz: string,
  roles: WorkspaceDigestRole[],
  workspaceCount: number,
  limit = 10
): Promise<DigestTaskSection> {
  const scopeFilter = buildAssignedByMeProjectFilter(roles, "t.project_id");
  if (scopeFilter === "FALSE") return { tasks: [], totalCount: 0 };

  const sql = `
    SELECT ${taskSelectFieldsWithAssignee(tz)},
           TO_CHAR(t.end_date AT TIME ZONE $2, 'Day') AS weekday_label,
           EXTRACT(DOW FROM t.end_date AT TIME ZONE $2) AS dow
    FROM tasks t
    ${taskJoins()}
    JOIN tasks_assignees ta ON ta.task_id = t.id
    JOIN team_members atm ON atm.id = ta.team_member_id
    JOIN users au ON au.id = atm.user_id
    WHERE ta.assigned_by = $1
      AND atm.user_id <> $1
      AND ${dueDateNotNull()}
      AND DATE(t.end_date AT TIME ZONE $2) > DATE(CURRENT_TIMESTAMP AT TIME ZONE $2)
      AND DATE(t.end_date AT TIME ZONE $2) <= DATE_TRUNC('week', CURRENT_TIMESTAMP AT TIME ZONE $2)::DATE + 4
      AND ${notCompleteFilter()}
      AND ${notArchivedFilter("$1")}
      AND ${scopeFilter}
    ORDER BY t.end_date ASC
  `;
  return fetchWithCount(sql, [userId, tz], limit, workspaceCount);
}

// ─── Weekly End specific ──────────────────────────────────────────────────────

export async function getAssignedToMeCompletedThisWeek(
  userId: string,
  tz: string,
  workspaceCount: number,
  limit = 10
): Promise<DigestTaskSection> {
  const sql = `
    SELECT
      t.id,
      t.name,
      p.name AS project_name,
      tm_ws.name AS workspace_name,
      NULL::TEXT AS priority_name,
      NULL::TEXT AS due_date,
      NULL::INT AS days_overdue,
      NULL::TEXT AS assignee_name,
      TO_CHAR(t.completed_at AT TIME ZONE $2, 'Day') AS completed_day
    FROM tasks t
    JOIN projects p ON p.id = t.project_id
    JOIN teams tm_ws ON tm_ws.id = p.team_id
    JOIN tasks_assignees ta ON ta.task_id = t.id
    JOIN team_members tm ON tm.id = ta.team_member_id
    WHERE tm.user_id = $1
      AND tm.active = TRUE
      AND t.completed_at IS NOT NULL
      AND t.completed_at AT TIME ZONE $2 >= DATE_TRUNC('week', CURRENT_TIMESTAMP AT TIME ZONE $2)
      AND t.completed_at AT TIME ZONE $2 <= CURRENT_TIMESTAMP AT TIME ZONE $2
      AND ${notArchivedFilter("$1")}
    ORDER BY t.completed_at DESC
  `;
  return fetchWithCount(sql, [userId, tz], limit, workspaceCount);
}

export async function getAssignedToMeStillDueThisWeek(
  userId: string,
  tz: string,
  workspaceCount: number,
  limit = 10
): Promise<DigestTaskSection> {
  const sql = `
    SELECT ${taskSelectFields(tz)}
    FROM tasks t
    ${taskJoins()}
    JOIN tasks_assignees ta ON ta.task_id = t.id
    JOIN team_members tm ON tm.id = ta.team_member_id
    WHERE tm.user_id = $1
      AND tm.active = TRUE
      AND ${dueDateNotNull()}
      AND DATE(t.end_date AT TIME ZONE $2) >= DATE(CURRENT_TIMESTAMP AT TIME ZONE $2)
      AND DATE(t.end_date AT TIME ZONE $2) <= DATE_TRUNC('week', CURRENT_TIMESTAMP AT TIME ZONE $2)::DATE + 4
      AND ${notCompleteFilter()}
      AND ${notArchivedFilter("$1")}
    ORDER BY t.end_date ASC
  `;
  return fetchWithCount(sql, [userId, tz], limit, workspaceCount);
}

export async function getAssignedToMeBecameOverdueThisWeek(
  userId: string,
  tz: string,
  workspaceCount: number,
  limit = 10
): Promise<DigestTaskSection> {
  const sql = `
    SELECT ${taskSelectFields(tz)}
    FROM tasks t
    ${taskJoins()}
    JOIN tasks_assignees ta ON ta.task_id = t.id
    JOIN team_members tm ON tm.id = ta.team_member_id
    WHERE tm.user_id = $1
      AND tm.active = TRUE
      AND ${dueDateNotNull()}
      AND DATE(t.end_date AT TIME ZONE $2) >= DATE_TRUNC('week', CURRENT_TIMESTAMP AT TIME ZONE $2)::DATE
      AND DATE(t.end_date AT TIME ZONE $2) < DATE(CURRENT_TIMESTAMP AT TIME ZONE $2)
      AND ${notCompleteFilter()}
      AND ${notArchivedFilter("$1")}
    ORDER BY t.end_date ASC
  `;
  return fetchWithCount(sql, [userId, tz], limit, workspaceCount);
}

export async function getAssignedToMeAllTimeOverdueCount(
  userId: string,
  tz: string
): Promise<number> {
  const result = await db.query(
    `SELECT COUNT(*) AS cnt
     FROM tasks t
     JOIN task_statuses ts ON ts.id = t.status_id
     JOIN tasks_assignees ta ON ta.task_id = t.id
     JOIN team_members tm ON tm.id = ta.team_member_id
     WHERE tm.user_id = $1
       AND tm.active = TRUE
       AND t.end_date IS NOT NULL
       AND DATE(t.end_date AT TIME ZONE $2) < DATE_TRUNC('week', CURRENT_TIMESTAMP AT TIME ZONE $2)::DATE
       AND ${notCompleteFilter()}
       AND t.project_id NOT IN (
         SELECT project_id FROM archived_projects WHERE user_id = $1
       )`,
    [userId, tz]
  );
  return parseInt(result.rows[0].cnt, 10);
}

export async function getAssignedByMeCompletedThisWeek(
  userId: string,
  tz: string,
  roles: WorkspaceDigestRole[],
  workspaceCount: number,
  limit = 10
): Promise<DigestTaskSection> {
  const scopeFilter = buildAssignedByMeProjectFilter(roles, "t.project_id");
  if (scopeFilter === "FALSE") return { tasks: [], totalCount: 0 };

  const sql = `
    SELECT
      t.id,
      t.name,
      p.name AS project_name,
      tm_ws.name AS workspace_name,
      NULL::TEXT AS priority_name,
      NULL::TEXT AS due_date,
      NULL::INT AS days_overdue,
      au.name AS assignee_name,
      TO_CHAR(t.completed_at AT TIME ZONE $2, 'Day') AS completed_day
    FROM tasks t
    JOIN projects p ON p.id = t.project_id
    JOIN teams tm_ws ON tm_ws.id = p.team_id
    JOIN tasks_assignees ta ON ta.task_id = t.id
    JOIN team_members atm ON atm.id = ta.team_member_id
    JOIN users au ON au.id = atm.user_id
    WHERE ta.assigned_by = $1
      AND atm.user_id <> $1
      AND t.completed_at IS NOT NULL
      AND t.completed_at AT TIME ZONE $2 >= DATE_TRUNC('week', CURRENT_TIMESTAMP AT TIME ZONE $2)
      AND t.completed_at AT TIME ZONE $2 <= CURRENT_TIMESTAMP AT TIME ZONE $2
      AND ${notArchivedFilter("$1")}
      AND ${scopeFilter}
    ORDER BY t.completed_at DESC
  `;
  return fetchWithCount(sql, [userId, tz], limit, workspaceCount);
}

export async function getAssignedByMeBecameOverdueThisWeek(
  userId: string,
  tz: string,
  roles: WorkspaceDigestRole[],
  workspaceCount: number,
  limit = 10
): Promise<DigestTaskSection> {
  const scopeFilter = buildAssignedByMeProjectFilter(roles, "t.project_id");
  if (scopeFilter === "FALSE") return { tasks: [], totalCount: 0 };

  const sql = `
    SELECT ${taskSelectFieldsWithAssignee(tz)}
    FROM tasks t
    ${taskJoins()}
    JOIN tasks_assignees ta ON ta.task_id = t.id
    JOIN team_members atm ON atm.id = ta.team_member_id
    JOIN users au ON au.id = atm.user_id
    WHERE ta.assigned_by = $1
      AND atm.user_id <> $1
      AND ${dueDateNotNull()}
      AND DATE(t.end_date AT TIME ZONE $2) >= DATE_TRUNC('week', CURRENT_TIMESTAMP AT TIME ZONE $2)::DATE
      AND DATE(t.end_date AT TIME ZONE $2) < DATE(CURRENT_TIMESTAMP AT TIME ZONE $2)
      AND ${notCompleteFilter()}
      AND ${notArchivedFilter("$1")}
      AND ${scopeFilter}
    ORDER BY t.end_date ASC
  `;
  return fetchWithCount(sql, [userId, tz], limit, workspaceCount);
}

// ─── Admin team overview ──────────────────────────────────────────────────────

export async function getDailyAdminTeamOverview(
  adminTeamIds: string[],
  tz: string
): Promise<AdminWorkspaceOverview[]> {
  if (adminTeamIds.length === 0) return [];

  const result = await db.query(
    `SELECT
       wt.id AS team_id,
       wt.name AS team_name,
       ws.id AS workspace_id,
       ws.name AS workspace_name,
       COUNT(DISTINCT CASE
         WHEN t.end_date IS NOT NULL
           AND DATE(t.end_date AT TIME ZONE $2) = DATE(CURRENT_TIMESTAMP AT TIME ZONE $2)
           AND ts.category_id NOT IN (SELECT id FROM sys_task_status_categories WHERE is_done IS TRUE)
         THEN t.id END) AS due_today,
       COUNT(DISTINCT CASE
         WHEN t.end_date IS NOT NULL
           AND DATE(t.end_date AT TIME ZONE $2) < DATE(CURRENT_TIMESTAMP AT TIME ZONE $2)
           AND ts.category_id NOT IN (SELECT id FROM sys_task_status_categories WHERE is_done IS TRUE)
         THEN t.id END) AS overdue,
       COUNT(DISTINCT tm.id) FILTER (WHERE tm.active = TRUE) AS member_count
     FROM teams ws
     LEFT JOIN projects proj ON proj.team_id = ws.id
     LEFT JOIN tasks t ON t.project_id = proj.id
     LEFT JOIN task_statuses ts ON ts.id = t.status_id
     -- workspace teams (project_groups / labels named "team") - use teams table for workspace
     -- We group by workspace since the spec shows per-workspace counts for daily
     LEFT JOIN team_members tm ON tm.team_id = ws.id
     -- wt is the same as ws here for daily (no sub-team breakdown)
     JOIN teams wt ON wt.id = ws.id
     WHERE ws.id = ANY($1::uuid[])
     GROUP BY wt.id, wt.name, ws.id, ws.name`,
    [adminTeamIds, tz]
  );

  return buildWorkspaceOverviews(result.rows, "daily");
}

/**
 * Weekly admin overview with sub-team breakdown.
 * "Teams" in the spec refers to project groups / sub-teams within a workspace.
 * We use the `teams` table for workspace, and group projects by their team.
 */
export async function getWeeklyAdminTeamOverview(
  adminTeamIds: string[],
  tz: string,
  includeNextWeek = false
): Promise<AdminWorkspaceOverview[]> {
  if (adminTeamIds.length === 0) return [];

  const nextWeekCol = includeNextWeek
    ? `COUNT(DISTINCT CASE
         WHEN t.end_date IS NOT NULL
           AND DATE(t.end_date AT TIME ZONE $2) >= DATE_TRUNC('week', CURRENT_TIMESTAMP AT TIME ZONE $2)::DATE + 7
           AND DATE(t.end_date AT TIME ZONE $2) <= DATE_TRUNC('week', CURRENT_TIMESTAMP AT TIME ZONE $2)::DATE + 11
           AND ts.category_id NOT IN (SELECT id FROM sys_task_status_categories WHERE is_done IS TRUE)
         THEN t.id END) AS due_next_week,`
    : "0::BIGINT AS due_next_week,";

  const completedCol = includeNextWeek
    ? `COUNT(DISTINCT CASE
         WHEN t.completed_at IS NOT NULL
           AND t.completed_at AT TIME ZONE $2 >= DATE_TRUNC('week', CURRENT_TIMESTAMP AT TIME ZONE $2)
           AND t.completed_at AT TIME ZONE $2 <= CURRENT_TIMESTAMP AT TIME ZONE $2
         THEN t.id END) AS completed,
       COUNT(DISTINCT CASE
         WHEN t.end_date IS NOT NULL
           AND DATE(t.end_date AT TIME ZONE $2) >= DATE_TRUNC('week', CURRENT_TIMESTAMP AT TIME ZONE $2)::DATE
           AND DATE(t.end_date AT TIME ZONE $2) < DATE(CURRENT_TIMESTAMP AT TIME ZONE $2)
           AND ts.category_id NOT IN (SELECT id FROM sys_task_status_categories WHERE is_done IS TRUE)
         THEN t.id END) AS overdue_this_week,
       COUNT(DISTINCT CASE
         WHEN t.end_date IS NOT NULL
           AND DATE(t.end_date AT TIME ZONE $2) < DATE_TRUNC('week', CURRENT_TIMESTAMP AT TIME ZONE $2)::DATE
           AND ts.category_id NOT IN (SELECT id FROM sys_task_status_categories WHERE is_done IS TRUE)
         THEN t.id END) AS all_time_overdue,`
    : "0::BIGINT AS completed, 0::BIGINT AS overdue_this_week, 0::BIGINT AS all_time_overdue,";

  const result = await db.query(
    `SELECT
       ws.id AS workspace_id,
       ws.name AS workspace_name,
       ws.id AS team_id,
       ws.name AS team_name,
       COUNT(DISTINCT tm.id) FILTER (WHERE tm.active = TRUE) AS member_count,
       COUNT(DISTINCT CASE
         WHEN t.end_date IS NOT NULL
           AND DATE(t.end_date AT TIME ZONE $2) = DATE(CURRENT_TIMESTAMP AT TIME ZONE $2)
           AND ts.category_id NOT IN (SELECT id FROM sys_task_status_categories WHERE is_done IS TRUE)
         THEN t.id END) AS due_today,
       COUNT(DISTINCT CASE
         WHEN t.end_date IS NOT NULL
           AND DATE(t.end_date AT TIME ZONE $2) > DATE(CURRENT_TIMESTAMP AT TIME ZONE $2)
           AND DATE(t.end_date AT TIME ZONE $2) <= DATE_TRUNC('week', CURRENT_TIMESTAMP AT TIME ZONE $2)::DATE + 4
           AND ts.category_id NOT IN (SELECT id FROM sys_task_status_categories WHERE is_done IS TRUE)
         THEN t.id END) AS due_this_week,
       COUNT(DISTINCT CASE
         WHEN t.end_date IS NOT NULL
           AND DATE(t.end_date AT TIME ZONE $2) < DATE(CURRENT_TIMESTAMP AT TIME ZONE $2)
           AND ts.category_id NOT IN (SELECT id FROM sys_task_status_categories WHERE is_done IS TRUE)
         THEN t.id END) AS overdue,
       ${completedCol}
       ${nextWeekCol}
       0::BIGINT AS placeholder
     FROM teams ws
     LEFT JOIN projects proj ON proj.team_id = ws.id
     LEFT JOIN tasks t ON t.project_id = proj.id
     LEFT JOIN task_statuses ts ON ts.id = t.status_id
     LEFT JOIN team_members tm ON tm.team_id = ws.id
     WHERE ws.id = ANY($1::uuid[])
     GROUP BY ws.id, ws.name`,
    [adminTeamIds, tz]
  );

  return buildWorkspaceOverviews(result.rows, includeNextWeek ? "weekly_end" : "weekly_start");
}

function buildWorkspaceOverviews(rows: any[], _type: string): AdminWorkspaceOverview[] {
  const wsMap = new Map<string, AdminWorkspaceOverview>();

  for (const r of rows) {
    if (!wsMap.has(r.workspace_id)) {
      wsMap.set(r.workspace_id, {
        workspaceName: r.workspace_name,
        teams: [],
        totals: { dueToday: 0, dueThisWeek: 0, overdue: 0, completed: 0, overdueThisWeek: 0, allTimeOverdue: 0, dueNextWeek: 0, memberCount: 0 },
      });
    }
    const ws = wsMap.get(r.workspace_id)!;
    const teamRow: AdminTeamRow = {
      teamName: r.team_name,
      memberCount: parseInt(r.member_count ?? "0", 10),
      dueToday: parseInt(r.due_today ?? "0", 10),
      dueThisWeek: parseInt(r.due_this_week ?? "0", 10),
      overdue: parseInt(r.overdue ?? "0", 10),
      completed: parseInt(r.completed ?? "0", 10),
      overdueThisWeek: parseInt(r.overdue_this_week ?? "0", 10),
      allTimeOverdue: parseInt(r.all_time_overdue ?? "0", 10),
      dueNextWeek: parseInt(r.due_next_week ?? "0", 10),
    };
    ws.teams.push(teamRow);
    ws.totals.dueToday += teamRow.dueToday;
    ws.totals.dueThisWeek += teamRow.dueThisWeek;
    ws.totals.overdue += teamRow.overdue;
    ws.totals.completed += teamRow.completed;
    ws.totals.overdueThisWeek += teamRow.overdueThisWeek;
    ws.totals.allTimeOverdue += teamRow.allTimeOverdue;
    ws.totals.dueNextWeek += teamRow.dueNextWeek;
    ws.totals.memberCount += teamRow.memberCount;
  }

  for (const ws of wsMap.values()) {
    ws.teams.sort((a, b) => a.teamName.localeCompare(b.teamName));
  }

  return Array.from(wsMap.values());
}
