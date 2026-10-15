import db from "../config/db";
import { MAX_RANGE_DAYS } from "./reporting-progress-chart.service";

/**
 * Cumulative Flow Diagram and Time in Status widget data (Reports > Overview). Both are built from
 * the status history that `task_activity_logs` already records (attribute_type = 'status', old and
 * new status ids), so no new storage is needed:
 *
 *   - a task is in its creation status from `tasks.created_at` until its first logged change,
 *   - then in each logged `new_value` until the next change,
 *   - a task with no logged change has been in its current status since it was created.
 *
 * Scopes: "project" (one project, one band per status) or "team" (every non-archived-for-the-viewer
 * project of the active team, one band per status category, since statuses differ between
 * projects). Everything is scoped to the active team server-side; ids from the client are only
 * ever used as parameters, never concatenated.
 */

export const FLOW_SCOPES = ["team", "project"] as const;
export type FlowScope = (typeof FLOW_SCOPES)[number];

const DEFAULT_RANGE_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface FlowFilters {
  teamId: string;
  userId: string;
  scope: FlowScope;
  projectId?: string;
  /** Team scope only: restrict to these projects (Time in Status). */
  projectIds?: string[];
  includeSubtasks: boolean;
  includeArchived: boolean;
  /** Only tasks assigned to any of these team members (Time in Status). */
  assigneeIds?: string[];
  /** YYYY-MM-DD */
  dateFrom?: string;
  dateTo?: string;
}

export interface FlowBand {
  id: string;
  name: string;
  color: string;
  category: "todo" | "doing" | "done";
}

export interface CumulativeFlowPoint {
  date: string;
  /** Tasks in each band at the end of the day, keyed by band id; null for days that have not happened yet. */
  counts: Record<string, number> | null;
}

export interface CumulativeFlowResult {
  scope: FlowScope;
  start_date: string;
  end_date: string;
  bands: FlowBand[];
  series: CumulativeFlowPoint[];
  summary: {
    total: number;
    in_progress: number;
    done: number;
    /** Tasks that reached a done status per day over the window. */
    throughput_per_day: number;
    /** Tasks added to the board over the window (total at the end minus total at the start). */
    added: number;
    /** Mean days from creation to completion for tasks completed in the window; null when none were. */
    avg_cycle_days: number | null;
  };
}

export interface TimeInStatusRow {
  band: FlowBand;
  task_count: number;
  avg_hours: number;
  median_hours: number;
  total_hours: number;
}

export interface TimeInStatusResult {
  scope: FlowScope;
  start_date: string;
  end_date: string;
  /** Open (not done) bands, in board order. Time spent in done statuses is not meaningful and is left out. */
  rows: TimeInStatusRow[];
  /** Task-weighted mean time per task across the open bands. */
  avg_hours_overall: number;
}

export interface TimeInStatusTask {
  id: string;
  name: string;
  task_key: string | null;
  project_id: string;
  project_name: string;
  project_color: string;
  status_name: string;
  status_color: string;
  /** Hours since the task entered its current status. */
  hours_in_status: number;
  /** Hours past the due date; null when it has none or is not late. */
  hours_overdue: number | null;
  assignees: TimeInStatusAssignee[];
  updated_at: string;
}

export interface TimeInStatusAssignee {
  id: string;
  name: string;
  avatar_url: string | null;
}

export const MAX_GROUPED_TASKS = 2000;

export const TIME_IN_STATUS_GROUP_BYS = ["project", "status", "assignee"] as const;
export type TimeInStatusGroupBy = (typeof TIME_IN_STATUS_GROUP_BYS)[number];

export interface TimeInStatusTaskQuery {
  search?: string;
  /** Current status names to keep. */
  statusNames?: string[];
  sortField?: string;
  sortOrder?: string;
  index?: number;
  size?: number;
}

export interface TimeInStatusGroup {
  group_id: string;
  group_name: string;
  group_color: string;
  task_count: number;
  avg_hours: number;
  overdue_count: number;
  tasks: TimeInStatusTask[];
}

/** Whitelisted ORDER BY expressions; a client sort field never reaches SQL except through this map. */
const TASK_SORT_COLUMNS: Record<string, string> = {
  task_key: "p.key, t.task_no",
  name: "t.name",
  project_name: "p.name",
  status_name: "ts.name",
  hours_in_status: "q.hours_in_status",
  hours_overdue: "q.hours_overdue",
  updated_at: "t.updated_at",
};
export const DEFAULT_TASK_SORT_FIELD = "hours_in_status";

/** Builds `ORDER BY ...` from the whitelist; unknown fields fall back to longest time in status first. */
export function buildTaskOrderBy(sortField?: string, sortOrder?: string): string {
  const known = Boolean(sortField) && Object.prototype.hasOwnProperty.call(TASK_SORT_COLUMNS, sortField as string);
  const field = known ? (sortField as string) : DEFAULT_TASK_SORT_FIELD;
  const direction = known ? (sortOrder === "desc" ? "DESC" : "ASC") : "DESC";
  const expression = TASK_SORT_COLUMNS[field]
    .split(",")
    .map(part => `${part.trim()} ${direction}${field === "hours_overdue" ? " NULLS LAST" : ""}`)
    .join(", ");
  return `ORDER BY ${expression}, t.id`;
}

const UNASSIGNED_GROUP_ID = "unassigned";

/** Pure grouping of open tasks by project, status or assignee (a task shows under each of its assignees). */
export function groupTimeInStatusTasks(tasks: TimeInStatusTask[], groupBy: TimeInStatusGroupBy): TimeInStatusGroup[] {
  const groups = new Map<string, TimeInStatusGroup>();
  const add = (id: string, name: string, color: string, task: TimeInStatusTask) => {
    const group = groups.get(id) ?? { group_id: id, group_name: name, group_color: color, task_count: 0, avg_hours: 0, overdue_count: 0, tasks: [] };
    group.tasks.push(task);
    groups.set(id, group);
  };
  for (const task of tasks) {
    if (groupBy === "project") add(task.project_id, task.project_name, task.project_color, task);
    else if (groupBy === "status") add(`status:${task.status_name}`, task.status_name, task.status_color, task);
    else if (!task.assignees.length) add(UNASSIGNED_GROUP_ID, "", "#cccccc", task);
    else for (const assignee of task.assignees) add(assignee.id, assignee.name, "#1890ff", task);
  }
  return Array.from(groups.values())
    .map(group => ({
      ...group,
      task_count: group.tasks.length,
      avg_hours: round(group.tasks.reduce((sum, task) => sum + task.hours_in_status, 0) / group.tasks.length),
      overdue_count: group.tasks.filter(task => task.hours_overdue !== null).length,
    }))
    .sort((a, b) => b.task_count - a.task_count || a.group_name.localeCompare(b.group_name));
}

/** Thrown for bad input / missing resources; the controller turns it into a 400/404. */
export class FlowError extends Error {
  constructor(message: string, public readonly status: 400 | 404 = 400) {
    super(message);
  }
}

const toDateKey = (date: Date): string => date.toISOString().slice(0, 10);
const startOfUtcDay = (date: Date): Date => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
const round = (value: number): number => Math.round(value * 100) / 100;

export interface FlowRange {
  start: Date;
  end: Date;
}

/** Inclusive UTC day range; defaults to the last 30 days ending today. Throws FlowError on bad input. */
export function resolveFlowRange(dateFrom: string | undefined, dateTo: string | undefined, now: Date = new Date()): FlowRange {
  const today = startOfUtcDay(now);
  const end = dateTo ? startOfUtcDay(new Date(`${dateTo}T00:00:00Z`)) : today;
  const start = dateFrom ? startOfUtcDay(new Date(`${dateFrom}T00:00:00Z`)) : new Date(end.getTime() - (DEFAULT_RANGE_DAYS - 1) * DAY_MS);
  if (start > end) throw new FlowError("dateFrom must not be after dateTo");
  if ((end.getTime() - start.getTime()) / DAY_MS + 1 > MAX_RANGE_DAYS) throw new FlowError(`The date range cannot exceed ${MAX_RANGE_DAYS} days`);
  return { start, end };
}

interface CumulativeFlowRow {
  day: string;
  band_id: string;
  task_count: number | string;
}

/** Pure shaping of per-day band counts into the widget payload, so it can be unit tested. */
export function buildCumulativeFlow(
  scope: FlowScope,
  range: FlowRange,
  bands: FlowBand[],
  rows: CumulativeFlowRow[],
  avgCycleDays: number | null = null,
  now: Date = new Date()
): CumulativeFlowResult {
  const todayKey = toDateKey(startOfUtcDay(now));
  const byDay = new Map<string, Record<string, number>>();
  for (const row of rows) {
    const counts = byDay.get(row.day) ?? {};
    counts[row.band_id] = Number(row.task_count);
    byDay.set(row.day, counts);
  }

  const series: CumulativeFlowPoint[] = [];
  for (let time = range.start.getTime(); time <= range.end.getTime(); time += DAY_MS) {
    const date = toDateKey(new Date(time));
    if (date > todayKey) {
      series.push({ date, counts: null });
      continue;
    }
    const counts: Record<string, number> = {};
    for (const band of bands) counts[band.id] = byDay.get(date)?.[band.id] ?? 0;
    series.push({ date, counts });
  }

  const sumOf = (point: CumulativeFlowPoint | undefined, category?: FlowBand["category"]): number => {
    if (!point?.counts) return 0;
    return bands.filter(band => !category || band.category === category).reduce((sum, band) => sum + (point.counts?.[band.id] ?? 0), 0);
  };
  const actual = series.filter(point => point.counts !== null);
  const first = actual[0];
  const last = actual[actual.length - 1];
  const spanDays = Math.max(actual.length - 1, 1);

  return {
    scope,
    start_date: toDateKey(range.start),
    end_date: toDateKey(range.end),
    bands,
    series,
    summary: {
      total: sumOf(last),
      in_progress: sumOf(last, "doing"),
      done: sumOf(last, "done"),
      throughput_per_day: round(Math.max(sumOf(last, "done") - sumOf(first, "done"), 0) / spanDays),
      added: Math.max(sumOf(last) - sumOf(first), 0),
      avg_cycle_days: avgCycleDays === null ? null : round(avgCycleDays),
    },
  };
}

interface TimeInStatusSqlRow {
  band_id: string;
  task_count: number | string;
  avg_hours: number | string;
  median_hours: number | string;
  total_hours: number | string;
}

/** Pure shaping of per-band durations into the widget payload; keeps board order and drops done bands. */
export function buildTimeInStatus(
  scope: FlowScope,
  range: FlowRange,
  bands: FlowBand[],
  rows: TimeInStatusSqlRow[]
): TimeInStatusResult {
  const byBand = new Map(rows.map(row => [row.band_id, row]));
  const result: TimeInStatusRow[] = [];
  for (const band of bands) {
    if (band.category === "done") continue;
    const row = byBand.get(band.id);
    if (!row) continue;
    result.push({
      band,
      task_count: Number(row.task_count),
      avg_hours: round(Number(row.avg_hours)),
      median_hours: round(Number(row.median_hours)),
      total_hours: round(Number(row.total_hours)),
    });
  }
  const taskTotal = result.reduce((sum, row) => sum + row.task_count, 0);
  const totalHours = result.reduce((sum, row) => sum + row.total_hours, 0);
  return {
    scope,
    start_date: toDateKey(range.start),
    end_date: toDateKey(range.end),
    rows: result,
    avg_hours_overall: taskTotal ? round(totalHours / taskTotal) : 0,
  };
}

interface ScopedQuery {
  /** SQL for the CTEs shared by both reports: `scoped`, `logs`, `intervals`. */
  ctes: string;
  params: unknown[];
}

/**
 * Shared CTEs. `intervals` has one row per (task, band, [from_at, to_at)) with to_at = infinity for
 * the current state. In team scope a band is a status category, in project scope it is a status.
 */
async function buildScopedQuery(filters: FlowFilters): Promise<ScopedQuery> {
  const params: unknown[] = [];
  let taskFilter: string;

  if (filters.scope === "project") {
    if (!filters.projectId) throw new FlowError("A project is required for the project scope");
    const project = await db.query(`SELECT id FROM projects WHERE id = $1 AND team_id = $2`, [filters.projectId, filters.teamId]);
    if (!project.rows.length) throw new FlowError("Project not found", 404);
    taskFilter = `t.project_id = $${params.push(filters.projectId)}::UUID`;
  } else {
    const teamParam = `$${params.push(filters.teamId)}::UUID`;
    const archivedClause = filters.includeArchived
      ? ""
      : `AND p.id NOT IN (SELECT ap.project_id FROM archived_projects ap WHERE ap.user_id = $${params.push(filters.userId)}::UUID)`;
    const projectClause = filters.projectIds?.length ? `AND p.id = ANY($${params.push(filters.projectIds)}::UUID[])` : "";
    taskFilter = `t.project_id IN (SELECT p.id FROM projects p WHERE p.team_id = ${teamParam} ${archivedClause} ${projectClause})`;
  }

  const subtaskFilter = filters.includeSubtasks ? "" : "AND t.parent_task_id IS NULL";
  const assigneeFilter = filters.assigneeIds?.length
    ? `AND EXISTS(SELECT 1 FROM tasks_assignees ta WHERE ta.task_id = t.id AND ta.team_member_id = ANY($${params.push(filters.assigneeIds)}::UUID[]))`
    : "";
  const bandColumn = filters.scope === "project" ? "ts.id" : "ts.category_id";

  const ctes = `
    scoped AS (
      SELECT t.id, t.created_at, t.status_id
      FROM tasks t
      WHERE ${taskFilter} AND t.archived IS FALSE ${subtaskFilter} ${assigneeFilter}
    ),
    logs AS (
      SELECT tal.task_id, tal.created_at, tal.old_value, tal.new_value,
             LEAD(tal.created_at) OVER (PARTITION BY tal.task_id ORDER BY tal.created_at, tal.id) AS next_at,
             ROW_NUMBER() OVER (PARTITION BY tal.task_id ORDER BY tal.created_at, tal.id)         AS rn
      FROM task_activity_logs tal
             INNER JOIN scoped s ON s.id = tal.task_id
      WHERE tal.attribute_type = 'status'
    ),
    intervals AS (
      -- In the status each logged change moved the task to, until the next change.
      SELECT l.task_id, ${bandColumn} AS band_id, l.created_at AS from_at, COALESCE(l.next_at, 'infinity'::TIMESTAMPTZ) AS to_at
      FROM logs l
             INNER JOIN task_statuses ts ON ts.id::TEXT = l.new_value
      UNION ALL
      -- In its original status, from creation until the first logged change.
      SELECT l.task_id, ${bandColumn}, s.created_at, l.created_at
      FROM logs l
             INNER JOIN scoped s ON s.id = l.task_id
             INNER JOIN task_statuses ts ON ts.id::TEXT = l.old_value
      WHERE l.rn = 1
      UNION ALL
      -- Never changed: in the current status since creation.
      SELECT s.id, ${bandColumn}, s.created_at, 'infinity'::TIMESTAMPTZ
      FROM scoped s
             INNER JOIN task_statuses ts ON ts.id = s.status_id
      WHERE NOT EXISTS(SELECT 1 FROM logs l WHERE l.task_id = s.id)
    )`;

  return { ctes, params };
}

type BandRow = { id: string; name: string; color: string | null; is_done: boolean; is_doing: boolean };

const toBand = (row: BandRow): FlowBand => ({
  id: row.id,
  name: row.name,
  color: row.color ?? "#cccccc",
  category: row.is_done ? "done" : row.is_doing ? "doing" : "todo",
});

/** Board-ordered bands: the project's statuses, or the system status categories for a team. */
async function getBands(filters: FlowFilters): Promise<FlowBand[]> {
  if (filters.scope === "project") {
    const result = await db.query(
      `SELECT ts.id, ts.name, COALESCE(ts.color_code, cat.color_code) AS color, cat.is_done, cat.is_doing
       FROM task_statuses ts
              INNER JOIN sys_task_status_categories cat ON cat.id = ts.category_id
       WHERE ts.project_id = $1
       ORDER BY ts.sort_order, ts.name`,
      [filters.projectId]
    );
    return (result.rows as BandRow[]).map(toBand);
  }
  const result = await db.query(
    `SELECT id, name, color_code AS color, is_done, is_doing FROM sys_task_status_categories ORDER BY index, name`
  );
  return (result.rows as BandRow[]).map(toBand);
}

export async function getCumulativeFlow(filters: FlowFilters): Promise<CumulativeFlowResult> {
  const range = resolveFlowRange(filters.dateFrom, filters.dateTo);
  const { ctes, params } = await buildScopedQuery(filters);
  const startParam = `$${params.push(toDateKey(range.start))}::DATE`;
  const endParam = `$${params.push(toDateKey(range.end))}::DATE`;

  // State at the end of each UTC day: the interval that contains that instant.
  const result = await db.query(
    `WITH ${ctes},
    days AS (
      SELECT d::DATE AS day, ((d::DATE + 1)::TIMESTAMP AT TIME ZONE 'UTC') AS day_end
      FROM GENERATE_SERIES(${startParam}::TIMESTAMP, ${endParam}::TIMESTAMP, INTERVAL '1 day') d
    )
    SELECT TO_CHAR(days.day, 'YYYY-MM-DD') AS day, i.band_id, COUNT(*) AS task_count
    FROM days
           INNER JOIN intervals i ON i.from_at < days.day_end AND i.to_at >= days.day_end
    GROUP BY days.day, i.band_id`,
    params
  );

  const cycle = await db.query(
    `WITH ${ctes}
    SELECT AVG(EXTRACT(EPOCH FROM (t.completed_at - t.created_at)) / 86400)::FLOAT8 AS avg_days
    FROM scoped s
           INNER JOIN tasks t ON t.id = s.id
           INNER JOIN task_statuses ts ON ts.id = t.status_id
           INNER JOIN sys_task_status_categories cat ON cat.id = ts.category_id
    WHERE cat.is_done IS TRUE
      AND t.completed_at >= ${startParam}::TIMESTAMPTZ
      AND t.completed_at < (${endParam}::DATE + 1)::TIMESTAMPTZ`,
    params
  );
  const avgCycleDays = cycle.rows[0]?.avg_days === null || cycle.rows[0]?.avg_days === undefined ? null : Number(cycle.rows[0].avg_days);

  const bands = await getBands(filters);
  return buildCumulativeFlow(filters.scope, range, bands, result.rows as CumulativeFlowRow[], avgCycleDays);
}

export async function getTimeInStatus(filters: FlowFilters): Promise<TimeInStatusResult> {
  const range = resolveFlowRange(filters.dateFrom, filters.dateTo);
  const { ctes, params } = await buildScopedQuery(filters);
  const startParam = `$${params.push(range.start.toISOString())}::TIMESTAMPTZ`;
  const endParam = `$${params.push(new Date(range.end.getTime() + DAY_MS).toISOString())}::TIMESTAMPTZ`;

  // Time is measured inside the window only; a status the task is still in counts up to now.
  const result = await db.query(
    `WITH ${ctes},
    bounds AS (
      SELECT ${startParam} AS w_start, LEAST(${endParam}, NOW()) AS w_end
    ),
    per_task AS (
      SELECT i.task_id, i.band_id,
             SUM(EXTRACT(EPOCH FROM (LEAST(i.to_at, b.w_end) - GREATEST(i.from_at, b.w_start))) / 3600)::FLOAT8 AS hours
      FROM intervals i
             CROSS JOIN bounds b
      WHERE i.from_at < b.w_end AND i.to_at > b.w_start
      GROUP BY i.task_id, i.band_id
    )
    SELECT band_id,
           COUNT(*)                                                   AS task_count,
           AVG(hours)::FLOAT8                                         AS avg_hours,
           PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY hours)::FLOAT8 AS median_hours,
           SUM(hours)::FLOAT8                                         AS total_hours
    FROM per_task
    WHERE hours > 0
    GROUP BY band_id`,
    params
  );

  const bands = await getBands(filters);
  return buildTimeInStatus(filters.scope, range, bands, result.rows as TimeInStatusSqlRow[]);
}

const TASK_SELECT = `
    SELECT t.id,
           t.name,
           CASE WHEN p.key IS NOT NULL AND t.task_no IS NOT NULL THEN p.key || '-' || t.task_no END AS task_key,
           p.id   AS project_id,
           p.name AS project_name,
           p.color_code AS project_color,
           ts.name AS status_name,
           COALESCE(ts.color_code, cat.color_code) AS status_color,
           (EXTRACT(EPOCH FROM (NOW() - COALESCE(
             (SELECT MAX(l.created_at) FROM logs l WHERE l.task_id = t.id AND l.new_value = t.status_id::TEXT),
             t.created_at))) / 3600)::FLOAT8 AS hours_in_status,
           CASE WHEN t.end_date IS NOT NULL AND t.end_date < NOW()
                  THEN (EXTRACT(EPOCH FROM (NOW() - t.end_date)) / 3600)::FLOAT8 END AS hours_overdue,
           COALESCE((SELECT JSON_AGG(JSON_BUILD_OBJECT('id', tmi.team_member_id, 'name', tmi.name, 'avatar_url', tmi.avatar_url) ORDER BY tmi.name)
                     FROM tasks_assignees ta
                            INNER JOIN team_member_info_view tmi ON tmi.team_member_id = ta.team_member_id
                     WHERE ta.task_id = t.id), '[]'::JSON) AS assignees,
           t.updated_at`;

const TASK_FROM = `
    FROM scoped s
           INNER JOIN tasks t ON t.id = s.id
           INNER JOIN projects p ON p.id = t.project_id
           INNER JOIN task_statuses ts ON ts.id = t.status_id
           INNER JOIN sys_task_status_categories cat ON cat.id = ts.category_id`;

const toTimeInStatusTask = (row: Record<string, unknown>): TimeInStatusTask => ({
  id: row.id as string,
  name: row.name as string,
  task_key: (row.task_key as string | null) ?? null,
  project_id: row.project_id as string,
  project_name: row.project_name as string,
  project_color: (row.project_color as string | null) ?? "#cccccc",
  status_name: row.status_name as string,
  status_color: (row.status_color as string | null) ?? "#cccccc",
  hours_in_status: round(Math.max(Number(row.hours_in_status), 0)),
  hours_overdue: row.hours_overdue === null ? null : round(Number(row.hours_overdue)),
  assignees: ((row.assignees as TimeInStatusAssignee[] | null) ?? []).map(a => ({ id: a.id, name: a.name ?? "", avatar_url: a.avatar_url ?? null })),
  updated_at: new Date(row.updated_at as string).toISOString(),
});

/** WHERE clause for open tasks plus the table-only filters; values are pushed onto `params`, never concatenated. */
function buildTaskFilterClause(query: TimeInStatusTaskQuery, params: unknown[]): string {
  const clauses = ["cat.is_done IS FALSE"];
  const search = query.search?.trim();
  if (search) {
    const pattern = `$${params.push(`%${search.replace(/[\\%_]/g, "\\$&")}%`)}`;
    clauses.push(`(t.name ILIKE ${pattern} OR (p.key || '-' || t.task_no) ILIKE ${pattern})`);
  }
  if (query.statusNames?.length) clauses.push(`ts.name = ANY($${params.push(query.statusNames)}::TEXT[])`);
  return clauses.join(" AND ");
}

/** One page of open tasks with how long each has been in its current status. */
export async function getTimeInStatusTasks(
  filters: FlowFilters,
  query: TimeInStatusTaskQuery
): Promise<{ tasks: TimeInStatusTask[]; total: number }> {
  const { ctes, params } = await buildScopedQuery(filters);
  const where = buildTaskFilterClause(query, params);
  const size = Math.min(Math.max(Math.trunc(query.size ?? 10), 1), 100);
  const index = Math.max(Math.trunc(query.index ?? 1), 1);
  const limit = `$${params.push(size)}::INT`;
  const offset = `$${params.push((index - 1) * size)}::INT`;

  const result = await db.query(
    `WITH ${ctes},
    q AS (${TASK_SELECT}${TASK_FROM} WHERE ${where})
    SELECT q.*, COUNT(*) OVER() AS total_count
    FROM q
           INNER JOIN tasks t ON t.id = q.id
           INNER JOIN projects p ON p.id = t.project_id
           INNER JOIN task_statuses ts ON ts.id = t.status_id
    ${buildTaskOrderBy(query.sortField, query.sortOrder)}
    LIMIT ${limit} OFFSET ${offset}`,
    params
  );
  const rows = result.rows as Record<string, unknown>[];
  return { tasks: rows.map(toTimeInStatusTask), total: rows.length ? Number(rows[0].total_count) : 0 };
}

/** Every matching open task up to a cap; used for grouping and export. */
export async function getAllTimeInStatusTasks(
  filters: FlowFilters,
  query: TimeInStatusTaskQuery,
  cap = MAX_GROUPED_TASKS
): Promise<{ tasks: TimeInStatusTask[]; truncated: boolean }> {
  const { ctes, params } = await buildScopedQuery(filters);
  const where = buildTaskFilterClause(query, params);
  const limit = `$${params.push(cap + 1)}::INT`;
  const result = await db.query(
    `WITH ${ctes},
    q AS (${TASK_SELECT}${TASK_FROM} WHERE ${where})
    SELECT q.*
    FROM q
           INNER JOIN tasks t ON t.id = q.id
           INNER JOIN projects p ON p.id = t.project_id
           INNER JOIN task_statuses ts ON ts.id = t.status_id
    ${buildTaskOrderBy(query.sortField, query.sortOrder)}
    LIMIT ${limit}`,
    params
  );
  const rows = result.rows as Record<string, unknown>[];
  return { tasks: rows.slice(0, cap).map(toTimeInStatusTask), truncated: rows.length > cap };
}

export async function getTimeInStatusGroups(
  filters: FlowFilters,
  query: TimeInStatusTaskQuery,
  groupBy: TimeInStatusGroupBy
): Promise<{ groups: TimeInStatusGroup[]; truncated: boolean }> {
  const { tasks, truncated } = await getAllTimeInStatusTasks(filters, query);
  return { groups: groupTimeInStatusTasks(tasks, groupBy), truncated };
}
