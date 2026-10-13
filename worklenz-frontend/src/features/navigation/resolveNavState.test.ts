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

  const DEFAULT_ORDER = [
    'clients',
    'requests',
    'services',
    'quotes',
    'invoices',
    'chats',
    'ticketing',
    'client-analytics',
    'view-as-client',
    'settings',
  ];

  it('defaults to Clients, Requests, Services, Quotes, Invoices, Chats, Ticketing, Analytics, View as client, Settings', () => {
    expect(keys(preferences)).toEqual(DEFAULT_ORDER);
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
      orderVersions: { 'client-portal': 1 },
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
