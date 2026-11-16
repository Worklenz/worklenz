import { describe, it, expect } from 'vitest';
import { evaluateUpdateMemberPermissions } from '@/utils/update-member-permissions';

describe('update-member-drawer permission and self-edit gating rules', () => {
  it('allows Member to edit own basic details while protecting role, manager, and job-title creation', () => {
    const perms = evaluateUpdateMemberPermissions({
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
    const perms = evaluateUpdateMemberPermissions({
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
    const perms = evaluateUpdateMemberPermissions({
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

  it('allows Member with Manage users to edit another member', () => {
    const perms = evaluateUpdateMemberPermissions({
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
      hasManageUsers: true,
    });

    expect(perms.canEditMemberDetails).toBe(true);
    expect(perms.canCreateJobTitle).toBe(true);
    expect(perms.canEditRole).toBe(true);
  });

  it('does not let Manage users edit an Admin', () => {
    const perms = evaluateUpdateMemberPermissions({
      currentUser: {
        email: 'member@test.com',
        team_member_id: 'tm-member',
        role_name: 'Member',
      },
      selectedMemberId: 'tm-admin',
      teamMember: {
        email: 'admin@test.com',
        role_name: 'Admin',
      },
      hasManageUsers: true,
    });

    expect(perms.canEditMemberDetails).toBe(false);
    expect(perms.canCreateJobTitle).toBe(true);
    expect(perms.canEditRole).toBe(false);
    expect(perms.canEditManager).toBe(false);
  });

  it('allows Member with project Manage members to edit details but not team role', () => {
    const perms = evaluateUpdateMemberPermissions({
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
      allowProjectMemberManage: true,
    });

    expect(perms.canEditMemberDetails).toBe(true);
    expect(perms.canCreateJobTitle).toBe(false);
    expect(perms.canEditRole).toBe(false);
    expect(perms.canEditManager).toBe(false);
  });

  it('allows Admin to create job titles and manage other members, but protects role on self', () => {
    const selfPerms = evaluateUpdateMemberPermissions({
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

    const otherPerms = evaluateUpdateMemberPermissions({
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
