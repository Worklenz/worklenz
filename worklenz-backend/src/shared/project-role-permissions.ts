import db from "../config/db";
import { log_error } from "./utils";
import { normalizeTeamRoleName, TEAM_ROLE_NAMES } from "./team-permissions";
import {
  DEFAULT_GRANTS,
  getProjectSchemeRoleGrants,
  GUEST_ROLE_NAME,
  PROJECT_ROLE_PERMISSIONS,
  ProjectRolePermission,
} from "./organization-permissions";

/**
 * Project-level role permissions (Create/Edit/Delete tasks, Comment) come from
 * the project's assigned permission scheme, falling back to the default scheme:
 * - Owner / Admin always hold them.
 * - Members and Guests hold them on projects they are assigned to.
 * - Non-members do not receive these grants, including when they can open a
 *   project through "View all projects". Task changes require project membership.
 * - Project settings such as restrict_task_creation are enforced separately and
 *   take priority over these grants.
 */

export interface IProjectRoleContext {
  teamId: string;
  projectId: string;
  roleName: string;
  isProjectMember: boolean;
  assignedRoles: string[];
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
         COALESCE(pal.key = 'GUEST', FALSE) AS is_project_guest,
         psa.scheme_id AS assigned_scheme_id,
         ARRAY(
           SELECT DISTINCT srm.role_name
           FROM project_scheme_assignments psa
           JOIN scheme_role_members srm ON srm.project_id = psa.project_id AND srm.scheme_id = psa.scheme_id
           WHERE psa.project_id = p.id
             AND (srm.team_member_id = tm.id OR EXISTS (
               SELECT 1 FROM permission_group_members pgm
               JOIN permission_groups pg ON pg.id = pgm.group_id AND pg.team_id = p.team_id
               WHERE pgm.group_id = srm.group_id AND pgm.team_member_id = tm.id
             ))
         ) AS assigned_roles
  FROM projects p
  INNER JOIN team_members tm ON tm.team_id = p.team_id AND tm.user_id = $1 AND tm.active = TRUE
  INNER JOIN roles r ON r.id = tm.role_id
  LEFT JOIN project_members pm ON pm.project_id = p.id AND pm.team_member_id = tm.id
  LEFT JOIN project_access_levels pal ON pal.id = pm.project_access_level_id
  LEFT JOIN project_scheme_assignments psa ON psa.project_id = p.id
`;

interface IRoleContextRow {
  team_id: string;
  project_id: string;
  role_name: string | null;
  owner: boolean;
  is_team_guest: boolean;
  is_project_member: boolean;
  is_project_guest: boolean;
  assigned_roles: string[] | null;
  assigned_scheme_id: string | null;
}

/** Maps a role-context query row to the permission check context. */
const toRoleContext = (row: IRoleContextRow): IProjectRoleContext => {
  const teamRole = row.owner ? TEAM_ROLE_NAMES.OWNER : normalizeTeamRoleName(row.role_name);
  const isGuest = teamRole === TEAM_ROLE_NAMES.MEMBER && (row.is_team_guest || row.is_project_guest);
  return {
    teamId: row.team_id,
    projectId: row.project_id,
    roleName: isGuest ? GUEST_ROLE_NAME : teamRole,
    isProjectMember: row.is_project_member,
    assignedRoles: row.assigned_roles || [],
  };
};

/** Resolve visible project IDs in two queries for aggregate endpoints. */
export async function getVisibleProjectIds(userId: string | undefined, teamId: string | undefined): Promise<string[]> {
  if (!userId || !teamId) return [];

  const contexts = await db.query(`${ROLE_CONTEXT_SELECT} WHERE p.team_id = $2`, [userId, teamId]);
  const rows = contexts.rows as IRoleContextRow[];
  if (!rows.length) return [];

  const schemeIds = [...new Set(rows.map(row => row.assigned_scheme_id).filter((id): id is string => !!id))];
  const result = await db.query(
    `SELECT psg.scheme_id, ps.is_default, psg.role_name, psg.granted
     FROM permission_scheme_grants psg
     JOIN permission_schemes ps ON ps.id = psg.scheme_id
     WHERE ps.team_id = $1 AND psg.permission = $2
       AND (ps.is_default = TRUE OR ps.id = ANY($3::UUID[]))`,
    [teamId, PROJECT_ROLE_PERMISSIONS.VIEW_PROJECT, schemeIds]
  );
  const defaultGrants = new Map<string, boolean>();
  const projectGrants = new Map<string, boolean>();
  for (const grant of result.rows as Array<{ scheme_id: string; is_default: boolean; role_name: string; granted: boolean }>) {
    (grant.is_default ? defaultGrants : projectGrants).set(
      grant.is_default ? grant.role_name : `${grant.scheme_id}:${grant.role_name}`,
      grant.granted
    );
  }

  return rows.filter(row => {
    const context = toRoleContext(row);
    if (context.roleName === TEAM_ROLE_NAMES.OWNER || context.roleName === TEAM_ROLE_NAMES.ADMIN) return true;
    const roles = context.assignedRoles.length ? context.assignedRoles : [context.roleName];
    return roles.some(role =>
      (row.assigned_scheme_id ? projectGrants.get(`${row.assigned_scheme_id}:${role}`) : undefined)
        ?? defaultGrants.get(role)
        ?? DEFAULT_GRANTS[PROJECT_ROLE_PERMISSIONS.VIEW_PROJECT]?.[role]
        ?? false
    );
  }).map(row => row.project_id);
}

/** Role and membership for a user on one project. */
export async function getProjectRoleContext(
  userId: string,
  projectId: string
): Promise<IProjectRoleContext | null> {
  const result = await db.query(`${ROLE_CONTEXT_SELECT} WHERE p.id = $2 LIMIT 1`, [userId, projectId]);
  return result.rows[0] ? toRoleContext(result.rows[0]) : null;
}

/** Role and membership for the project that owns a task. */
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

/** Permissions from the list that the role actually holds on this project. */
const getGrantedPermissions = async (
  context: IProjectRoleContext,
  permissions: ProjectRolePermission[]
): Promise<ProjectRolePermission[]> => {
  if (context.roleName === TEAM_ROLE_NAMES.OWNER || context.roleName === TEAM_ROLE_NAMES.ADMIN) {
    return permissions;
  }

  const isMemberOrGuest =
    context.roleName === TEAM_ROLE_NAMES.MEMBER || context.roleName === GUEST_ROLE_NAME;
  // Non-members (including those viewing via "View all projects") are strictly view-only;
  // task mutation (create/edit/delete/comment) requires project membership.
  const roles = context.assignedRoles.length ? context.assignedRoles : [context.roleName];
  const requested = [...new Set([...permissions, PROJECT_ROLE_PERMISSIONS.VIEW_PROJECT])];
  const grants = await Promise.all(roles.map(role =>
    getProjectSchemeRoleGrants(context.teamId, context.projectId, role, requested)
  ));
  const granted = new Set(grants.flat());
  if (!granted.has(PROJECT_ROLE_PERMISSIONS.VIEW_PROJECT)) return [];
  return permissions.filter(permission => granted.has(permission) &&
    (permission === PROJECT_ROLE_PERMISSIONS.VIEW_PROJECT || !isMemberOrGuest || context.isProjectMember));
};

/** Resolve all project grants using the same role and membership rules as mutations. */
export async function getProjectRolePermissions(
  userId: string,
  projectId: string,
  permissions: ProjectRolePermission[]
): Promise<ProjectRolePermission[]> {
  const context = await getProjectRoleContext(userId, projectId);
  return context ? getGrantedPermissions(context, permissions) : [];
}

/** Checks one permission against an already loaded project role context. */
const checkContextPermission = async (
  context: IProjectRoleContext | null,
  permission: ProjectRolePermission
): Promise<IProjectRolePermissionResult> => {
  if (!context) return { allowed: false, roleName: null };
  const granted = await getGrantedPermissions(context, [permission]);
  return { allowed: granted.includes(permission), roleName: context.roleName };
};

/** Whether the user holds one project-role permission on a project. */
export async function checkProjectRolePermission(
  userId: string | null | undefined,
  projectId: string | null | undefined,
  permission: ProjectRolePermission
): Promise<IProjectRolePermissionResult> {
  if (!userId || !projectId) return { allowed: false, roleName: null };
  return checkContextPermission(await getProjectRoleContext(userId, projectId), permission);
}

/** Whether the user holds one project-role permission on a task's project. */
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
