import { ILocalSession } from '@/types/auth/local-session.types';
import { IProjectViewModel } from '@/types/project/projectViewModel.types';
import { getSessionRoleName } from '@/utils/role-permissions.utils';
import { ROLE_NAMES } from '@/types/roles/role.types';

/**
 * Checks if the current user has permission to edit finance data
 * Only users with project admin, admin, or owner roles should be able to:
 * - Change fixed cost values
 * - Add members to rate cards
 * - Change rate per hour values
 * Note: Team leads do not have finance access
 */
export const hasFinanceEditPermission = (
  currentSession: ILocalSession | null,
  currentProject?: IProjectViewModel | null
): boolean => {
  if (!currentSession) return false;
  const currentRole = getSessionRoleName(currentSession);

  // Team owner or admin always have permission (but not team leads)
  if (currentRole === ROLE_NAMES.OWNER || currentRole === ROLE_NAMES.ADMIN) {
    return true;
  }

  // Project manager has permission
  if (currentProject?.project_manager?.id === currentSession.team_member_id) {
    return true;
  }

  return false;
};

/**
 * Checks if the current user has permission to view finance data
 * Only project managers, admins, and owners should be able to view the finance tab
 * Note: Team leads do not have finance access
 */
export const hasFinanceViewPermission = (
  currentSession: ILocalSession | null,
  currentProject?: IProjectViewModel | null
): boolean => {
  if (!currentSession) return false;
  const currentRole = getSessionRoleName(currentSession);

  // Team owner or admin always have permission (but not team leads)
  if (currentRole === ROLE_NAMES.OWNER || currentRole === ROLE_NAMES.ADMIN) {
    return true;
  }

  // Project manager has permission
  if (currentProject?.project_manager?.id === currentSession.team_member_id) {
    return true;
  }

  return false;
};

/**
 * Checks if the current user can edit fixed costs
 */
export const canEditFixedCost = (
  currentSession: ILocalSession | null,
  currentProject?: IProjectViewModel | null
): boolean => {
  return hasFinanceEditPermission(currentSession, currentProject);
};

/**
 * Checks if the current user can edit rate card data
 */
export const canEditRateCard = (
  currentSession: ILocalSession | null,
  currentProject?: IProjectViewModel | null
): boolean => {
  return hasFinanceEditPermission(currentSession, currentProject);
};

/**
 * Checks if the current user can add members to rate cards
 */
export const canAddMembersToRateCard = (
  currentSession: ILocalSession | null,
  currentProject?: IProjectViewModel | null
): boolean => {
  return hasFinanceEditPermission(currentSession, currentProject);
};
