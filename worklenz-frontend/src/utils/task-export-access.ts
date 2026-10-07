/**
 * Role gate for Task Export UI (Owner/Admin, Project Manager, or Team Lead).
 * Mirrors backend hasTaskExportPermission / requireTaskExportAccess (TE-33).
 */
export const hasTaskExportRoleAccess = (
  isOwnerOrAdmin: boolean,
  isProjectManager: boolean,
  isTeamLead = false
): boolean => Boolean(isOwnerOrAdmin || isProjectManager || isTeamLead);

/**
 * Full export permission: Business plan + role access.
 * Mirrors backend requireBusinessPlan + hasTaskExportPermission.
 */
export const canAccessTaskExport = (
  isOwnerOrAdmin: boolean,
  isProjectManager: boolean,
  isTeamLead = false,
  hasBusinessAccess = false
): boolean =>
  Boolean(
    hasBusinessAccess &&
      hasTaskExportRoleAccess(isOwnerOrAdmin, isProjectManager, isTeamLead)
  );
