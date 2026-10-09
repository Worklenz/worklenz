import {IWorkLenzRequest} from "../interfaces/worklenz-request";
import {IWorkLenzResponse} from "../interfaces/worklenz-response";

import db from "../config/db";
import {ServerResponse} from "../models/server-response";
import WorklenzControllerBase from "./worklenz-controller-base";
import HandleExceptions from "../decorators/handle-exceptions";
import {isValidUuid} from "../shared/validation-helpers";

const DAY_MS = 24 * 60 * 60 * 1000;
const CRITICAL_PRIORITY_VALUE = 3;

interface ISprintRow {
  id: string;
  name: string;
  sprint_status: "planned" | "active" | "completed";
  sprint_goal: string | null;
  start_date: Date | null;
  end_date: Date | null;
  started_at: Date | null;
  completed_at: Date | null;
  committed_points: number | null;
  carried_over_points: number | null;
}

interface ISprintTaskRow {
  story_points: number | null;
  is_done: boolean;
  done_at: Date | null;
  added_at: Date | null;
}

/**
 * First time each task entered an in-progress ("doing") status, falling back to its creation time.
 * Expects `t` to be the tasks alias.
 */
const STARTED_AT_SQL = `
  COALESCE((
    SELECT MIN(tal.created_at)
    FROM task_activity_logs tal
    INNER JOIN task_statuses sts ON sts.id::TEXT = tal.new_value
    INNER JOIN sys_task_status_categories scat ON scat.id = sts.category_id
    WHERE tal.task_id = t.id
      AND tal.attribute_type = 'status'
      AND scat.is_doing IS TRUE
  ), t.created_at)`;

export default class SoftwareReportsController extends WorklenzControllerBase {
  private static readonly VELOCITY_SPRINT_LIMIT = 6;
  private static readonly MAX_BURNDOWN_DAYS = 90;
  private static readonly CYCLE_TREND_WEEKS = 12;
  private static readonly THROUGHPUT_DAYS = 14;

  @HandleExceptions()
  public static async getSprintReport(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const projectId = req.query.project_id as string;
    const requestedSprintId = (req.query.sprint_id as string) || null;
    if (!isValidUuid(projectId) || (requestedSprintId && !isValidUuid(requestedSprintId))) {
      return res.status(400).send(new ServerResponse(false, null, "Invalid request"));
    }

    const sprintsResult = await db.query(
      `SELECT id, name, sprint_status, sprint_goal, start_date, end_date, started_at, completed_at,
              committed_points, carried_over_points
       FROM project_phases
       WHERE project_id = $1 AND sprint_status IN ('active', 'completed')
       ORDER BY (sprint_status = 'active') DESC,
                COALESCE(completed_at, end_date, start_date, created_at) DESC;`,
      [projectId]
    );
    const sprints = sprintsResult.rows as ISprintRow[];
    const sprint = requestedSprintId
      ? sprints.find(item => item.id === requestedSprintId)
      : sprints[0];

    const [summary, burndown, velocity, cycle] = await Promise.all([
      sprint ? this.getSprintSummary(projectId, sprint) : Promise.resolve(null),
      sprint ? this.getBurndown(sprint) : Promise.resolve([]),
      this.getVelocity(projectId),
      this.getCycleTimeStats(projectId),
    ]);

    return res.status(200).send(new ServerResponse(true, {
      sprints: sprints.map(item => ({id: item.id, name: item.name, sprint_status: item.sprint_status})),
      sprint: summary,
      burndown,
      velocity,
      median_cycle_days: cycle.median_cycle_days,
      previous_median_cycle_days: cycle.previous_median_cycle_days,
    }));
  }

  @HandleExceptions()
  public static async getFlowReport(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const projectId = req.query.project_id as string;
    if (!isValidUuid(projectId)) {
      return res.status(400).send(new ServerResponse(false, null, "Invalid project id"));
    }

    const activeSprint = await db.query(
      `SELECT id, name FROM project_phases
       WHERE project_id = $1 AND sprint_status = 'active'
       LIMIT 1;`,
      [projectId]
    );
    const sprint = activeSprint.rows[0] ?? null;

    const scopeFilter = sprint
      ? "AND EXISTS (SELECT 1 FROM task_phase tp WHERE tp.task_id = t.id AND tp.phase_id = $2)"
      : "";
    const scopeParams = sprint ? [projectId, sprint.id] : [projectId];

    const [statusesResult, blockedResult, throughputResult] = await Promise.all([
      db.query(
        `SELECT ts.id,
                ts.name,
                cat.color_code,
                cat.color_code_dark,
                CASE WHEN cat.is_done THEN 'done' WHEN cat.is_doing THEN 'doing' ELSE 'todo' END AS category,
                COUNT(t.id)::INT AS issue_count
         FROM task_statuses ts
         INNER JOIN sys_task_status_categories cat ON cat.id = ts.category_id
         LEFT JOIN tasks t ON t.status_id = ts.id
                          AND t.archived IS FALSE
                          AND t.parent_task_id IS NULL
                          ${scopeFilter}
         WHERE ts.project_id = $1
         GROUP BY ts.id, ts.name, ts.sort_order, cat.color_code, cat.color_code_dark, cat.is_done, cat.is_doing
         ORDER BY ts.sort_order;`,
        scopeParams
      ),
      db.query(
        `SELECT COUNT(*)::INT AS blocked_count
         FROM tasks t
         LEFT JOIN task_statuses ts ON ts.id = t.status_id
         LEFT JOIN sys_task_status_categories cat ON cat.id = ts.category_id
         WHERE t.project_id = $1
           AND t.archived IS FALSE
           AND t.is_blocked IS TRUE
           AND cat.is_done IS NOT TRUE
           ${scopeFilter};`,
        scopeParams
      ),
      db.query(
        `SELECT COUNT(*) FILTER (WHERE t.completed_at >= NOW() - MAKE_INTERVAL(days => $2::INT))::INT AS current_count,
                COUNT(*) FILTER (
                  WHERE t.completed_at <  NOW() - MAKE_INTERVAL(days => $2::INT)
                    AND t.completed_at >= NOW() - MAKE_INTERVAL(days => $2::INT * 2)
                )::INT AS previous_count
         FROM tasks t
         INNER JOIN task_statuses ts ON ts.id = t.status_id
         INNER JOIN sys_task_status_categories cat ON cat.id = ts.category_id
         WHERE t.project_id = $1
           AND t.archived IS FALSE
           AND cat.is_done IS TRUE;`,
        [projectId, this.THROUGHPUT_DAYS]
      ),
    ]);

    return res.status(200).send(new ServerResponse(true, {
      sprint,
      statuses: statusesResult.rows,
      blocked_count: blockedResult.rows[0]?.blocked_count ?? 0,
      throughput_days: this.THROUGHPUT_DAYS,
      throughput_count: throughputResult.rows[0]?.current_count ?? 0,
      previous_throughput_count: throughputResult.rows[0]?.previous_count ?? 0,
    }));
  }

  @HandleExceptions()
  public static async getCycleTimeReport(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const projectId = req.query.project_id as string;
    if (!isValidUuid(projectId)) {
      return res.status(400).send(new ServerResponse(false, null, "Invalid project id"));
    }

    const [stats, trendResult, oldestResult, reopenedResult] = await Promise.all([
      this.getCycleTimeStats(projectId),
      db.query(
        `WITH done AS (
           SELECT t.completed_at,
                  EXTRACT(EPOCH FROM (t.completed_at - ${STARTED_AT_SQL})) / 86400 AS cycle_days
           FROM tasks t
           INNER JOIN task_statuses ts ON ts.id = t.status_id
           INNER JOIN sys_task_status_categories cat ON cat.id = ts.category_id
           WHERE t.project_id = $1
             AND t.archived IS FALSE
             AND cat.is_done IS TRUE
             AND t.completed_at >= DATE_TRUNC('week', NOW()) - MAKE_INTERVAL(weeks => $2::INT)
         )
         SELECT TO_CHAR(DATE_TRUNC('week', completed_at), 'YYYY-MM-DD') AS week_start,
                PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY GREATEST(cycle_days, 0))::FLOAT AS median_days,
                COUNT(*)::INT AS issue_count
         FROM done
         GROUP BY DATE_TRUNC('week', completed_at)
         ORDER BY DATE_TRUNC('week', completed_at);`,
        [projectId, this.CYCLE_TREND_WEEKS - 1]
      ),
      db.query(
        `SELECT t.id,
                CONCAT(p.key, '-', t.task_no) AS task_key,
                t.name,
                EXTRACT(EPOCH FROM (NOW() - ${STARTED_AT_SQL})) / 86400 AS age_days
         FROM tasks t
         INNER JOIN projects p ON p.id = t.project_id
         INNER JOIN task_statuses ts ON ts.id = t.status_id
         INNER JOIN sys_task_status_categories cat ON cat.id = ts.category_id
         WHERE t.project_id = $1
           AND t.archived IS FALSE
           AND cat.is_doing IS TRUE
         ORDER BY age_days DESC
         LIMIT 1;`,
        [projectId]
      ),
      db.query(
        `SELECT COUNT(DISTINCT tal.task_id)::INT AS reopened_count
         FROM task_activity_logs tal
         INNER JOIN tasks t ON t.id = tal.task_id AND t.archived IS FALSE
         INNER JOIN task_statuses old_ts ON old_ts.id::TEXT = tal.old_value
         INNER JOIN sys_task_status_categories old_cat ON old_cat.id = old_ts.category_id
         INNER JOIN task_statuses new_ts ON new_ts.id::TEXT = tal.new_value
         INNER JOIN sys_task_status_categories new_cat ON new_cat.id = new_ts.category_id
         WHERE t.project_id = $1
           AND tal.attribute_type = 'status'
           AND tal.created_at >= NOW() - INTERVAL '30 days'
           AND old_cat.is_done IS TRUE
           AND new_cat.is_done IS NOT TRUE;`,
        [projectId]
      ),
    ]);

    const oldest = oldestResult.rows[0];
    return res.status(200).send(new ServerResponse(true, {
      ...stats,
      trend: trendResult.rows,
      oldest_active_item: oldest
        ? {id: oldest.id, task_key: oldest.task_key, name: oldest.name, age_days: Number(oldest.age_days)}
        : null,
      reopened_count: reopenedResult.rows[0]?.reopened_count ?? 0,
    }));
  }

  private static async getSprintSummary(projectId: string, sprint: ISprintRow) {
    const sprintStart = sprint.started_at ?? sprint.start_date;
    const result = await db.query(
      `SELECT COUNT(*)::INT AS issue_count,
              COUNT(*) FILTER (WHERE cat.is_done IS TRUE)::INT AS done_issue_count,
              COALESCE(SUM(t.story_points), 0)::FLOAT AS total_points,
              COALESCE(SUM(t.story_points) FILTER (WHERE cat.is_done IS TRUE), 0)::FLOAT AS done_points,
              COUNT(*) FILTER (WHERE t.issue_type = 'bug' AND cat.is_done IS NOT TRUE)::INT AS open_bug_count,
              COUNT(*) FILTER (
                WHERE t.issue_type = 'bug' AND cat.is_done IS NOT TRUE AND tp_pr.value >= ${CRITICAL_PRIORITY_VALUE}
              )::INT AS open_critical_bug_count,
              COUNT(*) FILTER (WHERE t.is_blocked IS TRUE AND cat.is_done IS NOT TRUE)::INT AS blocked_count,
              COUNT(*) FILTER (WHERE added.added_at IS NOT NULL)::INT AS scope_added_count,
              COALESCE(SUM(t.story_points) FILTER (WHERE added.added_at IS NOT NULL), 0)::FLOAT AS scope_added_points
       FROM task_phase tp
       INNER JOIN tasks t ON t.id = tp.task_id AND t.archived IS FALSE AND t.project_id = $2
       LEFT JOIN task_statuses ts ON ts.id = t.status_id
       LEFT JOIN sys_task_status_categories cat ON cat.id = ts.category_id
       LEFT JOIN task_priorities tp_pr ON tp_pr.id = t.priority_id
       LEFT JOIN LATERAL (
         SELECT MAX(tal.created_at) AS added_at
         FROM task_activity_logs tal
         WHERE tal.task_id = t.id
           AND tal.attribute_type = 'phase'
           AND tal.new_value = $1::TEXT
           AND $3::TIMESTAMPTZ IS NOT NULL
           AND tal.created_at > $3::TIMESTAMPTZ
       ) added ON TRUE
       WHERE tp.phase_id = $1::UUID;`,
      [sprint.id, projectId, sprintStart]
    );
    const metrics = result.rows[0];
    const carriedOverPoints = Number(sprint.carried_over_points ?? 0);
    const hasSnapshot = sprint.committed_points !== null;
    const committedPoints = hasSnapshot
      ? Number(sprint.committed_points)
      : Math.max(metrics.total_points + carriedOverPoints - metrics.scope_added_points, 0);

    return {
      id: sprint.id,
      name: sprint.name,
      sprint_status: sprint.sprint_status,
      sprint_goal: sprint.sprint_goal,
      start_date: sprint.start_date,
      end_date: sprint.end_date,
      completed_at: sprint.completed_at,
      issue_count: metrics.issue_count,
      done_issue_count: metrics.done_issue_count,
      total_points: metrics.total_points + carriedOverPoints,
      done_points: metrics.done_points,
      committed_points: committedPoints,
      is_committed_estimated: !hasSnapshot,
      scope_added_count: metrics.scope_added_count,
      scope_added_points: metrics.scope_added_points,
      carried_over_points: carriedOverPoints,
      open_bug_count: metrics.open_bug_count,
      open_critical_bug_count: metrics.open_critical_bug_count,
      blocked_count: metrics.blocked_count,
    };
  }

  /** Remaining story points at the end of each sprint day, with an ideal line from the starting scope. */
  private static async getBurndown(sprint: ISprintRow) {
    const startValue = sprint.started_at ?? sprint.start_date;
    if (!startValue) return [];

    const start = this.startOfDay(new Date(startValue));
    const today = this.startOfDay(new Date());
    const plannedEnd = sprint.end_date ? this.startOfDay(new Date(sprint.end_date)) : null;
    const lastDay = plannedEnd && plannedEnd >= start ? plannedEnd : today;
    const dayCount = Math.min(
      Math.round((lastDay.getTime() - start.getTime()) / DAY_MS) + 1,
      this.MAX_BURNDOWN_DAYS
    );
    if (dayCount < 1) return [];

    const tasksResult = await db.query(
      `SELECT t.story_points,
              COALESCE(cat.is_done, FALSE) AS is_done,
              CASE WHEN cat.is_done IS TRUE THEN COALESCE(t.completed_at, t.updated_at) END AS done_at,
              (SELECT MAX(tal.created_at)
               FROM task_activity_logs tal
               WHERE tal.task_id = t.id
                 AND tal.attribute_type = 'phase'
                 AND tal.new_value = $1::TEXT
                 AND tal.created_at > $2::TIMESTAMPTZ) AS added_at
       FROM task_phase tp
       INNER JOIN tasks t ON t.id = tp.task_id AND t.archived IS FALSE
       LEFT JOIN task_statuses ts ON ts.id = t.status_id
       LEFT JOIN sys_task_status_categories cat ON cat.id = ts.category_id
       WHERE tp.phase_id = $1::UUID;`,
      [sprint.id, startValue]
    );

    const sprintTasks = tasksResult.rows as ISprintTaskRow[];
    const carriedOverPoints = Number(sprint.carried_over_points ?? 0);
    const isOpenEnded = sprint.sprint_status === "active";
    const points = [];
    for (let index = 0; index < dayCount; index++) {
      const dayStart = new Date(start.getTime() + index * DAY_MS);
      const dayEnd = new Date(dayStart.getTime() + DAY_MS);
      const isFuture = isOpenEnded && dayStart > today;

      let remaining = carriedOverPoints;
      let scopeAdded = 0;
      for (const task of sprintTasks) {
        const taskPoints = Number(task.story_points ?? 0);
        const addedAt = task.added_at ? new Date(task.added_at) : null;
        if (addedAt && addedAt >= dayEnd) continue;
        if (addedAt && addedAt >= dayStart) scopeAdded += taskPoints;
        const isDoneByDayEnd = task.is_done && task.done_at && new Date(task.done_at) < dayEnd;
        if (!isDoneByDayEnd) remaining += taskPoints;
      }

      points.push({
        date: this.toDateKey(dayStart),
        remaining: isFuture ? null : remaining,
        scope_added: isFuture ? 0 : scopeAdded,
      });
    }

    const startingScope = points[0]?.remaining ?? 0;
    const lastIndex = Math.max(points.length - 1, 1);
    return points.map((point, index) => ({
      ...point,
      ideal: Math.max(startingScope - (startingScope * index) / lastIndex, 0),
    }));
  }

  /** Committed vs completed points for recent completed sprints plus the active sprint. */
  private static async getVelocity(projectId: string) {
    const result = await db.query(
      `SELECT pp.id,
              pp.name,
              pp.sprint_status,
              pp.committed_points,
              COALESCE(pp.completed_points, done.points, 0)::FLOAT AS completed_points
       FROM project_phases pp
       LEFT JOIN LATERAL (
         SELECT SUM(t.story_points) AS points
         FROM task_phase tp
         INNER JOIN tasks t ON t.id = tp.task_id AND t.archived IS FALSE
         INNER JOIN task_statuses ts ON ts.id = t.status_id
         INNER JOIN sys_task_status_categories cat ON cat.id = ts.category_id
         WHERE tp.phase_id = pp.id AND cat.is_done IS TRUE
       ) done ON TRUE
       WHERE pp.project_id = $1
         AND pp.sprint_status IN ('active', 'completed')
       ORDER BY (pp.sprint_status = 'active') DESC,
                COALESCE(pp.completed_at, pp.end_date, pp.start_date, pp.created_at) DESC
       LIMIT $2;`,
      [projectId, this.VELOCITY_SPRINT_LIMIT]
    );
    return result.rows.reverse().map(row => ({
      sprint_id: row.id,
      name: row.name,
      sprint_status: row.sprint_status,
      committed_points: row.committed_points === null ? null : Number(row.committed_points),
      completed_points: Number(row.completed_points),
    }));
  }

  /** Median cycle time (days) for issues completed in the last 30 days and the 30 days before. */
  private static async getCycleTimeStats(projectId: string) {
    const result = await db.query(
      `WITH done AS (
         SELECT t.completed_at,
                GREATEST(EXTRACT(EPOCH FROM (t.completed_at - ${STARTED_AT_SQL})) / 86400, 0) AS cycle_days
         FROM tasks t
         INNER JOIN task_statuses ts ON ts.id = t.status_id
         INNER JOIN sys_task_status_categories cat ON cat.id = ts.category_id
         WHERE t.project_id = $1
           AND t.archived IS FALSE
           AND cat.is_done IS TRUE
           AND t.completed_at >= NOW() - INTERVAL '60 days'
       )
       SELECT
         PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY cycle_days)
           FILTER (WHERE completed_at >= NOW() - INTERVAL '30 days')::FLOAT AS median_cycle_days,
         PERCENTILE_CONT(0.85) WITHIN GROUP (ORDER BY cycle_days)
           FILTER (WHERE completed_at >= NOW() - INTERVAL '30 days')::FLOAT AS p85_cycle_days,
         PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY cycle_days)
           FILTER (WHERE completed_at < NOW() - INTERVAL '30 days')::FLOAT AS previous_median_cycle_days,
         COUNT(*) FILTER (WHERE completed_at >= NOW() - INTERVAL '30 days')::INT AS completed_count
       FROM done;`,
      [projectId]
    );
    const row = result.rows[0] ?? {};
    return {
      median_cycle_days: row.median_cycle_days ?? null,
      p85_cycle_days: row.p85_cycle_days ?? null,
      previous_median_cycle_days: row.previous_median_cycle_days ?? null,
      completed_count: row.completed_count ?? 0,
    };
  }

  private static startOfDay(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  private static toDateKey(date: Date): string {
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${date.getFullYear()}-${month}-${day}`;
  }
}
