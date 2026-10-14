// Pure model for the toggle items of the "Continue where you left off" widget (Projects, Tasks,
// Activity, Time Logged): which of them are shown. No React, no storage — same shape of API as
// homeTabs.ts, which does the same for the tabs above the task table.

export type HomeContinueTab = 'projects' | 'tasks' | 'activity' | 'time';

export const HOME_CONTINUE_TABS: readonly HomeContinueTab[] = ['projects', 'tasks', 'activity', 'time'];

export interface HomeContinueTabsConfig {
  hidden: HomeContinueTab[];
}

export const DEFAULT_HOME_CONTINUE_TABS: HomeContinueTabsConfig = { hidden: [] };

export const isHomeContinueTab = (value: unknown): value is HomeContinueTab =>
  typeof value === 'string' && (HOME_CONTINUE_TABS as readonly string[]).includes(value);

/**
 * Merges a saved config (untrusted: parsed from storage) with the known items.
 * - unknown ids and duplicates are dropped
 * - at least one item always stays visible
 */
export const resolveHomeContinueTabs = (saved: unknown): HomeContinueTabsConfig => {
  const raw = (saved && typeof saved === 'object' ? saved : {}) as { hidden?: unknown };
  const hidden = Array.isArray(raw.hidden)
    ? Array.from(new Set((raw.hidden as unknown[]).filter(isHomeContinueTab)))
    : [];
  // Everything hidden can't have been saved on purpose: keep the first item showing.
  return { hidden: hidden.length >= HOME_CONTINUE_TABS.length ? hidden.filter(id => id !== HOME_CONTINUE_TABS[0]) : hidden };
};

/** The items to show, in their fixed order. */
export const getVisibleContinueTabs = (config: HomeContinueTabsConfig): HomeContinueTab[] =>
  HOME_CONTINUE_TABS.filter(id => !config.hidden.includes(id));

/** The item to show: `current` if it is visible, otherwise the first visible one. */
export const resolveActiveContinueTab = (config: HomeContinueTabsConfig, current: unknown): HomeContinueTab => {
  const visible = getVisibleContinueTabs(config);
  return isHomeContinueTab(current) && visible.includes(current) ? current : visible[0];
};

/** Hides or shows an item. Refuses to hide the last visible one. */
export const setContinueTabHidden = (
  config: HomeContinueTabsConfig,
  id: HomeContinueTab,
  hidden: boolean
): HomeContinueTabsConfig => {
  if (config.hidden.includes(id) === hidden) return config;
  if (hidden && getVisibleContinueTabs(config).length <= 1) return config;
  return { hidden: hidden ? [...config.hidden, id] : config.hidden.filter(h => h !== id) };
};

export const isDefaultHomeContinueTabs = (config: HomeContinueTabsConfig): boolean => config.hidden.length === 0;
