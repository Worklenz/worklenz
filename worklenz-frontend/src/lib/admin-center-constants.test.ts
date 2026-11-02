import { describe, expect, it, vi } from 'vitest';

vi.mock('../pages/admin-center/overview/overview', () => ({ default: () => null }));
vi.mock('../pages/admin-center/users/users', () => ({ default: () => null }));
vi.mock('../pages/admin-center/teams/teams', () => ({ default: () => null }));
vi.mock('../pages/admin-center/billing/BillingSection', () => ({ default: () => null }));
vi.mock('../pages/admin-center/projects/projects', () => ({ default: () => null }));
vi.mock('../pages/admin-center/settings/settings', () => ({ default: () => null }));
vi.mock('../pages/admin-center/security/audit-log-page', () => ({ default: () => null }));

import { ORGANIZATION_PERMISSIONS } from '@/types/admin-center/permission-schemes.types';
import {
  adminCenterItems,
  canAccessAdminCenter,
  canAccessAdminCenterItem,
} from './admin-center-constants';

describe('admin-center-constants access', () => {
  const usersItem = adminCenterItems.find(item => item.key === 'users')!;
  const billingItem = adminCenterItems.find(item => item.key === 'billing')!;
  const projectsItem = adminCenterItems.find(item => item.key === 'projects')!;
  const securityItem = adminCenterItems.find(item => item.key === 'security')!;
  const overviewItem = adminCenterItems.find(item => item.key === 'overview')!;

  it('allows Owner/Admin into Admin Center without grants', () => {
    expect(canAccessAdminCenter(true, [])).toBe(true);
  });

  it('blocks members without Manage permissions', () => {
    expect(canAccessAdminCenter(false, [])).toBe(false);
  });

  it('allows members with any Admin Center Manage permission', () => {
    expect(
      canAccessAdminCenter(false, [ORGANIZATION_PERMISSIONS.MANAGE_BILLING])
    ).toBe(true);
  });

  it('shows overview to anyone who can enter Admin Center', () => {
    expect(canAccessAdminCenterItem(overviewItem, false, [
      ORGANIZATION_PERMISSIONS.MANAGE_USERS,
    ])).toBe(true);
  });

  it('unlocks users for Manage users only', () => {
    expect(
      canAccessAdminCenterItem(usersItem, false, [ORGANIZATION_PERMISSIONS.MANAGE_USERS])
    ).toBe(true);
    expect(
      canAccessAdminCenterItem(usersItem, false, [ORGANIZATION_PERMISSIONS.MANAGE_BILLING])
    ).toBe(false);
  });

  it('unlocks billing for Manage billing', () => {
    expect(
      canAccessAdminCenterItem(billingItem, false, [ORGANIZATION_PERMISSIONS.MANAGE_BILLING])
    ).toBe(true);
  });

  it('keeps projects and security Owner/Admin-only', () => {
    expect(
      canAccessAdminCenterItem(projectsItem, false, [
        ORGANIZATION_PERMISSIONS.MANAGE_USERS,
        ORGANIZATION_PERMISSIONS.MANAGE_BILLING,
        ORGANIZATION_PERMISSIONS.MANAGE_ORGANIZATION_SETTINGS,
      ])
    ).toBe(false);
    expect(
      canAccessAdminCenterItem(securityItem, false, [
        ORGANIZATION_PERMISSIONS.MANAGE_ORGANIZATION_SETTINGS,
      ])
    ).toBe(false);
    expect(canAccessAdminCenterItem(projectsItem, true, [])).toBe(true);
    expect(canAccessAdminCenterItem(securityItem, true, [])).toBe(true);
  });
});
