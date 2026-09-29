import { describe, it, expect } from 'vitest';
import {
  normalizeRoleName,
  getSessionRoleName,
  canManageUserRole,
  getAvailableRoleOptions,
} from '../role-permissions.utils';
import { ROLE_NAMES } from '@/types/roles/role.types';

describe('role-permissions.utils', () => {
  describe('normalizeRoleName', () => {
    it('returns OWNER when isOwner flag is true regardless of roleName string', () => {
      expect(normalizeRoleName('Member', true)).toBe(ROLE_NAMES.OWNER);
      expect(normalizeRoleName(undefined, true)).toBe(ROLE_NAMES.OWNER);
      expect(normalizeRoleName('', true)).toBe(ROLE_NAMES.OWNER);
    });

    it('normalizes known role name strings case-insensitively', () => {
      expect(normalizeRoleName('owner')).toBe(ROLE_NAMES.OWNER);
      expect(normalizeRoleName('ADMIN')).toBe(ROLE_NAMES.ADMIN);
      expect(normalizeRoleName('Team Lead')).toBe(ROLE_NAMES.TEAM_LEAD);
      expect(normalizeRoleName('teamlead')).toBe(ROLE_NAMES.TEAM_LEAD);
      expect(normalizeRoleName('team_lead')).toBe(ROLE_NAMES.TEAM_LEAD);
    });

    it('falls back to MEMBER for unknown or missing role names', () => {
      expect(normalizeRoleName('Guest')).toBe(ROLE_NAMES.MEMBER);
      expect(normalizeRoleName('')).toBe(ROLE_NAMES.MEMBER);
      expect(normalizeRoleName(undefined)).toBe(ROLE_NAMES.MEMBER);
    });
  });

  describe('getSessionRoleName', () => {
    it('extracts role from session correctly', () => {
      expect(getSessionRoleName({ role_name: 'Admin', owner: false } as any)).toBe(
        ROLE_NAMES.ADMIN
      );
      expect(getSessionRoleName({ role_name: 'Member', owner: true } as any)).toBe(
        ROLE_NAMES.OWNER
      );
      expect(getSessionRoleName(null)).toBe(ROLE_NAMES.MEMBER);
    });
  });

  describe('canManageUserRole', () => {
    it('allows Owner to manage Admin, Team Lead, and Member', () => {
      expect(canManageUserRole(ROLE_NAMES.OWNER, ROLE_NAMES.ADMIN)).toBe(true);
      expect(canManageUserRole(ROLE_NAMES.OWNER, ROLE_NAMES.TEAM_LEAD)).toBe(true);
      expect(canManageUserRole(ROLE_NAMES.OWNER, ROLE_NAMES.MEMBER)).toBe(true);
      expect(canManageUserRole(ROLE_NAMES.OWNER, ROLE_NAMES.OWNER)).toBe(false);
    });

    it('allows Admin to manage Admin, Team Lead, and Member, but not Owner', () => {
      expect(canManageUserRole(ROLE_NAMES.ADMIN, ROLE_NAMES.TEAM_LEAD)).toBe(true);
      expect(canManageUserRole(ROLE_NAMES.ADMIN, ROLE_NAMES.MEMBER)).toBe(true);
      expect(canManageUserRole(ROLE_NAMES.ADMIN, ROLE_NAMES.ADMIN)).toBe(true);
      expect(canManageUserRole(ROLE_NAMES.ADMIN, ROLE_NAMES.OWNER)).toBe(false);
    });

    it('denies Member and Team Lead from managing roles', () => {
      expect(canManageUserRole(ROLE_NAMES.MEMBER, ROLE_NAMES.MEMBER)).toBe(false);
      expect(canManageUserRole(ROLE_NAMES.TEAM_LEAD, ROLE_NAMES.MEMBER)).toBe(false);
    });
  });

  describe('getAvailableRoleOptions', () => {
    it('returns assignable roles for Owner', () => {
      const options = getAvailableRoleOptions(ROLE_NAMES.OWNER);
      const values = options.map(o => o.value);
      expect(values).toContain(ROLE_NAMES.ADMIN);
      expect(values).toContain(ROLE_NAMES.TEAM_LEAD);
      expect(values).toContain(ROLE_NAMES.MEMBER);
      expect(values).not.toContain(ROLE_NAMES.OWNER);
    });

    it('returns assignable roles for Admin (excludes Owner)', () => {
      const options = getAvailableRoleOptions(ROLE_NAMES.ADMIN);
      const values = options.map(o => o.value);
      expect(values).toContain(ROLE_NAMES.ADMIN);
      expect(values).toContain(ROLE_NAMES.TEAM_LEAD);
      expect(values).toContain(ROLE_NAMES.MEMBER);
      expect(values).not.toContain(ROLE_NAMES.OWNER);
    });

    it('returns empty assignable roles for regular Member', () => {
      const options = getAvailableRoleOptions(ROLE_NAMES.MEMBER);
      expect(options).toHaveLength(0);
    });
  });
});
