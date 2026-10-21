import { describe, expect, it } from 'vitest';
import { CLIENT_PORTAL_NAV_SURFACE, HOME_NAV_SURFACE, PROJECTS_NAV_SURFACE } from './nav-registry';
import { resolveNavState } from './resolveNavState';
import { applyOrderResets } from './navPreferences.slice';
import type { NavPreferencesState } from './navPreferences.slice';

const preferences: NavPreferencesState = {
  collapsed: false,
  collapsedIsUserSet: false,
  pinnedDefaults: {},
  order: {},
};

const getItemKeys = (isGuestUser: boolean, isOwnerOrAdmin: boolean) =>
  resolveNavState(PROJECTS_NAV_SURFACE, preferences, isGuestUser, isOwnerOrAdmin)
    .groups.flatMap(group => group.items.map(item => item.key));

describe('projects navigation', () => {
  it('keeps Templates unavailable to non-admin members', () => {
    expect(getItemKeys(false, false)).not.toContain('templates');
  });

  it('keeps Templates available to owner and admin users', () => {
    expect(getItemKeys(false, true)).toContain('templates');
  });

  it('keeps Templates unavailable to guest users', () => {
    expect(getItemKeys(true, false)).not.toContain('templates');
  });
});

describe('client portal navigation', () => {
  const keys = (prefs: NavPreferencesState) =>
    resolveNavState(CLIENT_PORTAL_NAV_SURFACE, prefs, false, true).groups.flatMap(group =>
      group.items.map(item => item.key)
    );

  // Client Portal v2 order. Services, Requests, Chats and Ticketing are retired and no longer listed.
  const V2_ORDER = [
    'overview',
    'clients',
    'projects',
    'approvals',
    'change-requests',
    'discussions',
    'quotes',
    'invoices',
    'audit-log',
    'settings',
    'preview',
  ];
  const RETIRED_V1_KEYS = ['requests', 'services', 'chats', 'ticketing'];
  const DEFAULT_ORDER = V2_ORDER;

  it('defaults to the v2 order', () => {
    expect(keys(preferences)).toEqual(DEFAULT_ORDER);
  });

  it('no longer lists the retired v1 modules', () => {
    for (const key of RETIRED_V1_KEYS) expect(keys(preferences)).not.toContain(key);
  });

  it('no longer lists the inert Client Analytics and View as client placeholders', () => {
    expect(keys(preferences)).not.toContain('client-analytics');
    expect(keys(preferences)).not.toContain('view-as-client');
  });

  it('drops an order saved before the default changed, so the new default shows', () => {
    const stale: NavPreferencesState = {
      ...preferences,
      order: {
        'client-portal': { '': ['settings', 'invoices', 'clients'] },
        projects: { '': ['templates'] },
      },
    };

    const { state, changed } = applyOrderResets(stale);

    expect(changed).toBe(true);
    expect(keys(state)).toEqual(DEFAULT_ORDER);
    // Other surfaces keep their saved order.
    expect(state.order.projects).toEqual({ '': ['templates'] });
  });

  it('keeps an order the user saved after the reset', () => {
    const saved: NavPreferencesState = {
      ...preferences,
      order: { 'client-portal': { '': ['invoices', 'clients'] } },
      orderVersions: { 'client-portal': 3 },
    };

    const { state, changed } = applyOrderResets(saved);

    expect(changed).toBe(false);
    expect(keys(state).slice(0, 2)).toEqual(['invoices', 'clients']);
  });
});

describe('hidden navigation items', () => {
  const home = (prefs: Partial<NavPreferencesState>, includeHidden = false) =>
    resolveNavState(HOME_NAV_SURFACE, { ...preferences, ...prefs }, false, true, includeHidden);
  const keys = (state: ReturnType<typeof resolveNavState>) =>
    state.groups.flatMap(group => group.items.map(item => item.key));

  it('drops hidden items from the rail', () => {
    expect(keys(home({ hidden: { home: ['calendar', 'inbox'] } }))).not.toContain('calendar');
    expect(keys(home({ hidden: { home: ['calendar', 'inbox'] } }))).not.toContain('inbox');
  });

  it('keeps hidden items when asked to include them, in their saved place', () => {
    const state = home({ hidden: { home: ['calendar'] }, order: { home: { '': ['calendar', 'overview'] } } }, true);
    expect(keys(state).slice(0, 2)).toEqual(['calendar', 'overview']);
  });

  it('opens on the first item still shown when the default page is hidden', () => {
    const state = home({ hidden: { home: ['overview'] } });
    expect(state.activeDefaultKey).toBe('my-tasks');
  });

  it('opens on the pinned page even though the default page is hidden', () => {
    const state = home({ hidden: { home: ['overview'] }, pinnedDefaults: { home: 'calendar' } });
    expect(state.activeDefaultKey).toBe('calendar');
  });

  it('ignores a hidden list that would empty the rail', () => {
    const all = HOME_NAV_SURFACE.groups.flatMap(group => group.items.map(item => item.key));
    expect(keys(home({ hidden: { home: all } })).length).toBeGreaterThan(0);
  });
});
