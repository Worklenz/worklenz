import { ROLE_NAMES, IRoleOption } from '@/types/roles/role.types';

/**
 * Check if current user can edit/manage another user's role
 */
export function canManageUserRole(
  currentUserRole: string | undefined,
  targetUserRole: string | undefined,
  isOwner?: boolean
): boolean {
  // Owner can manage anyone except other owners
  if (isOwner) {
    return targetUserRole?.toLowerCase() !== 'owner';
  }

  // Admin can manage Team Leads and Members, but not Owner
  if (currentUserRole?.toLowerCase() === 'admin') {
    return ['team lead', 'member'].includes(targetUserRole?.toLowerCase() || '');
  }

  // Team Lead can manage Team Leads and Members, but not Admin or Owner
  if (currentUserRole?.toLowerCase() === 'team lead') {
    return ['team lead', 'member'].includes(targetUserRole?.toLowerCase() || '');
  }

  // Members cannot manage other users
  return false;
}

/**
 * Get available role options for role assignment based on current user permissions
 */
export function getAvailableRoleOptions(
  currentUserRole: string | undefined,
  isOwner?: boolean
): IRoleOption[] {
  const allOptions: IRoleOption[] = [
    {
      value: ROLE_NAMES.MEMBER,
      label: ROLE_NAMES.MEMBER,
      description: 'Standard team member with basic access',
    },
    {
      value: ROLE_NAMES.TEAM_LEAD,
      label: ROLE_NAMES.TEAM_LEAD,
      description: 'Admin access limited to this team only',
    },
    {
      value: ROLE_NAMES.ADMIN,
      label: ROLE_NAMES.ADMIN,
      description: 'Full admin access to team management and settings',
    },
  ];

  // Owner can assign any role except Owner
  if (isOwner) {
    return allOptions;
  }

  // Admin can assign Team Lead and Member roles
  if (currentUserRole?.toLowerCase() === 'admin') {
    return allOptions.filter(option => ['Member', 'Team Lead'].includes(option.value));
  }

  // Team Lead can assign Team Lead and Member roles
  if (currentUserRole?.toLowerCase() === 'team lead') {
    return allOptions.filter(option => ['Member', 'Team Lead'].includes(option.value));
  }

  // Members get no role options
  return [];
}
