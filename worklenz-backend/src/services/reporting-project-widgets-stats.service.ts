import db from "../config/db";
import { SqlHelper } from "../shared/sql-helpers";

/**
 * Data for the extra Reports > Overview widgets (project/task/time/billable/client stats). Each
 * function computes one widget's aggregate, scoped to the current team and the shared filters
 * below. A widget's own `config` (see reporting-overview-layout.service.ts, which stores these
 * widgets' layout and per-widget filters alongside the rest of the Overview grid) narrows these
 * further for that one widget.
 *
 * Queries intentionally stay close to the patterns already used for the team-wide Overview
 * widgets (reporting-overview-base.ts) and allocation/time reports (reporting-allocation-
 * controller-updated.ts), rather than introducing new conventions.
 */

export interface ProjectWidgetFilters {
  teamId: string;
  userId: string;
  projectIds?: string[];
  teamIds?: string[];
  clientIds?: string[];
  categoryIds?: string[];
  memberIds?: string[];
  includeArchived?: boolean;
  billable?: "all" | "billable" | "nonBillable";
  dateFrom?: string;
  dateTo?: string;
}

interface FilterClauses {
  /** WHERE fragments against the `projects p` alias. */
  projectClause: string;
  /** WHERE fragments against `task_work_log twl`, requires `p` and `t` (tasks) to be joined. */
  timeLogDateClause: string;
  /** An `AND <alias>.billable IS [NOT] TRUE` fragment for whichever tasks alias a query uses, or
   *  "" when no billable filter is set. Parameter-free, so it's safe to call per query. */
  billableSql: (tasksAlias: string) => string;
  params: any[];
}

/** Builds the shared project/time-log/billable filter fragments once, parameterised from $2 (after $1 = team_id). */
function buildFilters(filters: ProjectWidgetFilters): FilterClauses {
  const params: any[] = [];
  let offset = 2; // $1 is reserved for team_id

  let projectClause = "";
  if (filters.projectIds?.length) {
    const { clause } = SqlHelper.buildInClause(filters.projectIds, offset);
    projectClause += ` AND p.id IN (${clause})`;
    params.push(...filters.projectIds);
    offset += filters.projectIds.length;
  }
  if (filters.teamIds?.length) {
    const { clause } = SqlHelper.buildInClause(filters.teamIds, offset);
    projectClause += ` AND p.team_id IN (${clause})`;
    params.push(...filters.teamIds);
    offset += filters.teamIds.length;
  }
  if (filters.clientIds?.length) {
    const { clause } = SqlHelper.buildInClause(filters.clientIds, offset);
    projectClause += ` AND p.client_id IN (${clause})`;
    params.push(...filters.clientIds);
    offset += filters.clientIds.length;
  }
  if (filters.categoryIds?.length) {
    const { clause } = SqlHelper.buildInClause(filters.categoryIds, offset);
    projectClause += ` AND p.category_id IN (${clause})`;
    params.push(...filters.categoryIds);
    offset += filters.categoryIds.length;
  }
  if (!filters.includeArchived) {
    projectClause += ` AND p.id NOT IN (SELECT project_id FROM archived_projects WHERE project_id = p.id AND user_id = $${offset})`;
    params.push(filters.userId);
    offset += 1;
  }

  let timeLogDateClause = "";
  if (filters.dateFrom && filters.dateTo) {
    timeLogDateClause = ` AND twl.created_at >= $${offset}::TIMESTAMP AND twl.created_at <= $${offset + 1}::TIMESTAMP`;
    params.push(filters.dateFrom, filters.dateTo);
    offset += 2;
  }

  const billableSql = (tasksAlias: string): string => {
    if (filters.billable === "billable") return ` AND ${tasksAlias}.billable IS TRUE`;
    if (filters.billable === "nonBillable") return ` AND ${tasksAlias}.billable IS FALSE`;
    return "";
  };

  return { projectClause, timeLogDateClause, billableSql, params };
}

/** 1. Project Stats by Status - project count per sys_project_statuses, within the filtered project set. */
export async function getProjectStatsByStatus(filters: ProjectWidgetFilters) {
  const { projectClause, params } = buildFilters(filters);
  const q = `
    SELECT s.name AS status, s.color_code, COUNT(p.id)::INT AS count
    FROM sys_project_statuses s
    LEFT JOIN projects p ON p.status_id = s.id AND p.team_id = $1 ${projectClause}
    GROUP BY s.id, s.name, s.color_code
    ORDER BY count DESC`;
  const result = await db.query(q, [filters.teamId, ...params]);
  return result.rows;
}

/** 2. Tasks by Status - task counts across the filtered project set, aggregated by status category (todo/doing/done). */
export async function getTasksByStatus(filters: ProjectWidgetFilters) {
  const { projectClause, params, billableSql } = buildFilters(filters);
  const q = `
    WITH filtered_projects AS (
      SELECT p.id FROM projects p WHERE p.team_id = $1 ${projectClause}
    )
    SELECT
      COUNT(*) FILTER (WHERE is_todo(t.status_id, t.project_id) IS TRUE)::INT AS todo,
      COUNT(*) FILTER (WHERE is_doing(t.status_id, t.project_id) IS TRUE)::INT AS doing,
      COUNT(*) FILTER (WHERE is_completed(t.status_id, t.project_id) IS TRUE)::INT AS done,
      COUNT(*)::INT AS total
    FROM tasks t
    WHERE t.project_id IN (SELECT id FROM filtered_projects)
      AND t.archived IS FALSE ${billableSql("t")}`;
  const result = await db.query(q, [filters.teamId, ...params]);
  return result.rows[0] ?? { todo: 0, doing: 0, done: 0, total: 0 };
}

/** 3. Total Time Logged vs Estimated - per project, within the filtered set (minutes/seconds -> hours). */
export async function getTimeLoggedVsEstimated(filters: ProjectWidgetFilters) {
  const { projectClause, timeLogDateClause, params, billableSql } = buildFilters(filters);
  const q = `
    SELECT
      p.id AS project_id,
      p.name AS project_name,
      COALESCE((SELECT SUM(total_minutes) FROM tasks est WHERE est.project_id = p.id ${billableSql("est")}), 0) AS estimated_minutes,
      COALESCE((
        SELECT SUM(twl.time_spent) FROM task_work_log twl
        JOIN tasks t ON t.id = twl.task_id
        WHERE t.project_id = p.id ${timeLogDateClause} ${billableSql("t")}
      ), 0) AS logged_seconds
    FROM projects p
    WHERE p.team_id = $1 ${projectClause}
    ORDER BY p.name`;
  const result = await db.query(q, [filters.teamId, ...params]);
  return result.rows.map(row => ({
    project_id: row.project_id,
    project_name: row.project_name,
    estimated_hours: +(row.estimated_minutes / 60).toFixed(2),
    logged_hours: +(row.logged_seconds / 3600).toFixed(2),
  }));
}

/**
 * 4. Expected Capacity vs Logged Time - per member. Capacity is the filtered projects' average
 * `hours_per_day` times the working days in range: a stable per-team figure, not dependent on
 * whether a given member happens to have logged time in that range (so members with no logs yet
 * still show their expected capacity, instead of a NULL bar). Logged hours only count time spent
 * on the filtered project set; a member whose only logs fall outside it still appears, at 0h.
 */
export async function getCapacityVsLogged(filters: ProjectWidgetFilters, workingDays: number) {
  const { projectClause, timeLogDateClause, params, billableSql } = buildFilters(filters);
  const q = `
    WITH filtered_projects AS (
      SELECT p.id, COALESCE(p.hours_per_day, 8) AS hours_per_day
      FROM projects p WHERE p.team_id = $1 ${projectClause}
    ),
    avg_capacity AS (
      SELECT COALESCE(AVG(hours_per_day), 8) AS hours_per_day FROM filtered_projects
    )
    SELECT
      tm.id AS team_member_id,
      u.name,
      u.email,
      ROUND((SELECT hours_per_day FROM avg_capacity) * $${params.length + 2}, 2) AS expected_capacity_hours,
      ROUND(COALESCE(SUM(twl.time_spent) FILTER (WHERE fp.id IS NOT NULL), 0) / 3600.0, 2) AS logged_hours
    FROM team_members tm
    LEFT JOIN users u ON u.id = tm.user_id
    LEFT JOIN task_work_log twl ON twl.user_id = u.id ${timeLogDateClause}
    LEFT JOIN tasks t ON t.id = twl.task_id ${billableSql("t")}
    LEFT JOIN filtered_projects fp ON fp.id = t.project_id
    WHERE tm.team_id = $1
    GROUP BY tm.id, u.name, u.email
    ORDER BY logged_hours DESC`;
  const result = await db.query(q, [filters.teamId, ...params, workingDays]);
  return result.rows;
}

/** 5. Team Utilization - logged hours as a percentage of expected capacity, per member. */
export async function getTeamUtilization(filters: ProjectWidgetFilters, workingDays: number) {
  const rows = await getCapacityVsLogged(filters, workingDays);
  return rows.map(row => ({
    ...row,
    utilization_percent: row.expected_capacity_hours > 0
      ? +((row.logged_hours / row.expected_capacity_hours) * 100).toFixed(2)
      : 0,
  }));
}

/** 6. Billable vs Non-billable Tasks - task counts across the filtered project set. */
export async function getBillableTaskStats(filters: ProjectWidgetFilters) {
  const { projectClause, params } = buildFilters(filters);
  const q = `
    WITH filtered_projects AS (
      SELECT p.id FROM projects p WHERE p.team_id = $1 ${projectClause}
    )
    SELECT
      COUNT(*) FILTER (WHERE t.billable IS TRUE)::INT AS billable,
      COUNT(*) FILTER (WHERE t.billable IS NOT TRUE)::INT AS non_billable
    FROM tasks t
    WHERE t.project_id IN (SELECT id FROM filtered_projects)
      AND t.archived IS FALSE`;
  const result = await db.query(q, [filters.teamId, ...params]);
  return result.rows[0] ?? { billable: 0, non_billable: 0 };
}

/** 7. Billable vs Non-billable Time Logs - logged hours across the filtered project set. */
export async function getBillableTimeLogStats(filters: ProjectWidgetFilters) {
  const { projectClause, timeLogDateClause, params } = buildFilters(filters);
  const q = `
    WITH filtered_projects AS (
      SELECT p.id FROM projects p WHERE p.team_id = $1 ${projectClause}
    )
    SELECT
      ROUND(COALESCE(SUM(twl.time_spent) FILTER (WHERE t.billable IS TRUE), 0) / 3600.0, 2) AS billable_hours,
      ROUND(COALESCE(SUM(twl.time_spent) FILTER (WHERE t.billable IS NOT TRUE), 0) / 3600.0, 2) AS non_billable_hours
    FROM task_work_log twl
    JOIN tasks t ON t.id = twl.task_id
    WHERE t.project_id IN (SELECT id FROM filtered_projects) ${timeLogDateClause}`;
  const result = await db.query(q, [filters.teamId, ...params]);
  return result.rows[0] ?? { billable_hours: 0, non_billable_hours: 0 };
}

/** 8. Client Stats - project/task/logged-hours counts grouped by client, within the filtered set. */
export async function getClientStats(filters: ProjectWidgetFilters) {
  const { projectClause, timeLogDateClause, params, billableSql } = buildFilters(filters);
  const q = `
    WITH filtered_projects AS (
      SELECT p.id, p.client_id FROM projects p WHERE p.team_id = $1 ${projectClause}
    )
    SELECT
      COALESCE(c.name, '') AS client_name,
      fp.client_id,
      COUNT(DISTINCT fp.id)::INT AS project_count,
      COUNT(t.id)::INT AS task_count,
      ROUND(COALESCE(SUM(twl.time_spent), 0) / 3600.0, 2) AS logged_hours
    FROM filtered_projects fp
    LEFT JOIN clients c ON c.id = fp.client_id
    LEFT JOIN tasks t ON t.project_id = fp.id AND t.archived IS FALSE ${billableSql("t")}
    LEFT JOIN task_work_log twl ON twl.task_id = t.id ${timeLogDateClause}
    GROUP BY c.name, fp.client_id
    ORDER BY logged_hours DESC`;
  const result = await db.query(q, [filters.teamId, ...params]);
  return result.rows;
}

export type TaskGroupBy = "assignee" | "project";

/** 9. Projects by Health - project count per sys_project_healths, within the filtered project set. */
export async function getProjectHealthStats(filters: ProjectWidgetFilters) {
  const { projectClause, params } = buildFilters(filters);
  const q = `
    SELECT h.name AS health, h.color_code, COUNT(p.id)::INT AS count
    FROM sys_project_healths h
    LEFT JOIN projects p ON p.health_id = h.id AND p.team_id = $1 ${projectClause}
    GROUP BY h.id, h.name, h.color_code
    ORDER BY count DESC`;
  const result = await db.query(q, [filters.teamId, ...params]);
  return result.rows;
}

/** 10. Incomplete Tasks by Project - count of not-yet-done tasks per project, within the filtered set. */
export async function getIncompleteTasksByProject(filters: ProjectWidgetFilters) {
  const { projectClause, params, billableSql } = buildFilters(filters);
  const incompleteCondition = `is_completed(t.status_id, t.project_id) IS FALSE ${billableSql("t")}`;
  const q = `
    SELECT p.id AS project_id, p.name AS project_name,
      COUNT(t.id) FILTER (WHERE ${incompleteCondition})::INT AS count
    FROM projects p
    LEFT JOIN tasks t ON t.project_id = p.id AND t.archived IS FALSE
    WHERE p.team_id = $1 ${projectClause}
    GROUP BY p.id, p.name
    HAVING COUNT(t.id) FILTER (WHERE ${incompleteCondition}) > 0
    ORDER BY count DESC
    LIMIT 15`;
  const result = await db.query(q, [filters.teamId, ...params]);
  return result.rows;
}

/**
 * Shared by Upcoming Tasks and Overdue Tasks: counts tasks matching `dueCondition` (a SQL boolean
 * expression over `t`), grouped either by project or by assignee. Grouping by assignee counts a
 * multi-assignee task once per assignee, same as a per-person workload view should.
 */
async function getTaskCountsGrouped(filters: ProjectWidgetFilters, groupBy: TaskGroupBy, dueCondition: string) {
  const { projectClause, params, billableSql } = buildFilters(filters);
  const condition = `${dueCondition}${billableSql("t")}`;

  if (groupBy === "assignee") {
    const q = `
      WITH filtered_projects AS (
        SELECT p.id FROM projects p WHERE p.team_id = $1 ${projectClause}
      )
      SELECT tm.id AS group_id, u.name AS group_name, COUNT(DISTINCT t.id)::INT AS count
      FROM tasks t
      JOIN tasks_assignees ta ON ta.task_id = t.id
      JOIN team_members tm ON tm.id = ta.team_member_id
      LEFT JOIN users u ON u.id = tm.user_id
      WHERE t.project_id IN (SELECT id FROM filtered_projects)
        AND t.archived IS FALSE
        AND ${condition}
      GROUP BY tm.id, u.name
      ORDER BY count DESC
      LIMIT 15`;
    const result = await db.query(q, [filters.teamId, ...params]);
    return result.rows;
  }

  const q = `
    SELECT p.id AS group_id, p.name AS group_name,
      COUNT(t.id) FILTER (WHERE ${condition})::INT AS count
    FROM projects p
    LEFT JOIN tasks t ON t.project_id = p.id AND t.archived IS FALSE
    WHERE p.team_id = $1 ${projectClause}
    GROUP BY p.id, p.name
    HAVING COUNT(t.id) FILTER (WHERE ${condition}) > 0
    ORDER BY count DESC
    LIMIT 15`;
  const result = await db.query(q, [filters.teamId, ...params]);
  return result.rows;
}

/** 11. Upcoming Tasks - not-yet-done tasks with a future due date, grouped by assignee or project. */
export async function getUpcomingTasks(filters: ProjectWidgetFilters, groupBy: TaskGroupBy) {
  return getTaskCountsGrouped(filters, groupBy, "t.end_date > CURRENT_TIMESTAMP AND is_completed(t.status_id, t.project_id) IS FALSE");
}

/** 12. Overdue Tasks - tasks past their due date and not done, grouped by project or assignee. */
export async function getOverdueTasksGrouped(filters: ProjectWidgetFilters, groupBy: TaskGroupBy) {
  return getTaskCountsGrouped(filters, groupBy, "is_overdue(t.id) IS TRUE");
}
