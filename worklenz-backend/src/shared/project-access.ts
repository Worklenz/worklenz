import db from "../config/db";
import { IPassportSession } from "../interfaces/passport-session";
import { IWorkLenzRequest } from "../interfaces/worklenz-request";
import {
  getEffectiveTeamRole,
  hasTeamAdminPrivileges,
  normalizeTeamRoleName,
  TEAM_ROLE_NAMES,
  TeamRoleName,
} from "./team-permissions";
import {
  IProjectAccess,
  IProjectMembershipContext,
  IProjectPermissions,
} from "./project-access.types";

export type {
  IProjectAccess,
  IProjectMembershipContext,
  IProjectPermissions,
} from "./project-access.types";

const DENIED_PERMISSIONS: IProjectPermissions = {
  settings: false,
  statuses: false,
  phases: false,
  customColumns: false,
  members: {
    add: false,
    removeMember: false,
    changeMemberRole: false,
  },
  tasks: false,
  saveAsTemplate: false,
  finance: false,
  archive: false,
  delete: false,
  move: false,
  assignPm: false,
  insights: false,
  files: false,
  updates: false,
  roadmap: false,
  workload: false,
};

const orPermissions = (
  a: IProjectPermissions,
  b: IProjectPermissions
): IProjectPermissions => ({
  settings: a.settings || b.settings,
  statuses: a.statuses || b.statuses,
  phases: a.phases || b.phases,
  customColumns: a.customColumns || b.customColumns,
  members: {
    add: a.members.add || b.members.add,
    removeMember: a.members.removeMember || b.members.removeMember,
    changeMemberRole:
      a.members.changeMemberRole || b.members.changeMemberRole,
  },
  tasks: a.tasks || b.tasks,
  saveAsTemplate: a.saveAsTemplate || b.saveAsTemplate,
  finance: a.finance || b.finance,
  archive: a.archive || b.archive,
  delete: a.delete || b.delete,
  move: a.move || b.move,
  assignPm: a.assignPm || b.assignPm,
  insights: a.insights || b.insights,
  files: a.files || b.files,
  updates: a.updates || b.updates,
  roadmap: a.roadmap || b.roadmap,
  workload: a.workload || b.workload,
});

/** Owner / Admin — full project + lifecycle + PM delegation. */
const adminPermissions = (): IProjectPermissions => ({
  settings: true,
  statuses: true,
  phases: true,
  customColumns: true,
  members: {
    add: true,
    removeMember: true,
    changeMemberRole: true,
  },
  tasks: true,
  saveAsTemplate: true,
  finance: true,
  archive: true,
  delete: true,
  move: true,
  assignPm: true,
  insights: true,
  files: true,
  updates: true,
  roadmap: true,
  workload: true,
});

/**
 * Spec PM preset on this project only.
 * archive / delete / move / assignPm stay false (Phase 0).
 */
const projectManagerPermissions = (
  financeAccess: boolean
): IProjectPermissions => ({
  settings: true,
  statuses: true,
  phases: true,
  customColumns: true,
  members: {
    add: true,
    removeMember: true,
    changeMemberRole: true,
  },
  tasks: true,
  saveAsTemplate: true,
  finance: financeAccess,
  archive: false,
  delete: false,
  move: false,
  assignPm: false,
  insights: true,
  files: true,
  updates: true,
  roadmap: true,
  workload: true,
});

/**
 * Team Lead baseline (today): project management without finance,
 * save-as-template, or lifecycle / PM delegation.
 */
const teamLeadPermissions = (): IProjectPermissions => ({
  settings: true,
  statuses: true,
  phases: true,
  customColumns: true,
  members: {
    add: true,
    removeMember: true,
    changeMemberRole: true,
  },
  tasks: true,
  saveAsTemplate: false,
  finance: false,
  archive: false,
  delete: false,
  move: false,
  assignPm: false,
  insights: true,
  files: true,
  updates: true,
  roadmap: true,
  workload: true,
});

/** Plain project Member — keep today's Member baseline (no settings elevation). */
const memberPermissions = (): IProjectPermissions => ({
  ...DENIED_PERMISSIONS,
  customColumns: true,
  tasks: true,
  insights: true,
  files: true,
  updates: true,
  roadmap: true,
  workload: true,
});

/** Guest on project — view/work tasks; no management elevation. */
const guestPermissions = (): IProjectPermissions => ({
  ...DENIED_PERMISSIONS,
  tasks: true,
  insights: true,
  files: true,
  updates: true,
  roadmap: true,
  workload: true,
});

const isProjectManagerAccessLevel = (accessLevel: string | null): boolean =>
  (accessLevel || "").toUpperCase() === "PROJECT_MANAGER";

/**
 * Pure builder — unit-tested. Does not hit the database.
 *
 * Rules (Phase 0):
 * - Owner/Admin → full admin permissions (PM flag ignored for elevation)
 * - Guest (team or project) never receives PM elevation even if access level is PM
 * - Member/Team Lead + PROJECT_MANAGER → union of role baseline + PM preset
 * - finance only when PM elevation applies and finance_access is true (Admins always)
 */
export const buildProjectAccess = (
  ctx: IProjectMembershipContext
): IProjectAccess => {
  const teamRole = ctx.teamRole;
  const isGuest = ctx.isGuest;
  const isProjectMember = ctx.isProjectMember && ctx.isActive;
  const rawIsPm = isProjectManagerAccessLevel(ctx.accessLevel);
  // Guests never elevate from a PROJECT_MANAGER row (Phase 0 / acceptance).
  const isProjectManager = rawIsPm && !isGuest && isProjectMember;
  const financeAccess =
    isProjectManager && ctx.financeAccess === true;

  const base: IProjectAccess = {
    teamRole,
    isProjectManager,
    financeAccess: false,
    isGuest,
    isProjectMember,
    canCreateProjectsFromTemplates:
      !isGuest && ctx.canCreateProjectsFromTemplates === true,
    permissions: { ...DENIED_PERMISSIONS },
  };

  if (!ctx.isActive) {
    return base;
  }

  if (!isProjectMember) {
    // Owner/Admin may still manage projects they are not listed on (team-wide).
    if (
      teamRole === TEAM_ROLE_NAMES.OWNER ||
      teamRole === TEAM_ROLE_NAMES.ADMIN
    ) {
      return {
        ...base,
        isProjectMember: true,
        financeAccess: true,
        canCreateProjectsFromTemplates: true,
        permissions: adminPermissions(),
      };
    }

    // Team Lead can access all projects in the team today.
    if (teamRole === TEAM_ROLE_NAMES.TEAM_LEAD) {
      return {
        ...base,
        isProjectMember: true,
        permissions: teamLeadPermissions(),
      };
    }

    return base;
  }

  if (
    teamRole === TEAM_ROLE_NAMES.OWNER ||
    teamRole === TEAM_ROLE_NAMES.ADMIN
  ) {
    return {
      ...base,
      financeAccess: true,
      canCreateProjectsFromTemplates: true,
      permissions: adminPermissions(),
    };
  }

  if (isGuest) {
    return {
      ...base,
      isProjectManager: false,
      financeAccess: false,
      canCreateProjectsFromTemplates: false,
      permissions: guestPermissions(),
    };
  }

  let permissions =
    teamRole === TEAM_ROLE_NAMES.TEAM_LEAD
      ? teamLeadPermissions()
      : memberPermissions();

  if (isProjectManager) {
    permissions = orPermissions(
      permissions,
      projectManagerPermissions(financeAccess)
    );
  }

  return {
    ...base,
    financeAccess,
    permissions,
  };
};

interface IMembershipRow {
  team_role: string | null;
  is_guest: boolean;
  active: boolean;
  access_level: string | null;
  finance_access: boolean;
  can_create_projects_from_templates: boolean;
  is_project_member: boolean;
  project_team_id: string | null;
}

/** Hard deny — missing project, cross-team, or unauthenticated. */
const emptyAccessFor = (user: IPassportSession | undefined): IProjectAccess => ({
  teamRole: getEffectiveTeamRole(user),
  isProjectManager: false,
  financeAccess: false,
  isGuest: !!user?.is_guest,
  isProjectMember: false,
  canCreateProjectsFromTemplates: false,
  permissions: { ...DENIED_PERMISSIONS },
});

/**
 * One project-membership lookup. Prefer getProjectAccessForRequest so the
 * result is cached for the rest of the HTTP/socket request.
 */
export const getProjectAccess = async (
  user: IPassportSession | undefined,
  projectId: string
): Promise<IProjectAccess> => {
  if (!user?.id || !user.team_id || !projectId) {
    return emptyAccessFor(user);
  }

  const q = `
    SELECT
      r.name AS team_role,
      COALESCE(tm.is_guest, FALSE) AS is_guest,
      COALESCE(tm.active, FALSE) AS active,
      pal.key AS access_level,
      COALESCE(pm.finance_access, FALSE) AS finance_access,
      COALESCE(tm.can_create_projects_from_templates, FALSE)
        AS can_create_projects_from_templates,
      (pm.id IS NOT NULL) AS is_project_member,
      p.team_id AS project_team_id
    FROM projects p
    LEFT JOIN team_members tm
      ON tm.user_id = $2::UUID
     AND tm.team_id = p.team_id
    LEFT JOIN roles r ON r.id = tm.role_id
    LEFT JOIN project_members pm
      ON pm.team_member_id = tm.id
     AND pm.project_id = p.id
    LEFT JOIN project_access_levels pal
      ON pal.id = pm.project_access_level_id
    WHERE p.id = $1::UUID
    LIMIT 1;
  `;

  const result = await db.query(q, [projectId, user.id]);
  const row = result.rows[0] as IMembershipRow | undefined;

  if (!row?.project_team_id) {
    return emptyAccessFor(user);
  }

  // Cross-team: no elevation from this session's team context.
  if (row.project_team_id !== user.team_id) {
    return emptyAccessFor(user);
  }

  if (!row.team_role && !hasTeamAdminPrivileges(user)) {
    return emptyAccessFor(user);
  }

  const teamRole: TeamRoleName = row.team_role
    ? normalizeTeamRoleName(row.team_role)
    : getEffectiveTeamRole(user);

  return buildProjectAccess({
    teamRole,
    isGuest: !!row.is_guest || !!user.is_guest,
    isActive: !!row.active,
    accessLevel: row.access_level,
    financeAccess: !!row.finance_access,
    canCreateProjectsFromTemplates: !!row.can_create_projects_from_templates,
    isProjectMember: !!row.is_project_member,
  });
};

/**
 * Cached per request + projectId (Phase 0 NFR: one membership lookup, cached).
 */
export const getProjectAccessForRequest = async (
  req: IWorkLenzRequest,
  projectId: string
): Promise<IProjectAccess> => {
  if (!req.projectAccessCache) {
    req.projectAccessCache = new Map();
  }

  const cached = req.projectAccessCache.get(projectId);
  if (cached) {
    return cached;
  }

  const access = await getProjectAccess(req.user, projectId);
  req.projectAccessCache.set(projectId, access);
  return access;
};
