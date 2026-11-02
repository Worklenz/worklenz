import { PROJECT_ROLE_PERMISSIONS, ProjectRolePermission } from "./organization-permissions";
import { checkProjectRolePermission, checkTaskRolePermission } from "./project-role-permissions";

/**
 * Task create/edit gating from the permission scheme.
 *
 * "Create tasks" / "Edit tasks" (and related) grants in the default or project
 * scheme are the source of truth — including for users who reach a project only
 * through org "View all projects".
 *
 * The legacy Business Plan `restrict_task_creation` toggle used to further
 * limit Members even when Create tasks was granted. That conflicted with the
 * permission matrix; scheme grants now win. Use Roles & Permissions to revoke
 * Create/Edit tasks for a role instead of the blunt toggle.
 */

/**
 * Returns TRUE when the user may not perform the given project permission.
 * Fails closed (returns TRUE) on any error so a lookup failure never grants access.
 */
export async function isTaskCreationRestricted(
  userId?: string | null,
  projectId?: string | null,
  permission: ProjectRolePermission = PROJECT_ROLE_PERMISSIONS.EDIT_TASKS
): Promise<boolean> {
  if (!userId || !projectId) return false;
  try {
    const rolePermission = await checkProjectRolePermission(userId, projectId, permission);
    return !rolePermission.allowed;
  } catch {
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
    const rolePermission = await checkTaskRolePermission(userId, taskId, permission);
    return !rolePermission.allowed;
  } catch {
    return true;
  }
}
