import { describe, expect, it, vi } from 'vitest';

// Imported eagerly by settings-constants; irrelevant here and heavy to load.
vi.mock('@/pages/settings/rate-card-settings/RateCardSettings', () => ({ default: () => null }));

import { getAccessibleSettings, settingsItems } from './settings-constants';
import { ILocalSession } from '@/types/auth/local-session.types';

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
    expect(helpItem?.businessPlanRequired).toBeUndefined();
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

  it('should limit an expired trial to personal settings and the danger zone', () => {
    const keys = getAccessibleSettings(true, {
      subscription_type: 'TRIAL',
      is_expired: true,
    } as ILocalSession).map(item => item.key);

    expect(keys).toContain('profile');
    expect(keys).toContain('change-password');
    expect(keys).toContain('account-deletion');
    expect(keys).not.toContain('clients');
    expect(keys).not.toContain('help');
  });

  it('should sit directly above the Danger Zone, which stays last', () => {
    // The sidebar orders groups by first appearance in this array.
    const groupOrder = [...new Set(settingsItems.map(item => item.groupKey))];

    expect(groupOrder[groupOrder.length - 1]).toBe('danger-zone');
    expect(groupOrder[groupOrder.length - 2]).toBe('help-support');
  });
});
