/**
 * Sprint membership for software reports.
 *
 * A task is in a sprint when it has a `task_phase` row for that sprint, or when it
 * has no `task_phase` of its own and inherits membership from an ancestor that does
 * (Backlog / board visibility). Inheritance walks every descendant level, not only
 * direct children.
 */

/**
 * Recursive CTE of task ids in a sprint: explicit `task_phase` members plus
 * descendants that do not have their own `task_phase` row.
 *
 * @param phaseIdExpr SQL expression for the sprint UUID (e.g. `$2` or `pp.id`)
 * @param cteName CTE name (must be unique within the enclosing query)
 */
export function buildSprintScopeIdsCte(
  phaseIdExpr: string,
  cteName = "sprint_scope"
): string {
  return `${cteName} AS (
    SELECT tp.task_id AS id
    FROM task_phase tp
    WHERE tp.phase_id = ${phaseIdExpr}
    UNION
    SELECT child.id
    FROM tasks child
    INNER JOIN ${cteName} ss ON child.parent_task_id = ss.id
    WHERE child.archived IS FALSE
      AND NOT EXISTS (SELECT 1 FROM task_phase own WHERE own.task_id = child.id)
  )`;
}

/**
 * Boolean predicate: `taskAlias` is in the sprint identified by `phaseIdExpr`,
 * including inherited membership at any nesting depth.
 */
export function buildSprintMembershipPredicate(
  taskAlias: string,
  phaseIdExpr: string,
  cteName = "sprint_scope"
): string {
  return `${taskAlias}.id IN (
    WITH RECURSIVE ${buildSprintScopeIdsCte(phaseIdExpr, cteName)}
    SELECT id FROM ${cteName}
  )`;
}

/**
 * Live sprint metrics source: explicit members plus inherited descendants.
 * Exposes tasks as alias `t` with status category joins available to the caller
 * via the returned FROM/JOIN fragment ending at `t`.
 *
 * @param phaseIdExpr SQL expression for the sprint UUID (e.g. `pp.id` or `$1::UUID`)
 */
export function buildSprintScopeTasksFrom(phaseIdExpr: string): string {
  return `WITH RECURSIVE sprint_scope AS (
            SELECT t.id, t.story_points, t.status_id, t.issue_type, t.priority_id,
                   t.is_blocked, t.archived, t.completed_at, t.updated_at, t.project_id
            FROM task_phase tp
            INNER JOIN tasks t ON t.id = tp.task_id AND t.archived IS FALSE
            WHERE tp.phase_id = ${phaseIdExpr}
            UNION
            SELECT child.id, child.story_points, child.status_id, child.issue_type, child.priority_id,
                   child.is_blocked, child.archived, child.completed_at, child.updated_at, child.project_id
            FROM tasks child
            INNER JOIN sprint_scope ss ON child.parent_task_id = ss.id
            WHERE child.archived IS FALSE
              AND NOT EXISTS (SELECT 1 FROM task_phase own WHERE own.task_id = child.id)
          )
          SELECT * FROM sprint_scope`;
}
