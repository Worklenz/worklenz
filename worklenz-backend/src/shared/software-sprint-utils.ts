import db from "../config/db";

/**
 * Software projects: issues sitting in the "Backlog" status move to "Todo"
 * once they are planned into a sprint. Non-software projects and issues in any
 * other status are left untouched.
 *
 * @returns ids of the tasks whose status was changed
 */
export async function advanceBacklogIssuesToTodo(taskIds: string[]): Promise<string[]> {
  if (!taskIds.length) return [];

  const q = `
    WITH targets AS (
      SELECT t.id, t.project_id
      FROM tasks t
      JOIN projects p ON p.id = t.project_id
      JOIN task_statuses ts ON ts.id = t.status_id
      WHERE t.id = ANY($1::UUID[])
        AND p.project_type = 'software'
        AND LOWER(TRIM(ts.name)) = 'backlog'
    ),
    todo_status AS (
      SELECT DISTINCT ON (ts.project_id) ts.project_id, ts.id
      FROM task_statuses ts
      WHERE ts.project_id IN (SELECT project_id FROM targets)
        AND LOWER(REPLACE(TRIM(ts.name), ' ', '')) = 'todo'
      ORDER BY ts.project_id, ts.sort_order
    )
    UPDATE tasks t
    SET status_id = todo_status.id,
        updated_at = NOW()
    FROM targets
    JOIN todo_status ON todo_status.project_id = targets.project_id
    WHERE t.id = targets.id
    RETURNING t.id;
  `;

  const result = await db.query(q, [taskIds]);
  return result.rows.map((row: { id: string }) => row.id);
}
