/** Frontend TypeScript types for the Roles & Permissions feature. */

/** Must match ORGANIZATION_PERMISSIONS in worklenz-backend/src/shared/organization-permissions.ts */
export const ORGANIZATION_PERMISSIONS = {
  MANAGE_ORGANIZATION_SETTINGS: 'Manage organization settings',
  MANAGE_BILLING: 'Manage billing',
  MANAGE_USERS: 'Manage users',
  MANAGE_TEAMS: 'Manage teams',
  CREATE_PROJECTS: 'Create projects',
  VIEW_ALL_PROJECTS: 'View all projects',
  VIEW_REPORTS: 'View reports',
  VIEW_PLANNER: 'View planner',
  VIEW_CLIENTS: 'View clients',
  VIEW_FINANCE: 'View finance',
  MANAGE_CLIENTS: 'Manage clients',
} as const;

export type OrganizationPermission =
  (typeof ORGANIZATION_PERMISSIONS)[keyof typeof ORGANIZATION_PERMISSIONS];

export interface IPermissionScheme {
  id: string;
  name: string;
  is_default: boolean;
  is_locked: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface IPermissionSchemeRole {
  scheme_id?: string;
  role_name: string;
  sort_order: number;
}

export interface IPermissionGrant {
  scheme_id?: string;
  role_name: string;
  permission: string;
  granted: boolean;
}

export interface IPermissionGroup {
  id: string;
  team_id?: string;
  name: string;
  created_at?: string;
  member_count?: number;
  members?: IPermissionGroupMember[];
}

export interface IPermissionGroupMember {
  id: string;
  group_id?: string;
  team_member_id: string;
  name?: string;
  avatar_url?: string;
  color_code?: string;
}

export interface ITeamProjectScheme {
  id: string;
  name: string;
  scheme_id: string | null;
}

export interface IProjectSchemeAssignment {
  id?: string;
  project_id: string;
  scheme_id: string | null;
  scheme?: IPermissionScheme;
  grants?: IPermissionGrant[];
  role_members?: ISchemeRoleMember[];
}

export interface ISchemeRoleMember {
  id: string;
  project_id?: string;
  scheme_id?: string;
  role_name: string;
  team_member_id: string | null;
  group_id: string | null;
  name?: string;
  avatar_url?: string;
  color_code?: string;
}

export interface ISchemeWithRolesAndGrants {
  scheme: IPermissionScheme;
  roles: IPermissionSchemeRole[];
  grants: IPermissionGrant[];
}

export interface IGrantUpdateRequest {
  grants: Array<{ role_name: string; permission: string; granted: boolean }>;
}
