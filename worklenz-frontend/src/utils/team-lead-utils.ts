import { ILocalSession } from '@/types/auth/local-session.types';
import { getSessionRoleName } from '@/utils/role-permissions.utils';
import { ROLE_DEFINITIONS, ROLE_NAMES } from '@/types/roles/role.types';

/**
 * Check if the current user is a Team Lead
 */
export const isCurrentUserTeamLead = (session: ILocalSession | null): boolean => {
  return getSessionRoleName(session) === ROLE_NAMES.TEAM_LEAD;
};

/**
 * Check if the current user is an Admin (Owner or Admin role)
 */
export const isCurrentUserAdmin = (session: ILocalSession | null): boolean => {
  const currentRole = getSessionRoleName(session);
  return currentRole === ROLE_NAMES.OWNER || currentRole === ROLE_NAMES.ADMIN;
};

/**
 * Check if the current user can see all members (Owner/Admin) or only managed members (Team Lead)
 */
export const canSeeAllMembers = (session: ILocalSession | null): boolean => {
  return isCurrentUserAdmin(session);
};

/**
 * Get the appropriate member filtering strategy based on user role
 */
export const getMemberFilterStrategy = (
  session: ILocalSession | null
): 'all' | 'managed' | 'none' => {
  return ROLE_DEFINITIONS[getSessionRoleName(session)].memberScope;
};

/**
 * Check if Team Lead functionality is available in the organization
 * This can be used to conditionally show/hide Team Lead features
 */
export const isTeamLeadFeatureAvailable = (session: ILocalSession | null): boolean => {
  if (!session) return false;

  // Team Lead features are available if:
  // 1. User is an Admin (can manage Team Leads)
  // 2. User is a Team Lead (can use Team Lead features)
  // 3. Organization has Team Lead roles configured

  return isCurrentUserAdmin(session) || isCurrentUserTeamLead(session);
};
