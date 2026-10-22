import { describe, it, expect } from 'vitest';
import { ROLE_NAMES } from '@/types/roles/role.types';
import { canManageUserRole, getSessionRoleName } from '@/utils/role-permissions.utils';

describe('update-member-drawer permission and self-edit gating rules', () => {
  const evaluatePermissions = ({
    currentUser,
    selectedMemberId,
    teamMember,
  }: {
    currentUser: {
      email?: string;
      team_member_id?: string;
      role_name?: string;
      owner?: boolean;
      is_admin?: boolean;
    } | null;
    selectedMemberId: string | null;
    teamMember: {
      email?: string;
      role_name?: string;
    } | null;
  }) => {
    const currentUserRole = getSessionRoleName(currentUser as any);

    const isOwnAccount = Boolean(
      (currentUser?.email && currentUser?.email === teamMember?.email) ||
        (currentUser?.team_member_id && currentUser?.team_member_id === selectedMemberId)
    );

    const canManageTarget =
      currentUserRole === ROLE_NAMES.ADMIN
        ? teamMember?.role_name?.toLowerCase() !== 'owner'
        : canManageUserRole(currentUser?.role_name, teamMember?.role_name, currentUser?.owner);

    const canEditMemberDetails =
      currentUserRole === ROLE_NAMES.OWNER ||
      (currentUserRole === ROLE_NAMES.ADMIN && (isOwnAccount || Boolean(canManageTarget))) ||
      isOwnAccount;

    const canCreateJobTitle =
      currentUserRole === ROLE_NAMES.OWNER || currentUserRole === ROLE_NAMES.ADMIN;

    const canEditRole = !isOwnAccount && Boolean(canManageTarget);
    const canEditManager = !isOwnAccount && Boolean(canManageTarget);

    return {
      currentUserRole,
      isOwnAccount,
      canManageTarget,
      canEditMemberDetails,
      canCreateJobTitle,
      canEditRole,
      canEditManager,
    };
  };

  it('allows Member to edit own basic details while protecting role, manager, and job-title creation', () => {
    const perms = evaluatePermissions({
      currentUser: {
        email: 'member@test.com',
        team_member_id: 'tm-member',
        role_name: 'Member',
      },
      selectedMemberId: 'tm-member',
      teamMember: {
        email: 'member@test.com',
        role_name: 'Member',
      },
    });

    expect(perms.isOwnAccount).toBe(true);
    expect(perms.canEditMemberDetails).toBe(true);
    expect(perms.canCreateJobTitle).toBe(false);
    expect(perms.canEditRole).toBe(false);
    expect(perms.canEditManager).toBe(false);
  });

  it('allows Team Lead to edit own basic details while protecting role, manager, and job-title creation', () => {
    const perms = evaluatePermissions({
      currentUser: {
        email: 'lead@test.com',
        team_member_id: 'tm-lead',
        role_name: 'Team Lead',
      },
      selectedMemberId: 'tm-lead',
      teamMember: {
        email: 'lead@test.com',
        role_name: 'Team Lead',
      },
    });

    expect(perms.isOwnAccount).toBe(true);
    expect(perms.canEditMemberDetails).toBe(true);
    expect(perms.canCreateJobTitle).toBe(false);
    expect(perms.canEditRole).toBe(false);
    expect(perms.canEditManager).toBe(false);
  });

  it('prohibits Member from editing another member', () => {
    const perms = evaluatePermissions({
      currentUser: {
        email: 'member@test.com',
        team_member_id: 'tm-member',
        role_name: 'Member',
      },
      selectedMemberId: 'tm-other',
      teamMember: {
        email: 'other@test.com',
        role_name: 'Member',
      },
    });

    expect(perms.isOwnAccount).toBe(false);
    expect(perms.canEditMemberDetails).toBe(false);
    expect(perms.canCreateJobTitle).toBe(false);
    expect(perms.canEditRole).toBe(false);
    expect(perms.canEditManager).toBe(false);
  });

  it('allows Admin to create job titles and manage other members, but protects role on self', () => {
    const selfPerms = evaluatePermissions({
      currentUser: {
        email: 'admin@test.com',
        team_member_id: 'tm-admin',
        role_name: 'Admin',
        is_admin: true,
      },
      selectedMemberId: 'tm-admin',
      teamMember: {
        email: 'admin@test.com',
        role_name: 'Admin',
      },
    });

    expect(selfPerms.canCreateJobTitle).toBe(true);
    expect(selfPerms.canEditMemberDetails).toBe(true);
    expect(selfPerms.canEditRole).toBe(false);
    expect(selfPerms.canEditManager).toBe(false);

    const otherPerms = evaluatePermissions({
      currentUser: {
        email: 'admin@test.com',
        team_member_id: 'tm-admin',
        role_name: 'Admin',
        is_admin: true,
      },
      selectedMemberId: 'tm-member',
      teamMember: {
        email: 'member@test.com',
        role_name: 'Member',
      },
    });

    expect(otherPerms.canCreateJobTitle).toBe(true);
    expect(otherPerms.canEditMemberDetails).toBe(true);
    expect(otherPerms.canEditRole).toBe(true);
    expect(otherPerms.canEditManager).toBe(true);
  });
});
