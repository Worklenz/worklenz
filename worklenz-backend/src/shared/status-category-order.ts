import db from '../config/db';

// NFR-2: order is project-level, not per-user.
// Resolved at runtime from the DB so UUIDs match any environment.

/** Returns [doing_id, todo_id, done_id] as the application-level default. */
export async function getDefaultCategoryOrder(): Promise<string[]> {
  const result = await db.query(`
    SELECT id, is_todo, is_doing, is_done
    FROM sys_task_status_categories
    WHERE is_todo = TRUE OR is_doing = TRUE OR is_done = TRUE
  `);
  const rows = result.rows as Array<{ id: string; is_todo: boolean; is_doing: boolean; is_done: boolean }>;
  const doing = rows.find(r => r.is_doing)?.id ?? '';
  const todo = rows.find(r => r.is_todo)?.id ?? '';
  const done = rows.find(r => r.is_done)?.id ?? '';
  return [doing, todo, done];
}

/**
 * Returns the project's saved status_category_order if non-null,
 * else the default [doing, todo, done] derived from sys_task_status_categories.
 */
export async function resolveProjectCategoryOrder(projectId: string): Promise<string[]> {
  const result = await db.query(
    'SELECT status_category_order FROM projects WHERE id = $1',
    [projectId]
  );
  const row = result.rows[0];
  if (row?.status_category_order && Array.isArray(row.status_category_order) && row.status_category_order.length === 3) {
    return row.status_category_order as string[];
  }
  return getDefaultCategoryOrder();
}
