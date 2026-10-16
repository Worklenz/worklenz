import { describe, expect, it } from 'vitest';
import { getPathAfterTeamSwitch } from '../teamSwitchNavigation';

describe('getPathAfterTeamSwitch', () => {
  it.each([
    '/projects/p-1',
    '/projects/p-1/tasks',
    '/approvals/a-1',
    '/change-requests/cr-1',
    '/invoices/inv-1',
  ])('sends %s to the dashboard, since the item belongs to the old team', pathname => {
    expect(getPathAfterTeamSwitch(pathname)).toBe('/dashboard');
  });

  it.each(['/dashboard', '/projects', '/approvals', '/notifications', '/account/profile', '/settings'])(
    'keeps %s',
    pathname => {
      expect(getPathAfterTeamSwitch(pathname)).toBe(pathname);
    }
  );
});
