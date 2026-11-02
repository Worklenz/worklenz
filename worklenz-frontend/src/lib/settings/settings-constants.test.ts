import { describe, expect, it, vi } from 'vitest';

// Imported eagerly by settings-constants; irrelevant here and heavy to load.
vi.mock('@/pages/settings/rate-card-settings/RateCardSettings', () => ({ default: () => null }));

import { ORGANIZATION_PERMISSIONS } from '@/types/admin-center/permission-schemes.types';
import { getAccessibleSettings, settingsItems } from './settings-constants';

const helpItem = settingsItems.find(item => item.key === 'help');

describe('settings-constants: Help tab', () => {
  it('should register a Help item in the HELP & SUPPORT group', () => {
    expect(helpItem).toBeDefined();
    expect(helpItem?.endpoint).toBe('help');
    expect(helpItem?.groupKey).toBe('help-support');
    expect(helpItem?.groupDefaultValue).toBe('Help & Support');
  });

  it('should never be gated by role or plan', () => {
    expect(helpItem?.adminOnly).toBeUndefined();
    expect(helpItem?.requiredFeature).toBeUndefined();
    expect(helpItem?.showInSidebar).not.toBe(false);
  });

  it('should be visible to non-admin users', () => {
    const memberKeys = getAccessibleSettings(false, null).map(item => item.key);

    expect(memberKeys).toContain('help');
  });

  it('should be visible to admins', () => {
    const adminKeys = getAccessibleSettings(true, null).map(item => item.key);

    expect(adminKeys).toContain('help');
  });

  it('should sit directly above the Danger Zone, which stays last', () => {
    // The sidebar orders groups by first appearance in this array.
    const groupOrder = [...new Set(settingsItems.map(item => item.groupKey))];

    expect(groupOrder[groupOrder.length - 1]).toBe('danger-zone');
    expect(groupOrder[groupOrder.length - 2]).toBe('help-support');
  });
});

describe('settings-constants: organization permissions', () => {
  it('hides admin-only items from members without permissions', () => {
    const memberKeys = getAccessibleSettings(false, null, []).map(item => item.key);

    expect(memberKeys).not.toContain('clients');
    expect(memberKeys).not.toContain('team-members');
    expect(memberKeys).not.toContain('configuration');
    expect(memberKeys).not.toContain('organization-currency');
    expect(memberKeys).not.toContain('teams');
  });

  it('shows admin-only items to owners/admins without explicit permissions', () => {
    const adminKeys = getAccessibleSettings(true, null, []).map(item => item.key);

    expect(adminKeys).toContain('clients');
    expect(adminKeys).toContain('team-members');
    expect(adminKeys).toContain('configuration');
    expect(adminKeys).toContain('teams');
  });

  it('unlocks clients for members with Manage clients', () => {
    const keys = getAccessibleSettings(false, null, [
      ORGANIZATION_PERMISSIONS.MANAGE_CLIENTS,
    ]).map(item => item.key);

    expect(keys).toContain('clients');
    expect(keys).not.toContain('team-members');
    expect(keys).not.toContain('configuration');
  });

  it('unlocks team member pages for members with Manage users', () => {
    const keys = getAccessibleSettings(false, null, [
      ORGANIZATION_PERMISSIONS.MANAGE_USERS,
    ]).map(item => item.key);

    expect(keys).toContain('team-members');
    expect(keys).toContain('guest-members');
    expect(keys).not.toContain('clients');
  });

  it('unlocks organization settings pages for members with Manage organization settings', () => {
    const keys = getAccessibleSettings(false, null, [
      ORGANIZATION_PERMISSIONS.MANAGE_ORGANIZATION_SETTINGS,
    ]).map(item => item.key);

    expect(keys).toContain('departments');
    expect(keys).toContain('configuration');
    expect(keys).toContain('integrations');
    expect(keys).toContain('labels');
    expect(keys).not.toContain('clients');
    expect(keys).not.toContain('organization-currency');
  });

  it('unlocks billing settings for members with Manage billing', () => {
    const keys = getAccessibleSettings(false, null, [
      ORGANIZATION_PERMISSIONS.MANAGE_BILLING,
    ]).map(item => item.key);

    expect(keys).toContain('organization-currency');
    expect(keys).not.toContain('configuration');
  });

  it('unlocks teams pages for members with Manage teams', () => {
    const keys = getAccessibleSettings(false, null, [
      ORGANIZATION_PERMISSIONS.MANAGE_TEAMS,
    ]).map(item => item.key);

    expect(keys).toContain('teams');
    expect(keys).toContain('team-hierarchy');
    expect(keys).not.toContain('team-members');
  });
});
