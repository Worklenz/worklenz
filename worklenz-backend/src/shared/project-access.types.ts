import { TeamRoleName } from "./team-permissions";

/**
 * Fixed permission object returned for the current user on one project.
 * UI and API enforcement must read this — not the team role alone.
 */
export interface IProjectPermissions {
  settings: boolean;
  statuses: boolean;
  phases: boolean;
  customColumns: boolean;
  members: {
    add: boolean;
    removeMember: boolean;
    changeMemberRole: boolean;
  };
  tasks: boolean;
  saveAsTemplate: boolean;
  finance: boolean;
  archive: boolean;
  delete: boolean;
  move: boolean;
  assignPm: boolean;
  insights: boolean;
  files: boolean;
  updates: boolean;
  docs: boolean;
  roadmap: boolean;
  workload: boolean;
}

export interface IProjectAccess {
  teamRole: TeamRoleName;
  isProjectManager: boolean;
  financeAccess: boolean;
  isGuest: boolean;
  isProjectMember: boolean;
  canCreateProjectsFromTemplates: boolean;
  permissions: IProjectPermissions;
}

/** Membership row used to build access without a second round trip. */
export interface IProjectMembershipContext {
  teamRole: TeamRoleName;
  isGuest: boolean;
  isActive: boolean;
  accessLevel: string | null;
  financeAccess: boolean;
  canCreateProjectsFromTemplates: boolean;
  isProjectMember: boolean;
  /**
   * Grants from the project's permission scheme for the user's role.
   * Omitted keys keep the role baseline unchanged.
   */
  schemeGrants?: Partial<Record<SchemeControlledPermission, boolean>>;
}

/** Project permissions that a permission scheme can grant or revoke per role. */
export type SchemeControlledPermission =
  | "settings"
  | "statuses"
  | "phases"
  | "customColumns"
  | "members"
  | "saveAsTemplate"
  | "finance"
  | "archive"
  | "delete";
