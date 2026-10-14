import {PoolClient} from "pg";

import db from "../config/db";
import { log_error } from "./utils";

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
  phaseId: string,
  client?: PoolClient
): Promise<SprintLifecycleResult<Record<string, any>>> {
  const executor = client ?? db;
  const activeCheck = await executor.query(
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

  const result = await executor.query(
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
 * Locks the candidate and commits its date shift only when the start succeeds.
 *
 * @returns the started sprint, or null when there is no planned sprint
 */
export async function startNextSprintNow(
  projectId: string,
  preferredPhaseId: string | null,
  fallbackLengthDays: number
): Promise<Record<string, any> | null> {
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const next = await client.query(
      `SELECT id
       FROM project_phases
       WHERE project_id = $1 AND sprint_status = 'planned'
       ORDER BY (id = $2::UUID) DESC, start_date ASC NULLS LAST, sort_index ASC
       LIMIT 1 FOR UPDATE;`,
      [projectId, preferredPhaseId]
    );
    const nextId: string | undefined = next.rows[0]?.id;
    if (!nextId) {
      await client.query("ROLLBACK");
      return null;
    }

    await client.query(
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

    const started = await startSprintRecord(projectId, nextId, client);
    if (!started.ok) {
      await client.query("ROLLBACK");
      return null;
    }
    await client.query("COMMIT");
    return started.data;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/** Completion is already committed; an optional next-sprint failure must not hide it. */
export async function tryStartNextSprintAfterCompletion(
  projectId: string,
  destinationPhaseId: string | null,
  lengthDays: number
): Promise<Record<string, unknown> | null> {
  try {
    const settings = await db.query(
      "SELECT auto_start_complete_sprints FROM projects WHERE id = $1 AND project_type = 'software'",
      [projectId]
    );
    if (settings.rows[0]?.auto_start_complete_sprints !== true) return null;
    return await startNextSprintNow(projectId, destinationPhaseId, lengthDays);
  } catch (error) {
    log_error(error);
    return null;
  }
}

/**
 * Sprint issues that must leave a completing sprint: every issue that is not Done, every issue
 * with an unfinished (non-archived) subtask at any depth — even when the issue itself is Done —
 * and the in-sprint subtasks of all of those, so a parent and its subtasks move together.
 */
async function getCarryOverTaskIds(client: PoolClient, projectId: string, phaseId: string): Promise<string[]> {
  const result = await client.query(
    `WITH RECURSIVE
       sprint_tasks AS (
         SELECT t.id, t.parent_task_id, cat.is_done
         FROM task_phase tp
         INNER JOIN tasks t ON t.id = tp.task_id AND t.project_id = $1
         LEFT JOIN task_statuses ts ON ts.id = t.status_id
         LEFT JOIN sys_task_status_categories cat ON cat.id = ts.category_id
         WHERE tp.phase_id = $2
       ),
       -- Unfinished subtasks and all of their ancestors
       open_lineage AS (
         SELECT t.parent_task_id AS id
         FROM tasks t
         INNER JOIN task_statuses ts ON ts.id = t.status_id
         INNER JOIN sys_task_status_categories cat ON cat.id = ts.category_id
         WHERE t.project_id = $1
           AND t.parent_task_id IS NOT NULL
           AND t.archived IS FALSE
           AND cat.is_done IS NOT TRUE
         UNION
         SELECT parent.parent_task_id
         FROM tasks parent
         INNER JOIN open_lineage ol ON parent.id = ol.id
         WHERE parent.parent_task_id IS NOT NULL
       ),
       carry AS (
         SELECT st.id
         FROM sprint_tasks st
         WHERE st.is_done IS NOT TRUE
            OR st.id IN (SELECT id FROM open_lineage)
         UNION
         SELECT child.id
         FROM tasks child
         INNER JOIN carry ON child.parent_task_id = carry.id
       )
     SELECT st.id
     FROM sprint_tasks st
     WHERE st.id IN (SELECT id FROM carry);`,
    [projectId, phaseId]
  );
  return result.rows.map((row: { id: string }) => row.id);
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

    const carryOverIds = await getCarryOverTaskIds(client, projectId, phaseId);
    const movedResult = destinationPhaseId
      ? await client.query(
          `UPDATE task_phase
           SET phase_id = $1
           WHERE phase_id = $2 AND task_id = ANY($3::UUID[])
           RETURNING task_id`,
          [destinationPhaseId, phaseId, carryOverIds]
        )
      : await client.query(
          `DELETE FROM task_phase
           WHERE phase_id = $1 AND task_id = ANY($2::UUID[])
           RETURNING task_id`,
          [phaseId, carryOverIds]
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
