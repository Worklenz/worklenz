import { describe, expect, it } from 'vitest';
import {
  DEFAULT_HOME_PREFERENCES,
  sanitizeHomePreferences,
  type HomePreferences,
} from './homePreferences.slice';
import { reconcileHomePreferences, serializeHomePreferences } from './homePreferencesSync';
import { clearLegacyHomePins, readLegacyHomePinIds } from './legacyHomePins';

const customised = (): HomePreferences =>
  sanitizeHomePreferences({
    ...DEFAULT_HOME_PREFERENCES,
    selections: { ...DEFAULT_HOME_PREFERENCES.selections, period: 'today', priorityTab: 'Overdue' },
  });

describe('reconcileHomePreferences', () => {
  it('does nothing when the cache already matches what the server has', () => {
    const local = customised();
    expect(reconcileHomePreferences(local, local, '2026-10-03T00:00:00Z')).toEqual({ action: 'none' });
  });

  it('shows the server copy when it differs from the cache', () => {
    const decision = reconcileHomePreferences(DEFAULT_HOME_PREFERENCES, customised(), '2026-10-03T00:00:00Z');
    expect(decision.action).toBe('adopt-server');
    expect(decision.action === 'adopt-server' && decision.preferences.selections.period).toBe('today');
  });

  it('treats the server as the source of truth even if the cache looks newer', () => {
    const decision = reconcileHomePreferences(customised(), DEFAULT_HOME_PREFERENCES, '2026-10-03T00:00:00Z');
    expect(decision.action).toBe('adopt-server');
  });

  it('uploads a customised cache when the server has never saved anything', () => {
    expect(reconcileHomePreferences(customised(), DEFAULT_HOME_PREFERENCES, null)).toEqual({ action: 'push-local' });
  });

  it('does not upload an untouched cache for a user the server has never seen', () => {
    expect(reconcileHomePreferences(DEFAULT_HOME_PREFERENCES, DEFAULT_HOME_PREFERENCES, null)).toEqual({
      action: 'none',
    });
  });

  it('sanitises what the server sends before comparing or adopting it', () => {
    const decision = reconcileHomePreferences(DEFAULT_HOME_PREFERENCES, { selections: { period: 'bogus' } }, '2026-10-03T00:00:00Z');
    // Garbage sanitises to the defaults, which is what the cache already holds.
    expect(decision).toEqual({ action: 'none' });
  });
});

describe('the Continue widget toggles in the preferences', () => {
  const withHidden = (hidden: unknown) => sanitizeHomePreferences({ ...DEFAULT_HOME_PREFERENCES, continueTabs: { hidden } });

  it('shows every toggle unless the user hid some', () => {
    expect(DEFAULT_HOME_PREFERENCES.continueTabs).toEqual({ hidden: [] });
    expect(sanitizeHomePreferences({}).continueTabs).toEqual({ hidden: [] });
    // A document saved before the toggles could be hidden has no such field.
    expect(sanitizeHomePreferences({ version: 1, layout: DEFAULT_HOME_PREFERENCES.layout }).continueTabs).toEqual({ hidden: [] });
  });

  it('keeps known toggles and drops unknown or repeated ones', () => {
    expect(withHidden(['activity', 'nope', 'activity', 7]).continueTabs).toEqual({ hidden: ['activity'] });
    expect(withHidden('activity').continueTabs).toEqual({ hidden: [] });
  });

  it('never leaves every toggle hidden', () => {
    expect(withHidden(['projects', 'tasks', 'activity', 'time']).continueTabs.hidden).toHaveLength(3);
  });

  it('counts as a customisation: adopted from the server, uploaded when the server has none', () => {
    const hidden = withHidden(['time']);
    const adopt = reconcileHomePreferences(DEFAULT_HOME_PREFERENCES, hidden, '2026-10-03T00:00:00Z');
    expect(adopt.action === 'adopt-server' && adopt.preferences.continueTabs).toEqual({ hidden: ['time'] });
    expect(reconcileHomePreferences(hidden, DEFAULT_HOME_PREFERENCES, null)).toEqual({ action: 'push-local' });
    expect(serializeHomePreferences(hidden)).not.toBe(serializeHomePreferences(DEFAULT_HOME_PREFERENCES));
  });
});

describe('serializeHomePreferences', () => {
  it('is the same for the same preferences regardless of key order', () => {
    const a = customised();
    const reordered = { selections: a.selections, tabs: a.tabs, layout: a.layout, version: a.version };
    expect(serializeHomePreferences(reordered)).toBe(serializeHomePreferences(a));
  });

  it('differs when anything saved differs', () => {
    expect(serializeHomePreferences(customised())).not.toBe(serializeHomePreferences(DEFAULT_HOME_PREFERENCES));
  });
});

describe('legacy local pins', () => {
  const KEY = 'worklenz.homePins:user-1';

  it('reads task ids oldest first so the newest pin is imported last', () => {
    localStorage.setItem(KEY, JSON.stringify({ c: 300, a: 100, b: 200 }));
    expect(readLegacyHomePinIds('user-1')).toEqual(['a', 'b', 'c']);
  });

  it('ignores another user, missing data, junk and non-numeric entries', () => {
    localStorage.setItem(KEY, JSON.stringify({ a: 'x', b: 5 }));
    expect(readLegacyHomePinIds('user-1')).toEqual(['b']);
    expect(readLegacyHomePinIds('someone-else')).toEqual([]);
    localStorage.setItem(KEY, 'not json');
    expect(readLegacyHomePinIds('user-1')).toEqual([]);
  });

  it('clears them once imported', () => {
    localStorage.setItem(KEY, JSON.stringify({ a: 1 }));
    clearLegacyHomePins('user-1');
    expect(localStorage.getItem(KEY)).toBeNull();
  });
});
