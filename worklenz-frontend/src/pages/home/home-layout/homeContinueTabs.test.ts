import { describe, expect, it } from 'vitest';
import {
  DEFAULT_HOME_CONTINUE_TABS,
  getVisibleContinueTabs,
  isDefaultHomeContinueTabs,
  resolveActiveContinueTab,
  resolveHomeContinueTabs,
  setContinueTabHidden,
} from './homeContinueTabs';

describe('resolveHomeContinueTabs', () => {
  it('shows everything for missing or malformed input', () => {
    expect(resolveHomeContinueTabs(undefined)).toEqual(DEFAULT_HOME_CONTINUE_TABS);
    expect(resolveHomeContinueTabs('nope')).toEqual(DEFAULT_HOME_CONTINUE_TABS);
    expect(resolveHomeContinueTabs({ hidden: 'tasks' })).toEqual(DEFAULT_HOME_CONTINUE_TABS);
  });

  it('keeps known hidden items once each and drops the rest', () => {
    expect(resolveHomeContinueTabs({ hidden: ['tasks', 'bogus', 'tasks', 7, 'time'] })).toEqual({
      hidden: ['tasks', 'time'],
    });
  });

  it('never leaves every item hidden', () => {
    const resolved = resolveHomeContinueTabs({ hidden: ['projects', 'tasks', 'activity', 'time'] });
    expect(getVisibleContinueTabs(resolved)).toEqual(['projects']);
  });
});

describe('visibility', () => {
  it('lists the visible items in their fixed order', () => {
    expect(getVisibleContinueTabs({ hidden: ['tasks'] })).toEqual(['projects', 'activity', 'time']);
    expect(getVisibleContinueTabs(DEFAULT_HOME_CONTINUE_TABS)).toEqual(['projects', 'tasks', 'activity', 'time']);
  });

  it('keeps the current item when it is visible, and falls back to the first visible one when it is not', () => {
    expect(resolveActiveContinueTab({ hidden: ['projects'] }, 'tasks')).toBe('tasks');
    expect(resolveActiveContinueTab({ hidden: ['projects'] }, 'projects')).toBe('tasks');
    expect(resolveActiveContinueTab(DEFAULT_HOME_CONTINUE_TABS, 'garbage')).toBe('projects');
  });

  it('hides and shows an item without touching the others', () => {
    const hidden = setContinueTabHidden(DEFAULT_HOME_CONTINUE_TABS, 'activity', true);
    expect(hidden.hidden).toEqual(['activity']);
    expect(setContinueTabHidden(hidden, 'activity', false)).toEqual(DEFAULT_HOME_CONTINUE_TABS);
    expect(isDefaultHomeContinueTabs(setContinueTabHidden(hidden, 'activity', false))).toBe(true);
  });

  it('refuses to hide the last visible item, and returns the same config for a no-op', () => {
    const onlyTime = { hidden: ['projects', 'tasks', 'activity'] as const };
    const config = { hidden: [...onlyTime.hidden] };
    expect(setContinueTabHidden(config, 'time', true)).toBe(config);
    expect(setContinueTabHidden(DEFAULT_HOME_CONTINUE_TABS, 'tasks', false)).toBe(DEFAULT_HOME_CONTINUE_TABS);
  });

  it('does not mutate the config it is given', () => {
    const config = { hidden: ['tasks' as const] };
    setContinueTabHidden(config, 'time', true);
    expect(config).toEqual({ hidden: ['tasks'] });
  });
});
