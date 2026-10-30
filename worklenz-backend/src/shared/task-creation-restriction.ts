import db from "../config/db";
import { PROJECT_ROLE_PERMISSIONS, ProjectRolePermission } from "./organization-permissions";
import { checkProjectRolePermission, checkTaskRolePermission } from "./project-role-permissions";

/**
 * Server-side enforcement for the `restrict_task_creation` Business Plan feature.
 *
 * When the restriction is active for a project (project-level or org-level), only
 * privileged users (Owner/Admin/Team Lead) and Project Managers may create or
 * modify tasks. The `is_task_creation_restricted(user_id, project_id)` DB function
 * encapsulates the plan check, the restriction flags, the team-role check, and the
 * project-manager check, returning TRUE when the given user is NOT allowed to
 * create/modify tasks in the given project.
 *
 * These helpers mirror the frontend `useTaskCreationPermission` gating so the
 * UI-disabled controls cannot be bypassed via direct socket/API calls.
 *
 * Users whose role lacks the required scheme permission ("Edit tasks" by default,
 * "Create tasks" for creation paths) are also treated as restricted.
 */

/**
 * Returns TRUE when task creation/modification is restricted for the given user
 * in the given project. Fails closed (returns TRUE) on any error so a lookup failure
 * never grants access.
 */
export async function isTaskCreationRestricted(
  userId?: string | null,
  projectId?: string | null,
  permission: ProjectRolePermission = PROJECT_ROLE_PERMISSIONS.EDIT_TASKS
): Promise<boolean> {
  if (!userId || !projectId) return false;
  try {
    const result = await db.query(
      "SELECT is_task_creation_restricted($1, $2) AS restricted;",
      [userId, projectId]
    );
    if (result.rows[0]?.restricted === true) return true;

    const rolePermission = await checkProjectRolePermission(userId, projectId, permission);
    return !rolePermission.allowed;
  } catch {
    // Fail closed: an authorization lookup error must not grant access
    return true;
  }
}

/**
 * Same as {@link isTaskCreationRestricted} but resolves the project from the task,
 * for handlers whose payload only carries `task_id`.
 */
export async function isTaskCreationRestrictedForTask(
  userId?: string | null,
  taskId?: string | null,
  permission: ProjectRolePermission = PROJECT_ROLE_PERMISSIONS.EDIT_TASKS
): Promise<boolean> {
  if (!userId || !taskId) return false;
  try {
    const result = await db.query(
      "SELECT is_task_creation_restricted($1, (SELECT project_id FROM tasks WHERE id = $2)) AS restricted;",
      [userId, taskId]
    );
    if (result.rows[0]?.restricted === true) return true;

    const rolePermission = await checkTaskRolePermission(userId, taskId, permission);
    return !rolePermission.allowed;
  } catch {
    // Fail closed: an authorization lookup error must not grant access
    return true;
  }
}
