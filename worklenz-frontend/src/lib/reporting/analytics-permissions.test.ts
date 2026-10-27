import { describe, expect, it } from 'vitest';
import {
  getAnalyticsDashboardPermissions,
  getAnalyticsReportPermissions,
  resolveAnalyticsActorRole,
} from './analytics-permissions';

describe('analytics-permissions', () => {
  it('blocks guests from reports', () => {
    expect(getAnalyticsReportPermissions({ role: 'guest' }).canViewReports).toBe(false);
  });

  it('allows members to create and fully manage own dashboards without share', () => {
    const perms = getAnalyticsDashboardPermissions(
      { role: 'member', userId: 'u1' },
      { ownerId: 'u1', isShared: false }
    );
    expect(perms.canCreate).toBe(true);
    expect(perms.canEdit).toBe(true);
    expect(perms.canDelete).toBe(true);
    expect(perms.canShare).toBe(false);
  });

  it('gives managers comment on shared dashboards', () => {
    const perms = getAnalyticsDashboardPermissions(
      { role: 'manager', userId: 'u2' },
      { ownerId: 'u1', isShared: true }
    );
    expect(perms.canView).toBe(true);
    expect(perms.canComment).toBe(true);
    expect(perms.canEdit).toBe(false);
  });

  it('gives admins full access to any dashboard', () => {
    const perms = getAnalyticsDashboardPermissions(
      { role: 'admin', userId: 'admin' },
      { ownerId: 'u1', isShared: false }
    );
    expect(perms.canEdit).toBe(true);
    expect(perms.canDelete).toBe(true);
    expect(perms.canShare).toBe(true);
  });

  it('maps team lead session role to manager', () => {
    expect(resolveAnalyticsActorRole({ role_name: 'Team Lead' })).toBe('manager');
  });
});
