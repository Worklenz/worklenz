import { ILocalSession } from '@/types/auth/local-session.types';
import { ROLE_NAMES, RoleName } from '@/types/roles/role.types';
import { canManageUserRole, getSessionRoleName } from '@/utils/role-permissions.utils';

/**
 * Team roles a Manage users holder may edit.
 * Matches backend getManageUsersAssignableRoles (Team Lead and Member).
 */
export function isManageUsersAssignableRole(roleName?: string | null): boolean {
  const normalized = roleName?.toLowerCase().trim().replace(/[_\s]+/g, ' ');
  return normalized === 'member' || normalized === 'team lead' || normalized === 'teamlead';
}

export interface UpdateMemberPermissionUser {
  email?: string;
  team_member_id?: string;
  role_name?: string;
  owner?: boolean;
  is_admin?: boolean;
}

export interface UpdateMemberPermissionTarget {
  email?: string;
  role_name?: string;
}

export interface UpdateMemberPermissionInput {
  currentUser: UpdateMemberPermissionUser | null;
  selectedMemberId: string | null;
  teamMember: UpdateMemberPermissionTarget | null;
  hasManageUsers?: boolean;
  allowProjectMemberManage?: boolean;
}

export interface UpdateMemberPermissions {
  currentUserRole: RoleName;
  isOwnAccount: boolean;
  canManageTarget: boolean;
  canEditMemberDetails: boolean;
  canCreateJobTitle: boolean;
  canEditRole: boolean;
  canEditManager: boolean;
}

/** Drawer rules for who may edit a team member, their role, and their manager. */
export function evaluateUpdateMemberPermissions({
  currentUser,
  selectedMemberId,
  teamMember,
  hasManageUsers = false,
  allowProjectMemberManage = false,
}: UpdateMemberPermissionInput): UpdateMemberPermissions {
  const currentUserRole = getSessionRoleName((currentUser as ILocalSession | null) ?? null);
  const isOwnAccount = Boolean(
    (currentUser?.email && currentUser.email === teamMember?.email) ||
      (currentUser?.team_member_id && currentUser.team_member_id === selectedMemberId)
  );
  const canManageTarget =
    currentUserRole === ROLE_NAMES.ADMIN
      ? teamMember?.role_name?.toLowerCase() !== 'owner'
      : canManageUserRole(currentUser?.role_name, teamMember?.role_name, currentUser?.owner);
  const manageUsersCanEditTarget =
    hasManageUsers && isManageUsersAssignableRole(teamMember?.role_name);
  const targetRole = teamMember?.role_name?.toLowerCase() || '';

  const canEditMemberDetails =
    currentUserRole === ROLE_NAMES.OWNER ||
    (currentUserRole === ROLE_NAMES.ADMIN && (isOwnAccount || Boolean(canManageTarget))) ||
    isOwnAccount ||
    manageUsersCanEditTarget ||
    (allowProjectMemberManage && targetRole !== 'owner' && targetRole !== 'admin');

  const canCreateJobTitle =
    currentUserRole === ROLE_NAMES.OWNER ||
    currentUserRole === ROLE_NAMES.ADMIN ||
    hasManageUsers;

  const canEditRole = !isOwnAccount && (Boolean(canManageTarget) || manageUsersCanEditTarget);

  return {
    currentUserRole,
    isOwnAccount,
    canManageTarget: Boolean(canManageTarget),
    canEditMemberDetails,
    canCreateJobTitle,
    canEditRole,
    canEditManager: canEditRole,
  };
}
