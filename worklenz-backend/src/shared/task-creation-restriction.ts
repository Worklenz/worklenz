import db from "../config/db";

/**
 * Server-side enforcement for the `restrict_task_creation` Business Plan feature.
 *
 * When the restriction is active for a project (project-level or org-level), only
 * privileged users (Owner/Admin/Team Lead) may create or modify tasks. The
 * `is_task_creation_restricted(user_id, project_id)` DB function encapsulates the
 * plan check, the restriction flags and the role check, returning TRUE when the
 * given user is NOT allowed to create/modify tasks in the given project.
 *
 * These helpers mirror the frontend `useTaskCreationPermission` gating so the
 * UI-disabled controls cannot be bypassed via direct socket/API calls.
 */

/**
 * Returns TRUE when task creation/modification is restricted for the given user
 * in the given project. Fails open (returns FALSE) on any error so a transient DB
 * issue never blocks legitimate edits.
 */
export async function isTaskCreationRestricted(
  userId?: string | null,
  projectId?: string | null
): Promise<boolean> {
  if (!userId || !projectId) return false;
  try {
    const result = await db.query(
      "SELECT is_task_creation_restricted($1, $2) AS restricted;",
      [userId, projectId]
    );
    return result.rows[0]?.restricted === true;
  } catch {
    return false;
  }
}

/**
 * Same as {@link isTaskCreationRestricted} but resolves the project from the task,
 * for handlers whose payload only carries `task_id`.
 */
export async function isTaskCreationRestrictedForTask(
  userId?: string | null,
  taskId?: string | null
): Promise<boolean> {
  if (!userId || !taskId) return false;
  try {
    const result = await db.query(
      "SELECT is_task_creation_restricted($1, (SELECT project_id FROM tasks WHERE id = $2)) AS restricted;",
      [userId, taskId]
    );
    return result.rows[0]?.restricted === true;
  } catch {
    return false;
  }
}
