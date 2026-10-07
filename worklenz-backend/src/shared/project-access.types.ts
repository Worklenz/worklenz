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
}
