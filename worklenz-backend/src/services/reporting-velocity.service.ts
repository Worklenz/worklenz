import db from "../config/db";

/**
 * Velocity widget data (Reports > Overview): committed vs completed work for a project's recent
 * sprints. No new storage: points come from the sprint snapshot columns on `project_phases`
 * (committed_points / completed_points, written when a sprint starts / completes) and fall back to
 * the sprint's current tasks for sprints that have no snapshot yet. Everything is scoped to the
 * active team server-side; ids from the client are only ever used as parameters.
 */

export const VELOCITY_METRICS = ["story_points", "issue_count"] as const;
export type VelocityMetric = (typeof VELOCITY_METRICS)[number];

export const MIN_SPRINT_COUNT = 3;
export const MAX_SPRINT_COUNT = 12;
export const DEFAULT_SPRINT_COUNT = 6;

export interface VelocityFilters {
  teamId: string;
  projectId: string;
  metric: VelocityMetric;
  includeSubtasks: boolean;
  sprintCount: number;
}

export interface VelocitySprint {
  sprint_id: string;
  name: string;
  sprint_status: "active" | "completed";
  committed: number | null;
  completed: number;
  /** ISO dates; the sprint's real start / end when it has them, else the planned ones. */
  start_date: string | null;
  end_date: string | null;
  /** completed / committed as a percentage; null when nothing was committed. */
  completion_rate: number | null;
}

export interface VelocityResult {
  metric: VelocityMetric;
  sprints: VelocitySprint[];
  /** Mean completed work of the completed sprints in the window; null before the first one finishes. */
  average_velocity: number | null;
  /** Sprints that contributed to the average. */
  completed_sprint_count: number;
  /** Highest / lowest completed work among completed sprints; null before the first one finishes. */
  best_sprint: { name: string; completed: number } | null;
  worst_sprint: { name: string; completed: number } | null;
  /** Delivered / committed over completed sprints that had a commitment, as a percentage. */
  commitment_accuracy: number | null;
}

/** Thrown for bad input / missing resources; the controller turns it into a 400/404. */
export class VelocityError extends Error {
  constructor(message: string, public readonly status: 400 | 404 = 400) {
    super(message);
  }
}

export interface VelocitySprintRow {
  id: string;
  name: string;
  sprint_status: "active" | "completed";
  committed: number | string | null;
  completed: number | string | null;
  start_date?: Date | string | null;
  end_date?: Date | string | null;
}

const toIsoDate = (value: Date | string | null | undefined): string | null => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
};

const round = (value: number): number => Math.round(value * 100) / 100;

/** Pure shaping of sprint rows (oldest first) into the widget payload, so it can be unit tested. */
export function buildVelocity(metric: VelocityMetric, rows: VelocitySprintRow[]): VelocityResult {
  const sprints: VelocitySprint[] = rows.map(row => {
    const committed = row.committed === null || row.committed === undefined ? null : round(Number(row.committed));
    const completed = round(Number(row.completed ?? 0));
    return {
      sprint_id: row.id,
      name: row.name,
      sprint_status: row.sprint_status,
      committed,
      completed,
      start_date: toIsoDate(row.start_date),
      end_date: toIsoDate(row.end_date),
      completion_rate: committed && committed > 0 ? Math.round((completed / committed) * 100) : null,
    };
  });

  const finished = sprints.filter(sprint => sprint.sprint_status === "completed");
  const average = finished.length ? round(finished.reduce((sum, sprint) => sum + sprint.completed, 0) / finished.length) : null;
  const committedFinished = finished.filter(sprint => sprint.committed !== null && sprint.committed > 0);
  const committedTotal = committedFinished.reduce((sum, sprint) => sum + (sprint.committed ?? 0), 0);
  const deliveredTotal = committedFinished.reduce((sum, sprint) => sum + sprint.completed, 0);
  const ranked = finished.slice().sort((a, b) => b.completed - a.completed);
  const pick = (sprint: VelocitySprint | undefined) => (sprint ? { name: sprint.name, completed: sprint.completed } : null);

  return {
    metric,
    sprints,
    average_velocity: average,
    completed_sprint_count: finished.length,
    best_sprint: pick(ranked[0]),
    worst_sprint: pick(ranked[ranked.length - 1]),
    commitment_accuracy: committedTotal > 0 ? Math.round((deliveredTotal / committedTotal) * 100) : null,
  };
}

export async function getVelocity(filters: VelocityFilters): Promise<VelocityResult> {
  const project = await db.query(`SELECT id FROM projects WHERE id = $1 AND team_id = $2`, [filters.projectId, filters.teamId]);
  if (!project.rows.length) throw new VelocityError("Project not found", 404);

  const sprintCount = Math.min(Math.max(Math.trunc(filters.sprintCount) || DEFAULT_SPRINT_COUNT, MIN_SPRINT_COUNT), MAX_SPRINT_COUNT);
  const subtaskFilter = filters.includeSubtasks ? "" : "AND t.parent_task_id IS NULL";
  const isPoints = filters.metric === "story_points";

  // Per sprint: everything currently assigned to it, and the part of that which is done.
  const result = await db.query(
    `SELECT pp.id,
            pp.name,
            pp.sprint_status,
            COALESCE(pp.started_at, pp.start_date) AS start_date,
            COALESCE(pp.completed_at, pp.end_date) AS end_date,
            ${isPoints ? "COALESCE(pp.committed_points, work.total)" : "work.total_issues"}::FLOAT8 AS committed,
            ${isPoints ? "COALESCE(pp.completed_points, work.done)" : "work.done_issues"}::FLOAT8 AS completed
     FROM project_phases pp
            LEFT JOIN LATERAL (
       SELECT COALESCE(SUM(COALESCE(t.story_points, 0)), 0)                                    AS total,
              COALESCE(SUM(CASE WHEN cat.is_done IS TRUE THEN COALESCE(t.story_points, 0) END), 0) AS done,
              COUNT(t.id)                                                                      AS total_issues,
              COUNT(t.id) FILTER (WHERE cat.is_done IS TRUE)                                    AS done_issues
       FROM task_phase tp
              INNER JOIN tasks t ON t.id = tp.task_id AND t.archived IS FALSE ${subtaskFilter}
              INNER JOIN task_statuses ts ON ts.id = t.status_id
              INNER JOIN sys_task_status_categories cat ON cat.id = ts.category_id
       WHERE tp.phase_id = pp.id
       ) work ON TRUE
     WHERE pp.project_id = $1
       AND pp.sprint_status IN ('active', 'completed')
     ORDER BY (pp.sprint_status = 'active') DESC,
              COALESCE(pp.completed_at, pp.end_date, pp.start_date, pp.created_at) DESC
     LIMIT $2`,
    [filters.projectId, sprintCount]
  );

  // Newest first from SQL (so LIMIT keeps the latest sprints); charts read oldest to newest.
  return buildVelocity(filters.metric, (result.rows as VelocitySprintRow[]).slice().reverse());
}
