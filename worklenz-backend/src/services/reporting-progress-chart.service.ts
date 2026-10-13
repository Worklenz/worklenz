import db from "../config/db";

/**
 * Burnup / Burndown widget data (Reports > Overview). Reads the `task_progress_events` ledger
 * (see the 1791770400003 migration): every row is a signed delta of scope or completed work, so a
 * chart is a running sum over days. Scopes:
 *   - "project": one project, either over a date range or over one sprint (software projects)
 *   - "team":    every (non-archived-for-the-viewer) project of the viewer's active team, over a date range
 * Everything is scoped to the active team server-side; ids from the client are only ever used as
 * parameters, never concatenated.
 */

export const PROGRESS_SCOPES = ["team", "project"] as const;
export type ProgressScope = (typeof PROGRESS_SCOPES)[number];

export const PROGRESS_METRICS = ["story_points", "issue_count", "estimated_hours"] as const;
export type ProgressMetric = (typeof PROGRESS_METRICS)[number];

export const PROGRESS_SOURCES = ["range", "sprint"] as const;
export type ProgressSource = (typeof PROGRESS_SOURCES)[number];

export const MAX_RANGE_DAYS = 366;
const DEFAULT_RANGE_DAYS = 30;
const FORECAST_WINDOW_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface ProgressChartFilters {
  teamId: string;
  userId: string;
  scope: ProgressScope;
  projectId?: string;
  source: ProgressSource;
  sprintId?: string;
  metric: ProgressMetric;
  includeSubtasks: boolean;
  includeArchived: boolean;
  /** YYYY-MM-DD; ignored for sprint source. */
  dateFrom?: string;
  dateTo?: string;
  forecast: boolean;
}

export interface ProgressChartPoint {
  date: string;
  /** null for days that have not happened yet. */
  scope: number | null;
  completed: number | null;
  remaining: number | null;
  ideal_remaining: number;
  ideal_completed: number;
  /** Projected remaining work for today and later days, when a forecast was requested and is possible. */
  forecast_remaining: number | null;
}

export interface ProgressChartSummary {
  scope: number;
  completed: number;
  remaining: number;
  /** Scope at the end of the window minus scope at its start: positive means scope creep. */
  scope_change: number;
  velocity_per_day: number;
  projected_finish: string | null;
  /** null when it cannot be judged (nothing left to do is "on track"; no velocity and work left is unknown). */
  on_track: boolean | null;
}

export interface ProgressChartResult {
  scope: ProgressScope;
  source: ProgressSource;
  metric: ProgressMetric;
  start_date: string;
  end_date: string;
  sprint: { id: string; name: string; sprint_status: string } | null;
  series: ProgressChartPoint[];
  summary: ProgressChartSummary;
  /** True when the window includes history rebuilt from task timestamps rather than recorded events. */
  has_estimated_history: boolean;
}

/** Thrown for bad input / missing resources; the controller turns it into a 400/404. */
export class ProgressChartError extends Error {
  constructor(message: string, public readonly status: 400 | 404 = 400) {
    super(message);
  }
}

/** Column triple per metric. Whitelisted, so interpolating them into SQL is safe. */
const METRIC_COLUMNS: Record<ProgressMetric, { scope: string; done: string }> = {
  story_points: { scope: "d_scope_points", done: "d_done_points" },
  issue_count: { scope: "d_scope_issues", done: "d_done_issues" },
  estimated_hours: { scope: "d_scope_minutes", done: "d_done_minutes" },
};

const toDateKey = (date: Date): string => date.toISOString().slice(0, 10);
const startOfUtcDay = (date: Date): Date => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
const round = (value: number): number => Math.round(value * 100) / 100;

/** Minutes -> hours for the estimate metric; other metrics pass through. */
const normalise = (metric: ProgressMetric, value: number): number => round(metric === "estimated_hours" ? value / 60 : value);

interface ResolvedWindow {
  start: Date;
  end: Date;
  /** Exclusive upper bound for events (sprint completion time clamps it). */
  eventsUntil: Date;
  sprint: ProgressChartResult["sprint"];
  /** SQL fragment over alias `e`, using $2 (project / sprint id) or the team's project list. */
  eventFilter: string;
  params: unknown[];
}

async function resolveWindow(filters: ProgressChartFilters): Promise<ResolvedWindow> {
  const today = startOfUtcDay(new Date());
  const params: unknown[] = [filters.teamId];

  if (filters.scope === "project") {
    if (!filters.projectId) throw new ProgressChartError("A project is required for the project scope");
    const project = await db.query(`SELECT id FROM projects WHERE id = $1 AND team_id = $2`, [filters.projectId, filters.teamId]);
    if (!project.rows.length) throw new ProgressChartError("Project not found", 404);
    params.push(filters.projectId);
  }

  if (filters.scope === "project" && filters.source === "sprint") {
    if (!filters.sprintId) throw new ProgressChartError("A sprint is required for the sprint source");
    const sprintResult = await db.query(
      `SELECT id, name, sprint_status, started_at, completed_at, start_date, end_date, created_at
       FROM project_phases
       WHERE id = $1 AND project_id = $2 AND sprint_status IN ('active', 'completed')`,
      [filters.sprintId, filters.projectId]
    );
    const sprint = sprintResult.rows[0];
    if (!sprint) throw new ProgressChartError("Sprint not found", 404);

    const start = startOfUtcDay(new Date(sprint.started_at ?? sprint.start_date ?? sprint.created_at));
    const plannedEnd = sprint.end_date ? startOfUtcDay(new Date(sprint.end_date)) : null;
    const completedAt = sprint.completed_at ? new Date(sprint.completed_at) : null;

    let end = completedAt ? startOfUtcDay(completedAt) : plannedEnd && plannedEnd >= today ? plannedEnd : today;
    if (end < start) end = start;
    if ((end.getTime() - start.getTime()) / DAY_MS + 1 > MAX_RANGE_DAYS) end = new Date(start.getTime() + (MAX_RANGE_DAYS - 1) * DAY_MS);

    params.push(filters.sprintId);
    return {
      start,
      end,
      eventsUntil: completedAt ?? new Date(end.getTime() + DAY_MS),
      sprint: { id: sprint.id, name: sprint.name, sprint_status: sprint.sprint_status },
      eventFilter: `e.phase_id = $3::UUID AND e.project_id = $2::UUID`,
      params,
    };
  }

  const end = filters.dateTo ? startOfUtcDay(new Date(`${filters.dateTo}T00:00:00Z`)) : today;
  const start = filters.dateFrom
    ? startOfUtcDay(new Date(`${filters.dateFrom}T00:00:00Z`))
    : new Date(end.getTime() - (DEFAULT_RANGE_DAYS - 1) * DAY_MS);
  if (start > end) throw new ProgressChartError("dateFrom must not be after dateTo");
  if ((end.getTime() - start.getTime()) / DAY_MS + 1 > MAX_RANGE_DAYS) {
    throw new ProgressChartError(`The date range cannot exceed ${MAX_RANGE_DAYS} days`);
  }

  let eventFilter: string;
  if (filters.scope === "project") {
    eventFilter = `e.phase_id IS NULL AND e.project_id = $2::UUID`;
  } else {
    // Team scope: the team's projects, minus the ones the viewer archived (unless asked to include them).
    const archivedClause = filters.includeArchived
      ? ""
      : `AND p.id NOT IN (SELECT ap.project_id FROM archived_projects ap WHERE ap.user_id = $2::UUID)`;
    if (!filters.includeArchived) params.push(filters.userId);
    eventFilter = `e.phase_id IS NULL AND e.project_id IN (SELECT p.id FROM projects p WHERE p.team_id = $1::UUID ${archivedClause})`;
  }

  return { start, end, eventsUntil: new Date(end.getTime() + DAY_MS), sprint: null, eventFilter, params };
}

export async function getProgressChart(filters: ProgressChartFilters): Promise<ProgressChartResult> {
  const window = await resolveWindow(filters);
  const columns = METRIC_COLUMNS[filters.metric];
  const { start, end, eventsUntil, eventFilter } = window;

  const subtaskFilter = filters.includeSubtasks ? "" : "AND e.is_subtask IS FALSE";
  const params = [...window.params];
  const startParam = `$${params.push(start.toISOString())}::TIMESTAMPTZ`;
  const untilParam = `$${params.push(eventsUntil.toISOString())}::TIMESTAMPTZ`;
  const endDayParam = `$${params.push(toDateKey(end))}::DATE`;
  const startDayParam = `$${params.push(toDateKey(start))}::DATE`;

  const q = `
    WITH days AS (
      SELECT d::DATE AS day FROM GENERATE_SERIES(${startDayParam}::TIMESTAMP, ${endDayParam}::TIMESTAMP, INTERVAL '1 day') d
    ),
    base AS (
      SELECT COALESCE(SUM(e.${columns.scope}), 0)::FLOAT8 AS scope,
             COALESCE(SUM(e.${columns.done}), 0)::FLOAT8  AS done
      FROM task_progress_events e
      WHERE ${eventFilter} ${subtaskFilter}
        AND e.occurred_at < ${startParam}
    ),
    daily AS (
      SELECT (e.occurred_at AT TIME ZONE 'UTC')::DATE AS day,
             SUM(e.${columns.scope})::FLOAT8 AS d_scope,
             SUM(e.${columns.done})::FLOAT8  AS d_done
      FROM task_progress_events e
      WHERE ${eventFilter} ${subtaskFilter}
        AND e.occurred_at >= ${startParam}
        AND e.occurred_at < ${untilParam}
      GROUP BY 1
    )
    SELECT TO_CHAR(days.day, 'YYYY-MM-DD') AS day,
           (base.scope + SUM(COALESCE(daily.d_scope, 0)) OVER (ORDER BY days.day))::FLOAT8 AS scope,
           (base.done  + SUM(COALESCE(daily.d_done, 0))  OVER (ORDER BY days.day))::FLOAT8 AS done,
           EXISTS(SELECT 1 FROM task_progress_events e
                  WHERE ${eventFilter} ${subtaskFilter}
                    AND e.source = 'backfill'
                    AND e.occurred_at < ${untilParam}) AS has_estimated
    FROM days
           CROSS JOIN base
           LEFT JOIN daily ON daily.day = days.day
    ORDER BY days.day`;

  const result = await db.query(q, params);
  const rows = result.rows as { day: string; scope: number; done: number; has_estimated: boolean }[];

  const today = startOfUtcDay(new Date());
  const todayKey = toDateKey(today);
  const dayCount = rows.length;
  const first = rows[0];
  const scopeStart = first?.scope ?? 0;
  const remainingStart = Math.max(scopeStart - (first?.done ?? 0), 0);
  const lastIndex = Math.max(dayCount - 1, 1);

  // Velocity: net completed work per day over the trailing window ending today (or the window's end).
  const lastActualIndex = rows.reduce((found, row, index) => (row.day <= todayKey ? index : found), -1);
  const actualRows = lastActualIndex >= 0 ? rows.slice(0, lastActualIndex + 1) : [];
  const latest = actualRows[actualRows.length - 1];
  const windowStartIndex = Math.max(actualRows.length - 1 - FORECAST_WINDOW_DAYS, 0);
  const spanDays = actualRows.length - 1 - windowStartIndex;
  const velocity =
    latest && spanDays > 0 ? Math.max((latest.done - actualRows[windowStartIndex].done) / spanDays, 0) : 0;
  const remainingNow = latest ? Math.max(latest.scope - latest.done, 0) : 0;
  const isSprintCompleted = window.sprint?.sprint_status === "completed";
  const canForecast = filters.forecast && !isSprintCompleted && velocity > 0 && remainingNow > 0 && latest !== undefined;

  const series: ProgressChartPoint[] = rows.map((row, index) => {
    const isFuture = row.day > todayKey;
    const idealRemaining = remainingStart * (1 - index / lastIndex);
    let forecastRemaining: number | null = null;
    if (canForecast && latest && row.day >= latest.day) {
      const daysAhead = (new Date(`${row.day}T00:00:00Z`).getTime() - new Date(`${latest.day}T00:00:00Z`).getTime()) / DAY_MS;
      forecastRemaining = normalise(filters.metric, Math.max(remainingNow - velocity * daysAhead, 0));
    }
    return {
      date: row.day,
      scope: isFuture ? null : normalise(filters.metric, row.scope),
      completed: isFuture ? null : normalise(filters.metric, row.done),
      remaining: isFuture ? null : normalise(filters.metric, Math.max(row.scope - row.done, 0)),
      ideal_remaining: normalise(filters.metric, Math.max(idealRemaining, 0)),
      ideal_completed: normalise(filters.metric, Math.min(scopeStart - idealRemaining, scopeStart)),
      forecast_remaining: forecastRemaining,
    };
  });

  let projectedFinish: string | null = null;
  let onTrack: boolean | null = null;
  if (remainingNow === 0 && latest) {
    onTrack = true;
  } else if (velocity > 0 && latest) {
    const finish = new Date(startOfUtcDay(new Date(`${latest.day}T00:00:00Z`)).getTime() + Math.ceil(remainingNow / velocity) * DAY_MS);
    projectedFinish = toDateKey(finish);
    onTrack = finish <= end;
  }

  return {
    scope: filters.scope,
    source: filters.source,
    metric: filters.metric,
    start_date: toDateKey(start),
    end_date: toDateKey(end),
    sprint: window.sprint,
    series,
    summary: {
      scope: normalise(filters.metric, latest?.scope ?? 0),
      completed: normalise(filters.metric, latest?.done ?? 0),
      remaining: normalise(filters.metric, remainingNow),
      scope_change: normalise(filters.metric, (latest?.scope ?? 0) - scopeStart),
      velocity_per_day: normalise(filters.metric, velocity),
      projected_finish: projectedFinish,
      on_track: onTrack,
    },
    has_estimated_history: Boolean(first?.has_estimated),
  };
}

export interface ProgressChartOptions {
  projects: { id: string; name: string; project_type: string }[];
  sprints: { id: string; name: string; sprint_status: string }[];
}

/** Pickers for the widget's settings: the active team's projects and (for a project) its sprints. */
export async function getProgressChartOptions(teamId: string, userId: string, projectId?: string): Promise<ProgressChartOptions> {
  const projects = await db.query(
    `SELECT p.id, p.name, p.project_type
     FROM projects p
     WHERE p.team_id = $1
       AND p.id NOT IN (SELECT ap.project_id FROM archived_projects ap WHERE ap.user_id = $2)
     ORDER BY p.name`,
    [teamId, userId]
  );

  let sprints: ProgressChartOptions["sprints"] = [];
  if (projectId) {
    const result = await db.query(
      `SELECT pp.id, pp.name, pp.sprint_status
       FROM project_phases pp
              JOIN projects p ON p.id = pp.project_id AND p.team_id = $2
       WHERE pp.project_id = $1
         AND pp.sprint_status IN ('active', 'completed')
       ORDER BY (pp.sprint_status = 'active') DESC, COALESCE(pp.completed_at, pp.end_date, pp.start_date, pp.created_at) DESC`,
      [projectId, teamId]
    );
    sprints = result.rows;
  }
  return { projects: projects.rows, sprints };
}
