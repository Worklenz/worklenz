import db from "../config/db";
import { log_error } from "./utils";
import { normalizeTeamRoleName, TEAM_ROLE_NAMES } from "./team-permissions";
import {
  getProjectSchemeRoleGrants,
  GUEST_ROLE_NAME,
  PROJECT_ROLE_PERMISSIONS,
  ProjectRolePermission,
} from "./organization-permissions";

/**
 * Project-level role permissions (Create/Edit/Delete tasks, Comment) come from
 * the project's assigned permission scheme, falling back to the default scheme:
 * - Owner / Admin always hold them.
 * - Members and Guests only hold them on projects they are assigned to; projects
 *   visible only through "View all projects" are view-only.
 * - Project settings such as restrict_task_creation are enforced separately and
 *   take priority over these grants.
 */

export interface IProjectRoleContext {
  teamId: string;
  projectId: string;
  roleName: string;
  isProjectMember: boolean;
}

export interface IProjectRolePermissionResult {
  allowed: boolean;
  roleName: string | null;
}

export type IProjectRolePermissionFlags = Record<
  "create_tasks" | "edit_tasks" | "delete_tasks" | "comment",
  boolean
>;

const ROLE_CONTEXT_SELECT = `
  SELECT p.team_id,
         p.id AS project_id,
         r.name AS role_name,
         r.owner,
         COALESCE(tm.is_guest, FALSE) AS is_team_guest,
         (pm.id IS NOT NULL) AS is_project_member,
         COALESCE(pal.key = 'GUEST', FALSE) AS is_project_guest
  FROM projects p
  INNER JOIN team_members tm ON tm.team_id = p.team_id AND tm.user_id = $1 AND tm.active = TRUE
  INNER JOIN roles r ON r.id = tm.role_id
  LEFT JOIN project_members pm ON pm.project_id = p.id AND pm.team_member_id = tm.id
  LEFT JOIN project_access_levels pal ON pal.id = pm.project_access_level_id
`;

interface IRoleContextRow {
  team_id: string;
  project_id: string;
  role_name: string | null;
  owner: boolean;
  is_team_guest: boolean;
  is_project_member: boolean;
  is_project_guest: boolean;
}

const toRoleContext = (row: IRoleContextRow): IProjectRoleContext => {
  const teamRole = row.owner ? TEAM_ROLE_NAMES.OWNER : normalizeTeamRoleName(row.role_name);
  const isGuest = teamRole === TEAM_ROLE_NAMES.MEMBER && (row.is_team_guest || row.is_project_guest);
  return {
    teamId: row.team_id,
    projectId: row.project_id,
    roleName: isGuest ? GUEST_ROLE_NAME : teamRole,
    isProjectMember: row.is_project_member,
  };
};

export async function getProjectRoleContext(
  userId: string,
  projectId: string
): Promise<IProjectRoleContext | null> {
  const result = await db.query(`${ROLE_CONTEXT_SELECT} WHERE p.id = $2 LIMIT 1`, [userId, projectId]);
  return result.rows[0] ? toRoleContext(result.rows[0]) : null;
}

export async function getProjectRoleContextForTask(
  userId: string,
  taskId: string
): Promise<IProjectRoleContext | null> {
  const result = await db.query(
    `${ROLE_CONTEXT_SELECT} WHERE p.id = (SELECT project_id FROM tasks WHERE id = $2) LIMIT 1`,
    [userId, taskId]
  );
  return result.rows[0] ? toRoleContext(result.rows[0]) : null;
}

const getGrantedPermissions = async (
  context: IProjectRoleContext,
  permissions: ProjectRolePermission[]
): Promise<ProjectRolePermission[]> => {
  if (context.roleName === TEAM_ROLE_NAMES.OWNER || context.roleName === TEAM_ROLE_NAMES.ADMIN) {
    return permissions;
  }

  const isMemberOrGuest =
    context.roleName === TEAM_ROLE_NAMES.MEMBER || context.roleName === GUEST_ROLE_NAME;
  if (isMemberOrGuest && !context.isProjectMember) return [];

  return (await getProjectSchemeRoleGrants(
    context.teamId,
    context.projectId,
    context.roleName,
    permissions
  )) as ProjectRolePermission[];
};

const checkContextPermission = async (
  context: IProjectRoleContext | null,
  permission: ProjectRolePermission
): Promise<IProjectRolePermissionResult> => {
  if (!context) return { allowed: false, roleName: null };
  const granted = await getGrantedPermissions(context, [permission]);
  return { allowed: granted.includes(permission), roleName: context.roleName };
};

export async function checkProjectRolePermission(
  userId: string | null | undefined,
  projectId: string | null | undefined,
  permission: ProjectRolePermission
): Promise<IProjectRolePermissionResult> {
  if (!userId || !projectId) return { allowed: false, roleName: null };
  return checkContextPermission(await getProjectRoleContext(userId, projectId), permission);
}

export async function checkTaskRolePermission(
  userId: string | null | undefined,
  taskId: string | null | undefined,
  permission: ProjectRolePermission
): Promise<IProjectRolePermissionResult> {
  if (!userId || !taskId) return { allowed: false, roleName: null };
  return checkContextPermission(await getProjectRoleContextForTask(userId, taskId), permission);
}

/** Flags sent to the frontend so it can hide controls the user cannot use. */
export async function getProjectRolePermissionFlags(
  userId: string | null | undefined,
  projectId: string | null | undefined
): Promise<IProjectRolePermissionFlags> {
  const denied = { create_tasks: false, edit_tasks: false, delete_tasks: false, comment: false };
  if (!userId || !projectId) return denied;

  try {
    const context = await getProjectRoleContext(userId, projectId);
    if (!context) return denied;

    const granted = await getGrantedPermissions(context, [
      PROJECT_ROLE_PERMISSIONS.CREATE_TASKS,
      PROJECT_ROLE_PERMISSIONS.EDIT_TASKS,
      PROJECT_ROLE_PERMISSIONS.DELETE_TASKS,
      PROJECT_ROLE_PERMISSIONS.COMMENT,
    ]);

    return {
      create_tasks: granted.includes(PROJECT_ROLE_PERMISSIONS.CREATE_TASKS),
      edit_tasks: granted.includes(PROJECT_ROLE_PERMISSIONS.EDIT_TASKS),
      delete_tasks: granted.includes(PROJECT_ROLE_PERMISSIONS.DELETE_TASKS),
      comment: granted.includes(PROJECT_ROLE_PERMISSIONS.COMMENT),
    };
  } catch (error) {
    log_error(error);
    return denied;
  }
}
