/**
 * Reporting & Analytics permission matrix.
 *
 * Manager maps to Worklenz Team Lead.
 * Guests have no analytics access (redirected at the route layer).
 */

export type AnalyticsActorRole = 'owner' | 'admin' | 'manager' | 'member' | 'guest';

export interface AnalyticsActor {
  role: AnalyticsActorRole;
  userId?: string | null;
}

export interface AnalyticsDashboardSubject {
  /** Dashboard creator user id */
  ownerId: string;
  /** Shared with the workspace / via link */
  isShared: boolean;
}

export interface AnalyticsReportPermissions {
  canViewReports: boolean;
  canExportReports: boolean;
  canConfigureSla: boolean;
}

export interface AnalyticsDashboardPermissions {
  canCreate: boolean;
  canView: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canShare: boolean;
  canComment: boolean;
}

const isWorkspaceAdmin = (role: AnalyticsActorRole) => role === 'owner' || role === 'admin';

export const getAnalyticsReportPermissions = (
  actor: AnalyticsActor
): AnalyticsReportPermissions => {
  if (actor.role === 'guest') {
    return { canViewReports: false, canExportReports: false, canConfigureSla: false };
  }

  return {
    canViewReports: true,
    canExportReports: true,
    canConfigureSla: isWorkspaceAdmin(actor.role),
  };
};

export const getAnalyticsDashboardPermissions = (
  actor: AnalyticsActor,
  dashboard?: AnalyticsDashboardSubject | null
): AnalyticsDashboardPermissions => {
  if (actor.role === 'guest') {
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
      canShare: isWorkspaceAdmin(actor.role) || actor.role === 'manager',
      canComment: false,
    };
  }

  const isOwn = !!actor.userId && actor.userId === dashboard.ownerId;

  if (isWorkspaceAdmin(actor.role)) {
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
      canShare: actor.role === 'manager',
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

  // Shared dashboards
  if (actor.role === 'manager') {
    return {
      canCreate,
      canView: true,
      canEdit: false,
      canDelete: false,
      canShare: false,
      canComment: true,
    };
  }

  // Member — view only
  return {
    canCreate,
    canView: true,
    canEdit: false,
    canDelete: false,
    canShare: false,
    canComment: false,
  };
};

/** Resolve Worklenz session fields into an analytics actor role. */
export const resolveAnalyticsActorRole = (session?: {
  owner?: boolean;
  is_admin?: boolean;
  is_guest?: boolean;
  role_name?: string | null;
} | null): AnalyticsActorRole => {
  if (!session) return 'guest';
  if (session.owner) return 'owner';
  if (session.is_guest) return 'guest';
  if (session.is_admin) return 'admin';

  const role = session.role_name?.toLowerCase().trim();
  if (role === 'admin') return 'admin';
  if (role === 'team lead' || role === 'teamlead' || role === 'manager') return 'manager';
  return 'member';
};
