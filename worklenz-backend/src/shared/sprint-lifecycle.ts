import db from "../config/db";

export const SPRINT_RETURNING_COLUMNS =
  "id, name, color_code, start_date, end_date, sprint_status, sprint_goal, sort_index";

export type SprintLifecycleResult<T> = { ok: true; data: T } | { ok: false; error: string };

export interface ICompletedSprint {
  phase: Record<string, any>;
  archivedCount: number;
  movedCount: number;
  destinationPhaseId: string | null;
}

/** Marks a planned sprint active and snapshots its committed scope. Only one sprint may be active per project. */
export async function startSprintRecord(
  projectId: string,
  phaseId: string
): Promise<SprintLifecycleResult<Record<string, any>>> {
  const activeCheck = await db.query(
    `SELECT id, name FROM project_phases
     WHERE project_id = $1 AND sprint_status = 'active' AND id <> $2
     LIMIT 1`,
    [projectId, phaseId]
  );
  if (activeCheck.rows[0]) {
    return {
      ok: false,
      error: `Complete the active sprint "${activeCheck.rows[0].name}" before starting another.`,
    };
  }

  const result = await db.query(
    `UPDATE project_phases
     SET sprint_status = 'active',
         start_date = COALESCE(start_date, CURRENT_TIMESTAMP),
         started_at = COALESCE(started_at, CURRENT_TIMESTAMP),
         committed_points = COALESCE(committed_points, scope.points),
         committed_issue_count = COALESCE(committed_issue_count, scope.issue_count)
     FROM (
       SELECT COALESCE(SUM(t.story_points), 0)::FLOAT AS points, COUNT(*)::INT AS issue_count
       FROM task_phase tp
       INNER JOIN tasks t ON t.id = tp.task_id AND t.archived IS FALSE
       WHERE tp.phase_id = $1
     ) scope
     WHERE id = $1
       AND project_id = $2
       AND sprint_status IN ('planned', 'active')
     RETURNING ${SPRINT_RETURNING_COLUMNS};`,
    [phaseId, projectId]
  );
  const [phase] = result.rows;
  if (!phase) return { ok: false, error: "Sprint not found or already completed" };
  return { ok: true, data: phase };
}

/**
 * Starts the next planned sprint today, keeping its planned length. Picks `preferredPhaseId`
 * when it is a planned sprint, otherwise the earliest planned one. Dated sprints are shifted by
 * whole days so their local day boundaries are kept; undated sprints get `fallbackLengthDays`.
 *
 * @returns the started sprint, or null when there is no planned sprint
 */
export async function startNextSprintNow(
  projectId: string,
  preferredPhaseId: string | null,
  fallbackLengthDays: number
): Promise<Record<string, any> | null> {
  const next = await db.query(
    `SELECT id
     FROM project_phases
     WHERE project_id = $1 AND sprint_status = 'planned'
     ORDER BY (id = $2::UUID) DESC, start_date ASC NULLS LAST, sort_index ASC
     LIMIT 1;`,
    [projectId, preferredPhaseId]
  );
  const nextId: string | undefined = next.rows[0]?.id;
  if (!nextId) return null;

  await db.query(
    `UPDATE project_phases
     SET start_date = CASE
           WHEN start_date IS NOT NULL AND end_date IS NOT NULL
             THEN start_date + shift.days * INTERVAL '1 day'
           ELSE CURRENT_TIMESTAMP
         END,
         end_date = CASE
           WHEN start_date IS NOT NULL AND end_date IS NOT NULL
             THEN end_date + shift.days * INTERVAL '1 day'
           ELSE CURRENT_TIMESTAMP + ($3::INT - 1) * INTERVAL '1 day'
         END
     FROM (
       SELECT FLOOR(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - start_date)) / 86400)::INT AS days
       FROM project_phases
       WHERE id = $1
     ) shift
     WHERE id = $1 AND project_id = $2;`,
    [nextId, projectId, Math.max(1, Math.round(fallbackLengthDays))]
  );

  const started = await startSprintRecord(projectId, nextId);
  return started.ok ? started.data : null;
}

/** Length in days of a sprint with both dates (inclusive), or the 2-week default. */
export function getSprintLengthDays(phase: { start_date?: string | Date | null; end_date?: string | Date | null }): number {
  if (!phase.start_date || !phase.end_date) return DEFAULT_SPRINT_LENGTH_DAYS;
  const days = Math.round(
    (new Date(phase.end_date).getTime() - new Date(phase.start_date).getTime()) / 86_400_000
  );
  return days > 0 ? days : DEFAULT_SPRINT_LENGTH_DAYS;
}

const DEFAULT_SPRINT_LENGTH_DAYS = 14;

/**
 * Completes a sprint: records its outcome, moves unfinished issues to `destinationPhaseId`
 * (a planned sprint) or the backlog (null), and archives Done issues when the project opts in.
 */
export async function completeSprintRecord(
  projectId: string,
  phaseId: string,
  destinationPhaseId: string | null
): Promise<SprintLifecycleResult<ICompletedSprint>> {
  if (destinationPhaseId) {
    const destCheck = await db.query(
      `SELECT id FROM project_phases
       WHERE id = $1 AND project_id = $2 AND sprint_status = 'planned'`,
      [destinationPhaseId, projectId]
    );
    if (!destCheck.rows[0]) {
      return { ok: false, error: "Destination must be a planned sprint or backlog" };
    }
  }

  const client = await db.connect();
  try {
    await client.query("BEGIN");

    const phaseResult = await client.query(
      `UPDATE project_phases
       SET sprint_status = 'completed',
           end_date = COALESCE(end_date, CURRENT_TIMESTAMP),
           started_at = COALESCE(started_at, start_date),
           completed_at = CURRENT_TIMESTAMP,
           completed_points = outcome.done_points,
           completed_issue_count = outcome.done_count,
           carried_over_points = outcome.open_points,
           carried_over_issue_count = outcome.open_count
       FROM (
         SELECT COALESCE(SUM(t.story_points) FILTER (WHERE cat.is_done IS TRUE), 0)::FLOAT AS done_points,
                COUNT(*) FILTER (WHERE cat.is_done IS TRUE)::INT AS done_count,
                COALESCE(SUM(t.story_points) FILTER (WHERE cat.is_done IS NOT TRUE), 0)::FLOAT AS open_points,
                COUNT(*) FILTER (WHERE cat.is_done IS NOT TRUE)::INT AS open_count
         FROM task_phase tp
         INNER JOIN tasks t ON t.id = tp.task_id AND t.archived IS FALSE
         LEFT JOIN task_statuses ts ON ts.id = t.status_id
         LEFT JOIN sys_task_status_categories cat ON cat.id = ts.category_id
         WHERE tp.phase_id = $1
       ) outcome
       WHERE id = $1 AND project_id = $2 AND sprint_status IN ('active', 'planned')
       RETURNING ${SPRINT_RETURNING_COLUMNS}`,
      [phaseId, projectId]
    );
    const [phase] = phaseResult.rows;
    if (!phase) {
      await client.query("ROLLBACK");
      return { ok: false, error: "Sprint not found or already completed" };
    }

    // Move incomplete (not Done-category) issues out of the sprint
    const movedResult = destinationPhaseId
      ? await client.query(
          `UPDATE task_phase tp
           SET phase_id = $1
           FROM tasks t
           INNER JOIN task_statuses ts ON t.status_id = ts.id
           INNER JOIN sys_task_status_categories cat ON ts.category_id = cat.id
           WHERE tp.task_id = t.id
             AND tp.phase_id = $2
             AND t.project_id = $3
             AND cat.is_done IS NOT TRUE
           RETURNING tp.task_id`,
          [destinationPhaseId, phaseId, projectId]
        )
      : await client.query(
          `DELETE FROM task_phase tp
           USING tasks t
           INNER JOIN task_statuses ts ON t.status_id = ts.id
           INNER JOIN sys_task_status_categories cat ON ts.category_id = cat.id
           WHERE tp.task_id = t.id
             AND tp.phase_id = $1
             AND t.project_id = $2
             AND cat.is_done IS NOT TRUE
           RETURNING tp.task_id`,
          [phaseId, projectId]
        );

    const settings = await client.query(
      `SELECT auto_archive_on_sprint_complete, project_type
       FROM projects WHERE id = $1`,
      [projectId]
    );
    const projectSettings = settings.rows[0];
    let archivedCount = 0;
    if (
      projectSettings?.project_type === "software" &&
      projectSettings?.auto_archive_on_sprint_complete !== false
    ) {
      const archiveResult = await client.query(
        `UPDATE tasks t
         SET archived = TRUE
         WHERE t.project_id = $2
           AND t.archived IS FALSE
           AND EXISTS (
             SELECT 1 FROM task_phase tp
             WHERE tp.task_id = t.id AND tp.phase_id = $1
           )
           AND EXISTS (
             SELECT 1
             FROM task_statuses ts
             INNER JOIN sys_task_status_categories cat ON ts.category_id = cat.id
             WHERE ts.id = t.status_id AND cat.is_done IS TRUE
           )
         RETURNING t.id`,
        [phaseId, projectId]
      );
      archivedCount = archiveResult.rowCount || 0;
    }

    await client.query("COMMIT");
    return {
      ok: true,
      data: {
        phase,
        archivedCount,
        movedCount: movedResult.rowCount || 0,
        destinationPhaseId,
      },
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
