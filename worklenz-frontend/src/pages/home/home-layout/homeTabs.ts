// Pure model for the tabs above the Task priorities table (Recent, Today, Overdue, ...): which ones
// are shown and in what order. No React, no storage — same shape of API as homeLayout.ts.

export type HomePriorityTab = 'All' | 'Today' | 'Overdue' | 'Upcoming' | 'NoDueDate' | 'Pinned';

export const HOME_PRIORITY_TABS: readonly HomePriorityTab[] = [
  'All',
  'Today',
  'Overdue',
  'Upcoming',
  'NoDueDate',
  'Pinned',
];

export interface HomeTabDefinition {
  id: HomePriorityTab;
  labelKey: string;
  labelDefault: string;
}

export const HOME_TAB_DEFINITIONS: readonly HomeTabDefinition[] = [
  { id: 'All', labelKey: 'projects.recent', labelDefault: 'Recent' },
  { id: 'Today', labelKey: 'homeCalendar.todayButton', labelDefault: 'Today' },
  { id: 'Overdue', labelKey: 'tasks.overdue', labelDefault: 'Overdue' },
  { id: 'Upcoming', labelKey: 'tasks.upcoming', labelDefault: 'Upcoming' },
  { id: 'NoDueDate', labelKey: 'tasks.noDueDate', labelDefault: 'No Due Date' },
  { id: 'Pinned', labelKey: 'tasks.pinned', labelDefault: 'Pinned' },
];

export const getHomeTabDefinition = (id: HomePriorityTab): HomeTabDefinition => {
  const definition = HOME_TAB_DEFINITIONS.find(tab => tab.id === id);
  if (!definition) throw new Error(`Unknown home tab: ${id}`);
  return definition;
};

export const isHomePriorityTab = (value: unknown): value is HomePriorityTab =>
  typeof value === 'string' && (HOME_PRIORITY_TABS as readonly string[]).includes(value);

export interface HomeTabsConfig {
  /** Every known tab appears exactly once; hidden ones keep their position. */
  order: HomePriorityTab[];
  hidden: HomePriorityTab[];
}

export const DEFAULT_HOME_TABS: HomeTabsConfig = {
  order: [...HOME_PRIORITY_TABS],
  hidden: [],
};

const unique = <T>(values: T[]): T[] => Array.from(new Set(values));

/**
 * Merges a saved tab config (untrusted: parsed from storage) with the known tabs.
 * - unknown ids and duplicates are dropped
 * - a tab added since the config was saved is appended
 * - at least one tab always stays visible
 */
export const resolveHomeTabs = (saved: unknown): HomeTabsConfig => {
  const raw = (saved && typeof saved === 'object' ? saved : {}) as {
    order?: unknown;
    hidden?: unknown;
  };
  const savedOrder = Array.isArray(raw.order) ? (raw.order as unknown[]).filter(isHomePriorityTab) : [];
  const order = unique([...savedOrder, ...HOME_PRIORITY_TABS]);

  const savedHidden = Array.isArray(raw.hidden)
    ? unique((raw.hidden as unknown[]).filter(isHomePriorityTab))
    : [];
  const hidden = savedHidden.length >= order.length ? savedHidden.filter(id => id !== order[0]) : savedHidden;

  return { order, hidden };
};

export const getVisibleTabs = (config: HomeTabsConfig): HomePriorityTab[] =>
  config.order.filter(id => !config.hidden.includes(id));

/** The tab to show: `current` if it is visible, otherwise the first visible tab. */
export const resolveActiveTab = (config: HomeTabsConfig, current: unknown): HomePriorityTab => {
  const visible = getVisibleTabs(config);
  return isHomePriorityTab(current) && visible.includes(current) ? current : visible[0];
};

/** Hides or shows a tab. Refuses to hide the last visible one. */
export const setTabHidden = (
  config: HomeTabsConfig,
  id: HomePriorityTab,
  hidden: boolean
): HomeTabsConfig => {
  const isHidden = config.hidden.includes(id);
  if (isHidden === hidden) return config;
  if (hidden && getVisibleTabs(config).length <= 1) return config;
  return {
    order: [...config.order],
    hidden: hidden ? [...config.hidden, id] : config.hidden.filter(h => h !== id),
  };
};

export const moveTabToIndex = (
  config: HomeTabsConfig,
  id: HomePriorityTab,
  index: number
): HomeTabsConfig => {
  const from = config.order.indexOf(id);
  if (from === -1) return config;
  const order = config.order.filter(tab => tab !== id);
  order.splice(Math.max(0, Math.min(index, order.length)), 0, id);
  return { order, hidden: [...config.hidden] };
};

/** Shifts a tab one step earlier (-1) or later (+1) in the order. */
export const shiftTab = (config: HomeTabsConfig, id: HomePriorityTab, delta: -1 | 1): HomeTabsConfig => {
  const target = config.order.indexOf(id) + delta;
  if (target < 0 || target >= config.order.length) return config;
  return moveTabToIndex(config, id, target);
};

export const isDefaultHomeTabs = (config: HomeTabsConfig): boolean =>
  JSON.stringify(config) === JSON.stringify(DEFAULT_HOME_TABS);
