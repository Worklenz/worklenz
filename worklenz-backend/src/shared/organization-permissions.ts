import db from "../config/db";
import { IPassportSession } from "../interfaces/passport-session";
import { getEffectiveTeamRole, TEAM_ROLE_NAMES } from "./team-permissions";

export const DEFAULT_ROLES = [
  { name: "Owner",     sort: 0 },
  { name: "Admin",     sort: 1 },
  { name: "Team Lead", sort: 2 },
  { name: "Member",    sort: 3 },
  { name: "Guest",     sort: 4 },
];

export const GUEST_ROLE_NAME = "Guest";

export const ORGANIZATION_PERMISSIONS = {
  MANAGE_ORGANIZATION_SETTINGS: "Manage organization settings",
  MANAGE_BILLING: "Manage billing",
  MANAGE_USERS: "Manage users",
  MANAGE_TEAMS: "Manage teams",
  CREATE_PROJECTS: "Create projects",
  VIEW_ALL_PROJECTS: "View all projects",
  VIEW_REPORTS: "View reports",
  VIEW_PLANNER: "View planner",
  VIEW_CLIENTS: "View clients",
  VIEW_FINANCE: "View finance",
  MANAGE_CLIENTS: "Manage clients",
} as const;

export type OrganizationPermission =
  (typeof ORGANIZATION_PERMISSIONS)[keyof typeof ORGANIZATION_PERMISSIONS];

export const PROJECT_ROLE_PERMISSIONS = {
  VIEW_PROJECT: "View project",
  CREATE_TASKS: "Create tasks",
  EDIT_TASKS: "Edit tasks",
  DELETE_TASKS: "Delete tasks",
  COMMENT: "Comment",
  MANAGE_MEMBERS: "Manage members",
  MANAGE_SCHEME: "Manage scheme",
  MANAGE_PROJECT_SETTINGS: "Manage project settings",
  MANAGE_STATUSES: "Manage statuses",
  MANAGE_PHASES: "Manage phases",
  MANAGE_CUSTOM_COLUMNS: "Manage custom columns",
  VIEW_PROJECT_FINANCE: "View project finance",
  SAVE_AS_TEMPLATE: "Save as template",
  ARCHIVE_PROJECT: "Archive project",
  DELETE_PROJECT: "Delete project",
} as const;

export type ProjectRolePermission =
  (typeof PROJECT_ROLE_PERMISSIONS)[keyof typeof PROJECT_ROLE_PERMISSIONS];

export const PROJECT_PERMISSIONS: string[] = Object.values(PROJECT_ROLE_PERMISSIONS);

// Organization-wide permissions only apply to the default scheme
export const ORGANIZATION_PERMISSION_NAMES: string[] = Object.values(ORGANIZATION_PERMISSIONS);

export const DEFAULT_PERMISSIONS = [...ORGANIZATION_PERMISSION_NAMES, ...PROJECT_PERMISSIONS];

/**
 * Permissions split out of an existing one. Until a grant is saved for them they
 * inherit the source permission's grant, so existing teams keep their behaviour.
 */
export const INHERITED_PERMISSION_SOURCES: Record<string, string> = {
  [PROJECT_ROLE_PERMISSIONS.CREATE_TASKS]: PROJECT_ROLE_PERMISSIONS.EDIT_TASKS,
};

// grants[permission][role] = granted
export const DEFAULT_GRANTS: Record<string, Record<string, boolean>> = {
  "Manage organization settings": { Owner: true, Admin: true,  "Team Lead": false, Member: false, Guest: false },
  "Manage billing":               { Owner: true, Admin: false, "Team Lead": false, Member: false, Guest: false },
  "Manage users":                 { Owner: true, Admin: true,  "Team Lead": false, Member: false, Guest: false },
  "Manage teams":                 { Owner: true, Admin: true,  "Team Lead": false, Member: false, Guest: false },
  "Create projects":              { Owner: true, Admin: true,  "Team Lead": true,  Member: false, Guest: false },
  "View all projects":            { Owner: true, Admin: true,  "Team Lead": false, Member: false, Guest: false },
  "View reports":                 { Owner: true, Admin: true,  "Team Lead": true,  Member: false, Guest: false },
  "View planner":                 { Owner: true, Admin: true,  "Team Lead": false, Member: false, Guest: false },
  "View clients":                 { Owner: true, Admin: true,  "Team Lead": false, Member: false, Guest: false },
  "View finance":                 { Owner: true, Admin: true,  "Team Lead": false, Member: false, Guest: false },
  "Manage clients":               { Owner: true, Admin: true,  "Team Lead": false, Member: false, Guest: false },
  "View project":    { Owner: true,  Admin: true,  "Team Lead": true,  Member: true,  Guest: true  },
  "Create tasks":    { Owner: true,  Admin: true,  "Team Lead": true,  Member: true,  Guest: false },
  "Edit tasks":      { Owner: true,  Admin: true,  "Team Lead": true,  Member: true,  Guest: false },
  "Delete tasks":    { Owner: true,  Admin: true,  "Team Lead": true,  Member: false, Guest: false },
  "Comment":         { Owner: true,  Admin: true,  "Team Lead": true,  Member: true,  Guest: true  },
  "Manage members":  { Owner: true,  Admin: true,  "Team Lead": false, Member: false, Guest: false },
  "Manage scheme":   { Owner: true,  Admin: true,  "Team Lead": false, Member: false, Guest: false },
  // Defaults match each role's built-in project access so behaviour is unchanged until edited
  "Manage project settings": { Owner: true, Admin: true, "Team Lead": true,  Member: false, Guest: false },
  "Manage statuses":         { Owner: true, Admin: true, "Team Lead": true,  Member: false, Guest: false },
  "Manage phases":           { Owner: true, Admin: true, "Team Lead": true,  Member: false, Guest: false },
  "Manage custom columns":   { Owner: true, Admin: true, "Team Lead": true,  Member: true,  Guest: false },
  "View project finance":    { Owner: true, Admin: true, "Team Lead": false, Member: false, Guest: false },
  "Save as template":        { Owner: true, Admin: true, "Team Lead": false, Member: false, Guest: false },
  "Archive project":         { Owner: true, Admin: true, "Team Lead": false, Member: false, Guest: false },
  "Delete project":          { Owner: true, Admin: true, "Team Lead": false, Member: false, Guest: false },
};

const getSchemeRoleName = (user: IPassportSession): string => {
  const teamRole = getEffectiveTeamRole(user);
  if (teamRole === TEAM_ROLE_NAMES.MEMBER && user.is_guest) return GUEST_ROLE_NAME;
  return teamRole;
};

/**
 * Which of the given permissions the role holds in the team's default scheme.
 * Permissions without a saved grant fall back to DEFAULT_GRANTS.
 */
export async function getDefaultSchemeRoleGrants(
  teamId: string,
  roleName: string,
  permissions: string[]
): Promise<string[]> {
  const result = await db.query(
    `SELECT psg.permission, psg.granted
     FROM permission_scheme_grants psg
     JOIN permission_schemes ps ON ps.id = psg.scheme_id
     WHERE ps.team_id = $1
       AND ps.is_default = TRUE
       AND psg.role_name = $2
       AND psg.permission = ANY($3::TEXT[])`,
    [teamId, roleName, permissions]
  );

  const savedGrants = new Map<string, boolean>(
    result.rows.map((row: { permission: string; granted: boolean }) => [row.permission, row.granted])
  );

  return permissions.filter(
    permission => savedGrants.get(permission) ?? DEFAULT_GRANTS[permission]?.[roleName] ?? false
  );
}

/**
 * Which of the given project permissions the role holds on a project.
 * The scheme assigned to the project wins for permissions it contains; anything
 * it doesn't contain falls back to the default scheme, then its inherited source
 * permission (if any), then DEFAULT_GRANTS.
 */
export async function getProjectSchemeRoleGrants(
  teamId: string,
  projectId: string,
  roleName: string,
  permissions: string[]
): Promise<string[]> {
  const sourcePermissions = permissions
    .map(permission => INHERITED_PERMISSION_SOURCES[permission])
    .filter((permission): permission is string => Boolean(permission));
  const queriedPermissions = [...new Set([...permissions, ...sourcePermissions])];

  const result = await db.query(
    `SELECT psg.permission, psg.granted, ps.is_default
     FROM permission_schemes ps
     JOIN permission_scheme_grants psg ON psg.scheme_id = ps.id
     WHERE ps.team_id = $1
       AND psg.role_name = $3
       AND psg.permission = ANY($4::TEXT[])
       AND (
         ps.is_default = TRUE
         OR ps.id = (SELECT scheme_id FROM project_scheme_assignments WHERE project_id = $2)
       )`,
    [teamId, projectId, roleName, queriedPermissions]
  );

  const projectSchemeGrants = new Map<string, boolean>();
  const defaultSchemeGrants = new Map<string, boolean>();
  for (const row of result.rows as { permission: string; granted: boolean; is_default: boolean }[]) {
    (row.is_default ? defaultSchemeGrants : projectSchemeGrants).set(row.permission, row.granted);
  }

  const isGranted = (permission: string): boolean => {
    const savedGrant = projectSchemeGrants.get(permission) ?? defaultSchemeGrants.get(permission);
    if (savedGrant !== undefined) return savedGrant;

    const sourcePermission = INHERITED_PERMISSION_SOURCES[permission];
    if (sourcePermission) return isGranted(sourcePermission);

    return DEFAULT_GRANTS[permission]?.[roleName] ?? false;
  };

  return permissions.filter(isGranted);
}

/**
 * Organization permissions granted to the user's role by the team's default scheme.
 * Owners always hold every permission so they can never lock themselves out.
 * Permissions without a saved grant fall back to DEFAULT_GRANTS.
 */
export async function getOrganizationPermissions(
  user: IPassportSession | undefined
): Promise<OrganizationPermission[]> {
  if (!user?.team_id) return [];

  const roleName = getSchemeRoleName(user);
  if (roleName === TEAM_ROLE_NAMES.OWNER) return [...ORGANIZATION_PERMISSION_NAMES] as OrganizationPermission[];

  return (await getDefaultSchemeRoleGrants(
    user.team_id,
    roleName,
    ORGANIZATION_PERMISSION_NAMES
  )) as OrganizationPermission[];
}

export async function hasOrganizationPermission(
  user: IPassportSession | undefined,
  permission: OrganizationPermission
): Promise<boolean> {
  const permissions = await getOrganizationPermissions(user);
  return permissions.includes(permission);
}

/** Owners and Admins always see every team project; other roles need "View all projects". */
export async function canViewAllProjects(user: IPassportSession | undefined): Promise<boolean> {
  if (user?.owner || user?.is_admin) return true;
  return hasOrganizationPermission(user, ORGANIZATION_PERMISSIONS.VIEW_ALL_PROJECTS);
}
