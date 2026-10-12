import { describe, expect, it } from 'vitest';
import {
  canInviteClient,
  clientWorkspacePath,
  formatOutstanding,
  getActivityLetter,
  getClientDisplayName,
  getProjectProgress,
  getWorkspaceActivity,
  parseWorkspaceTab,
  shouldWarnAboutPortalAccess,
} from './workspace-helpers';

describe('parseWorkspaceTab', () => {
  it('reads a known tab', () => {
    expect(parseWorkspaceTab('billing')).toBe('billing');
    expect(parseWorkspaceTab('members')).toBe('members');
  });

  it.each([null, undefined, '', 'nope', 'files', 'access', 'contracts'])(
    'opens Overview for %j, including tabs that are not built yet',
    value => expect(parseWorkspaceTab(value)).toBe('overview')
  );
});

describe('clientWorkspacePath', () => {
  it('is the one address of a client', () => {
    expect(clientWorkspacePath('abc')).toBe('/worklenz/client-portal/clients/abc');
  });

  it('leaves the default tab out of the address', () => {
    expect(clientWorkspacePath('abc', 'overview')).toBe('/worklenz/client-portal/clients/abc');
  });

  it('names any other tab', () => {
    expect(clientWorkspacePath('abc', 'projects')).toBe(
      '/worklenz/client-portal/clients/abc?tab=projects'
    );
  });
});

describe('getClientDisplayName', () => {
  it('prefers the company name', () => {
    expect(getClientDisplayName({ name: 'Dilshan', company_name: 'Beacon Logistics' })).toBe(
      'Beacon Logistics'
    );
  });

  it('falls back to the client name when there is no company', () => {
    expect(getClientDisplayName({ name: 'Dilshan', company_name: null })).toBe('Dilshan');
    expect(getClientDisplayName({ name: 'Dilshan', company_name: '   ' })).toBe('Dilshan');
  });
});

describe('getProjectProgress', () => {
  it('is the share of tasks that are done, rounded', () => {
    expect(getProjectProgress({ total_tasks: 3, completed_tasks: 1 })).toBe(33);
    expect(getProjectProgress({ total_tasks: 4, completed_tasks: 4 })).toBe(100);
  });

  it('is 0% for a project without tasks, rather than dividing by zero', () => {
    expect(getProjectProgress({ total_tasks: 0, completed_tasks: 0 })).toBe(0);
  });

  it('never goes over 100%', () => {
    expect(getProjectProgress({ total_tasks: 2, completed_tasks: 5 })).toBe(100);
  });
});

describe('formatOutstanding', () => {
  it('gives one formatted amount per currency, never a sum', () => {
    expect(
      formatOutstanding(
        [
          { currency: 'USD', amount: 1500.5 },
          { currency: 'EUR', amount: 200 },
        ],
        'en-US'
      )
    ).toEqual(['$1,500.50', '€200.00']);
  });

  it('skips currencies with nothing owed', () => {
    expect(formatOutstanding([{ currency: 'USD', amount: 0 }], 'en-US')).toEqual([]);
    expect(formatOutstanding([], 'en-US')).toEqual([]);
  });

  it('still shows the number for a currency code it does not know', () => {
    expect(formatOutstanding([{ currency: 'NOPE', amount: 12 }], 'en-US')).toEqual(['NOPE 12.00']);
  });
});

describe('getWorkspaceActivity', () => {
  const stats = (overrides: Record<string, unknown> = {}) => ({
    lastLoginAt: null,
    invitedAt: null,
    portalStatus: { status: 'not_invited' as const, label: 'Not Invited', color: 'default' },
    ...overrides,
  });

  it('prefers the last sign-in', () => {
    expect(getWorkspaceActivity(stats({ lastLoginAt: '2026-09-01T00:00:00.000Z' }))).toEqual({
      kind: 'signedIn',
      at: '2026-09-01T00:00:00.000Z',
    });
  });

  it('uses the invitation for a client that was invited and has not signed in', () => {
    const invitedAt = '2026-09-10T00:00:00.000Z';

    expect(
      getWorkspaceActivity(
        stats({ invitedAt, portalStatus: { status: 'invited', label: 'Invited', color: 'orange' } })
      )
    ).toEqual({ kind: 'invited', at: invitedAt });
    expect(
      getWorkspaceActivity(
        stats({ invitedAt, portalStatus: { status: 'expired', label: 'Expired', color: 'red' } })
      )
    ).toEqual({ kind: 'invited', at: invitedAt });
  });

  it('says never otherwise', () => {
    expect(getWorkspaceActivity(stats())).toEqual({ kind: 'never' });
  });
});

describe('shouldWarnAboutPortalAccess', () => {
  it.each(['invited', 'not_invited', 'expired', 'disabled'])('warns for %s', status =>
    expect(shouldWarnAboutPortalAccess(status)).toBe(true)
  );

  it('does not warn for an active client, or while the status is still unknown', () => {
    expect(shouldWarnAboutPortalAccess('active')).toBe(false);
    expect(shouldWarnAboutPortalAccess(undefined)).toBe(false);
  });
});

describe('canInviteClient', () => {
  it('offers an invite unless the client is in already', () => {
    expect(canInviteClient('not_invited')).toBe(true);
    expect(canInviteClient('expired')).toBe(true);
    expect(canInviteClient('active')).toBe(false);
    expect(canInviteClient(undefined)).toBe(false);
  });
});

describe('getActivityLetter', () => {
  it('gives each kind of activity its letter', () => {
    expect(getActivityLetter('project')).toBe('P');
    expect(getActivityLetter('request')).toBe('R');
    expect(getActivityLetter('invoice')).toBe('I');
    expect(getActivityLetter('chat')).toBe('M');
  });
});
