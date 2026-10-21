import { describe, expect, it } from 'vitest';
import {
  DEFAULT_HOME_TABS,
  getVisibleTabs,
  isDefaultHomeTabs,
  moveTabToIndex,
  resolveActiveTab,
  resolveHomeTabs,
  setTabHidden,
  shiftTab,
} from './homeTabs';

describe('resolveHomeTabs', () => {
  it('returns the default config for missing or malformed input', () => {
    expect(resolveHomeTabs(undefined)).toEqual(DEFAULT_HOME_TABS);
    expect(resolveHomeTabs('nope')).toEqual(DEFAULT_HOME_TABS);
    expect(resolveHomeTabs({ order: 'x', hidden: 4 })).toEqual(DEFAULT_HOME_TABS);
  });

  it('drops unknown ids and duplicates, and appends tabs missing from the saved order', () => {
    const tabs = resolveHomeTabs({
      order: ['Overdue', 'bogus', 'Overdue', 'All'],
      hidden: ['bogus', 'Pinned', 'Pinned'],
    });
    expect(tabs.order).toEqual(['Overdue', 'All', 'Today', 'Upcoming', 'NoDueDate', 'Pinned']);
    expect(tabs.hidden).toEqual(['Pinned']);
  });

  it('never leaves every tab hidden', () => {
    const tabs = resolveHomeTabs({ order: ['Today'], hidden: [...DEFAULT_HOME_TABS.order] });
    expect(getVisibleTabs(tabs)).toEqual(['Today']);
  });
});

describe('tab editing', () => {
  it('hides a tab without losing its position, and shows it again', () => {
    const hidden = setTabHidden(DEFAULT_HOME_TABS, 'Overdue', true);
    expect(getVisibleTabs(hidden)).toEqual(['All', 'Today', 'Upcoming', 'NoDueDate', 'Pinned']);
    expect(hidden.order).toEqual(DEFAULT_HOME_TABS.order);
    expect(setTabHidden(hidden, 'Overdue', false)).toEqual(DEFAULT_HOME_TABS);
  });

  it('refuses to hide the last visible tab', () => {
    const onlyToday = {
      order: [...DEFAULT_HOME_TABS.order],
      hidden: DEFAULT_HOME_TABS.order.filter(id => id !== 'Today'),
    };
    expect(setTabHidden(onlyToday, 'Today', true)).toBe(onlyToday);
  });

  it('shifts a tab one step and stops at the ends', () => {
    const moved = shiftTab(DEFAULT_HOME_TABS, 'Today', -1);
    expect(moved.order.slice(0, 2)).toEqual(['Today', 'All']);
    expect(shiftTab(moved, 'Today', -1)).toBe(moved);
    expect(shiftTab(DEFAULT_HOME_TABS, 'Pinned', 1)).toBe(DEFAULT_HOME_TABS);
  });

  it('moves a tab to an index', () => {
    expect(moveTabToIndex(DEFAULT_HOME_TABS, 'Pinned', 0).order[0]).toBe('Pinned');
  });

  it('does not mutate the config it is given', () => {
    const snapshot = JSON.stringify(DEFAULT_HOME_TABS);
    moveTabToIndex(DEFAULT_HOME_TABS, 'Pinned', 0);
    setTabHidden(DEFAULT_HOME_TABS, 'Today', true);
    expect(JSON.stringify(DEFAULT_HOME_TABS)).toBe(snapshot);
    expect(isDefaultHomeTabs(DEFAULT_HOME_TABS)).toBe(true);
  });
});

describe('resolveActiveTab', () => {
  it('keeps a visible tab and falls back to the first visible one otherwise', () => {
    const tabs = setTabHidden(DEFAULT_HOME_TABS, 'All', true);
    expect(resolveActiveTab(tabs, 'Overdue')).toBe('Overdue');
    expect(resolveActiveTab(tabs, 'All')).toBe('Today');
    expect(resolveActiveTab(tabs, 'garbage')).toBe('Today');
  });
});
