import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ClientPortalClient } from '@/api/client-portal/client-portal-api';
import {
  DEFAULT_VISIBLE_FIELDS,
  getClientInitials,
  getLastActivity,
  getPocNames,
  getPortalStatusKey,
  getStableColorIndex,
  loadVisibleFields,
  saveVisibleFields,
} from './clients-list-helpers';

const buildClient = (overrides: Partial<ClientPortalClient> = {}): ClientPortalClient => ({
  id: 'client-1',
  name: 'Brandbase',
  email: 'alex@brandbase.com',
  assigned_projects_count: 0,
  projects: [],
  team_members: [],
  status: 'active',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

describe('getPocNames', () => {
  it('lists every POC of the company', () => {
    expect(getPocNames(buildClient({ poc_names: ['Alex Chen', ' Jordan Lee '] }))).toEqual([
      'Alex Chen',
      'Jordan Lee',
    ]);
  });

  it('falls back to the free-text contact for companies without company users yet', () => {
    expect(getPocNames(buildClient({ contact_person: ' Alex Chen ' }))).toEqual(['Alex Chen']);
    expect(getPocNames(buildClient({ poc_names: [], contact_person: 'Alex Chen' }))).toEqual([
      'Alex Chen',
    ]);
  });

  it('is empty for a company with no POC, which is valid', () => {
    expect(getPocNames(buildClient())).toEqual([]);
    expect(getPocNames(buildClient({ poc_names: ['  '], contact_person: '' }))).toEqual([]);
  });
});

describe('getPortalStatusKey', () => {
  it('uses the status derived by the server', () => {
    const client = buildClient({
      has_portal_access: true,
      portal_status: { status: 'expired', label: 'Expired', color: 'red' },
    });

    expect(getPortalStatusKey(client)).toBe('expired');
  });

  it('falls back to portal access when the server sent no status', () => {
    expect(getPortalStatusKey(buildClient({ has_portal_access: true }))).toBe('active');
    expect(getPortalStatusKey(buildClient({ has_portal_access: false }))).toBe('not_invited');
    expect(getPortalStatusKey(buildClient())).toBe('not_invited');
  });
});

describe('getLastActivity', () => {
  it('prefers the last sign-in', () => {
    const client = buildClient({
      last_login_at: '2026-05-01T10:00:00.000Z',
      invitation_sent_at: '2026-04-01T10:00:00.000Z',
      portal_status: { status: 'active', label: 'Active', color: 'green' },
    });

    expect(getLastActivity(client)).toEqual({ kind: 'signedIn', at: '2026-05-01T10:00:00.000Z' });
  });

  it.each(['invited', 'expired'] as const)(
    'reports when the invitation was sent for a %s client that never signed in',
    status => {
      const client = buildClient({
        invitation_sent_at: '2026-04-01T10:00:00.000Z',
        portal_status: { status, label: status, color: 'orange' },
      });

      expect(getLastActivity(client)).toEqual({ kind: 'invited', at: '2026-04-01T10:00:00.000Z' });
    }
  );

  it('reports never for clients with no sign-in and no pending invitation', () => {
    expect(getLastActivity(buildClient())).toEqual({ kind: 'never' });
    expect(
      getLastActivity(
        buildClient({
          has_portal_access: true,
          portal_status: { status: 'active', label: 'Active', color: 'green' },
        })
      )
    ).toEqual({ kind: 'never' });
  });
});

describe('getClientInitials', () => {
  it.each([
    ['Brandbase', 'BR'],
    ['Nexora Studio', 'NS'],
    ['  techflow   inc  ', 'TI'],
    ['Harbor & Co', 'HC'],
    ['& &', '?'],
    ['A', 'A'],
    ['', '?'],
    [undefined, '?'],
    [null, '?'],
  ])('turns %j into %s', (name, expected) => {
    expect(getClientInitials(name as string | null | undefined)).toBe(expected);
  });
});

describe('getStableColorIndex', () => {
  it('returns the same index for the same seed and stays inside the palette', () => {
    const first = getStableColorIndex('client-1', 8);

    expect(getStableColorIndex('client-1', 8)).toBe(first);
    expect(first).toBeGreaterThanOrEqual(0);
    expect(first).toBeLessThan(8);
  });

  it('handles an empty seed', () => {
    expect(getStableColorIndex('', 8)).toBe(0);
  });
});

describe('visible fields storage', () => {
  afterEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it('defaults to every field visible', () => {
    expect(loadVisibleFields()).toEqual(DEFAULT_VISIBLE_FIELDS);
  });

  it('round-trips a saved selection', () => {
    saveVisibleFields({ ...DEFAULT_VISIBLE_FIELDS, phone: false, poc: false });

    expect(loadVisibleFields()).toEqual({
      lastActivity: true,
      phone: false,
      poc: false,
      company: true,
    });
  });

  it('ignores stored values that are not booleans and unknown fields', () => {
    window.localStorage.setItem(
      'clientPortalClientsVisibleFields',
      JSON.stringify({ phone: 'no', company: false, unknown: false })
    );

    expect(loadVisibleFields()).toEqual({ ...DEFAULT_VISIBLE_FIELDS, company: false });
  });

  it('falls back to the defaults when the stored value is corrupt', () => {
    window.localStorage.setItem('clientPortalClientsVisibleFields', '{not json');

    expect(loadVisibleFields()).toEqual(DEFAULT_VISIBLE_FIELDS);
  });

  it('does not throw when storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });

    expect(loadVisibleFields()).toEqual(DEFAULT_VISIBLE_FIELDS);
    expect(() => saveVisibleFields(DEFAULT_VISIBLE_FIELDS)).not.toThrow();
  });
});
