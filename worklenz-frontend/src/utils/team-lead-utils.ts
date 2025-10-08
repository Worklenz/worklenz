import { ILocalSession } from '@/types/auth/local-session.types';

/**
 * Check if the current user is a Team Lead
 */
export const isCurrentUserTeamLead = (session: ILocalSession | null): boolean => {
  if (!session) return false;
  
  // Check if user has Team Lead role
  return session.role_name?.toLowerCase() === 'team lead';
};

/**
 * Check if the current user is an Admin (Owner or Admin role)
 */
export const isCurrentUserAdmin = (session: ILocalSession | null): boolean => {
  if (!session) return false;
  
  // Owner or Admin role
  return session.owner || session.is_admin || session.role_name?.toLowerCase() === 'admin';
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
export const getMemberFilterStrategy = (session: ILocalSession | null): 'all' | 'managed' | 'none' => {
  if (!session) return 'none';
  
  if (isCurrentUserAdmin(session)) {
    return 'all'; // Admins see all members
  }
  
  if (isCurrentUserTeamLead(session)) {
    return 'managed'; // Team Leads see only their managed members
  }
  
  return 'none'; // Regular members see no filtering options
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
