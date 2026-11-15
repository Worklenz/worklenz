/**
 * Reporting & Analytics permission matrix (backend).
 * Manager maps to Team Lead. Report viewing follows the "View reports"
 * organization permission (Owners always hold every org permission).
 */

import { IPassportSession } from "../interfaces/passport-session";
import {
  hasOrganizationPermission,
  ORGANIZATION_PERMISSIONS,
} from "./organization-permissions";
import { TEAM_ROLE_NAMES, getEffectiveTeamRole } from "./team-permissions";

export type AnalyticsActorRole = "owner" | "admin" | "manager" | "member" | "guest";

export interface AnalyticsDashboardSubject {
  ownerId: string;
  isShared: boolean;
}

export interface AnalyticsDashboardPermissions {
  canCreate: boolean;
  canView: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canShare: boolean;
  canComment: boolean;
}

export function resolveAnalyticsActorRole(
  user?: IPassportSession
): AnalyticsActorRole {
  if (!user) return "guest";
  if (user.owner) return "owner";
  // Session guest flag — owners/admins are never guests for analytics.
  if (user.is_guest && !user.is_admin) return "guest";

  const role = getEffectiveTeamRole(user);
  if (role === TEAM_ROLE_NAMES.OWNER) return "owner";
  if (role === TEAM_ROLE_NAMES.ADMIN) return "admin";
  if (role === TEAM_ROLE_NAMES.TEAM_LEAD) return "manager";
  return "member";
}

const isWorkspaceAdmin = (role: AnalyticsActorRole) =>
  role === "owner" || role === "admin";

export function getAnalyticsDashboardPermissions(
  user: IPassportSession | undefined,
  dashboard?: AnalyticsDashboardSubject | null
): AnalyticsDashboardPermissions {
  const role = resolveAnalyticsActorRole(user);

  if (role === "guest") {
    return {
      canCreate: false,
      canView: false,
      canEdit: false,
      canDelete: false,
      canShare: false,
      canComment: false,
    };
  }

  const canCreate = true;
  if (!dashboard) {
    return {
      canCreate,
      canView: true,
      canEdit: false,
      canDelete: false,
      canShare: isWorkspaceAdmin(role) || role === "manager",
      canComment: false,
    };
  }

  const isOwn = !!user?.id && user.id === dashboard.ownerId;

  if (isWorkspaceAdmin(role)) {
    return {
      canCreate,
      canView: true,
      canEdit: true,
      canDelete: true,
      canShare: true,
      canComment: true,
    };
  }

  if (isOwn) {
    return {
      canCreate,
      canView: true,
      canEdit: true,
      canDelete: true,
      canShare: role === "manager",
      canComment: true,
    };
  }

  if (!dashboard.isShared) {
    return {
      canCreate,
      canView: false,
      canEdit: false,
      canDelete: false,
      canShare: false,
      canComment: false,
    };
  }

  if (role === "manager") {
    return {
      canCreate,
      canView: true,
      canEdit: false,
      canDelete: false,
      canShare: false,
      canComment: true,
    };
  }

  return {
    canCreate,
    canView: true,
    canEdit: false,
    canDelete: false,
    canShare: false,
    canComment: false,
  };
}

export async function canViewAnalyticsReports(user?: IPassportSession): Promise<boolean> {
  return hasOrganizationPermission(user, ORGANIZATION_PERMISSIONS.VIEW_REPORTS);
}

export function canConfigureSlaPolicies(user?: IPassportSession): boolean {
  return isWorkspaceAdmin(resolveAnalyticsActorRole(user));
}
