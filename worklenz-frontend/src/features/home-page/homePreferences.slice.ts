import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import {
  DEFAULT_HOME_LAYOUT,
  HomeLayout,
  resolveHomeLayout,
} from '@/pages/home/home-layout/homeLayout';
import {
  DEFAULT_HOME_TABS,
  HOME_PRIORITY_TABS,
  HomePriorityTab,
  HomeTabsConfig,
  resolveHomeTabs,
} from '@/pages/home/home-layout/homeTabs';
import {
  DEFAULT_HOME_CONTINUE_TABS,
  HomeContinueTabsConfig,
  resolveHomeContinueTabs,
} from '@/pages/home/home-layout/homeContinueTabs';

// Personal Home-page preferences: widget layout, which priority tabs are shown and in what order,
// which toggle items the Continue widget shows, plus the last-used selections (period, assigned
// toggle, active tab, sort). Always the current user's own — never shared.
//
// The server (GET/PUT /home/preferences) holds the real copy; localStorage is a first-paint cache
// (see homePreferencesStorage.ts). The sync between them lives in useHomePreferencesSync.

export const HOME_PREFERENCES_VERSION = 1;

export type HomePeriod = 'today' | 'week';
export type { HomePriorityTab };
export { HOME_PRIORITY_TABS };
export type HomeSortField = 'name' | 'project_name' | 'end_date' | 'priority' | 'status';
export type HomeSortOrder = 'asc' | 'desc';
export type HomeAssignedGroup = 0 | 1;

export const HOME_SORT_FIELDS: readonly HomeSortField[] = [
  'name',
  'project_name',
  'end_date',
  'priority',
  'status',
];

export interface HomeSort {
  field: HomeSortField;
  order: HomeSortOrder;
}

export interface HomeSelections {
  period: HomePeriod;
  /** The group the table was last on. Used to reopen it unless a default is pinned. */
  assignedGroup: HomeAssignedGroup;
  /** The group the table always opens on, whatever it was last on; null = reopen the last one. */
  pinnedAssignedGroup: HomeAssignedGroup | null;
  priorityTab: HomePriorityTab;
  /** null = the default order (due date, soonest first). */
  sort: HomeSort | null;
}

export interface HomePreferences {
  version: number;
  layout: HomeLayout;
  tabs: HomeTabsConfig;
  continueTabs: HomeContinueTabsConfig;
  selections: HomeSelections;
}

export const DEFAULT_HOME_SELECTIONS: HomeSelections = {
  period: 'week',
  assignedGroup: 0,
  pinnedAssignedGroup: null,
  priorityTab: 'All',
  sort: null,
};

/** The assigned-to-me/by-me group the table should open on. */
export const resolveInitialAssignedGroup = (selections: HomeSelections): HomeAssignedGroup =>
  selections.pinnedAssignedGroup ?? selections.assignedGroup;

export const DEFAULT_HOME_PREFERENCES: HomePreferences = {
  version: HOME_PREFERENCES_VERSION,
  layout: DEFAULT_HOME_LAYOUT,
  tabs: DEFAULT_HOME_TABS,
  continueTabs: DEFAULT_HOME_CONTINUE_TABS,
  selections: DEFAULT_HOME_SELECTIONS,
};

const isOneOf = <T extends string>(values: readonly T[], value: unknown): value is T =>
  typeof value === 'string' && (values as readonly string[]).includes(value);

/** Validates untrusted stored JSON field by field, falling back to defaults for anything invalid. */
export const sanitizeHomePreferences = (raw: unknown): HomePreferences => {
  const doc = (raw && typeof raw === 'object' ? raw : {}) as {
    layout?: unknown;
    tabs?: unknown;
    continueTabs?: unknown;
    selections?: Partial<Record<keyof HomeSelections, unknown>>;
  };
  const sel = doc.selections ?? {};
  const sort = sel.sort as Partial<HomeSort> | null | undefined;

  return {
    version: HOME_PREFERENCES_VERSION,
    layout: resolveHomeLayout(doc.layout),
    tabs: resolveHomeTabs(doc.tabs),
    continueTabs: resolveHomeContinueTabs(doc.continueTabs),
    selections: {
      period: sel.period === 'today' ? 'today' : 'week',
      assignedGroup: sel.assignedGroup === 1 ? 1 : 0,
      pinnedAssignedGroup: sel.pinnedAssignedGroup === 0 || sel.pinnedAssignedGroup === 1 ? sel.pinnedAssignedGroup : null,
      priorityTab: isOneOf(HOME_PRIORITY_TABS, sel.priorityTab) ? sel.priorityTab : 'All',
      sort:
        sort && isOneOf(HOME_SORT_FIELDS, sort.field)
          ? { field: sort.field, order: sort.order === 'desc' ? 'desc' : 'asc' }
          : null,
    },
  };
};

/**
 * The settings the Customize dialog edits. While the dialog is open its draft is held here as a
 * preview so the page shows it live; the preview is never persisted and is either committed (it
 * becomes the saved settings) or cleared (the page rolls back to what was saved).
 */
export interface HomeCustomization {
  layout: HomeLayout;
  tabs: HomeTabsConfig;
  sort: HomeSort | null;
  /** The assigned-to-me/by-me group the table opens on; null = the one last used. */
  assignedDefault: HomeAssignedGroup | null;
}

export interface HomePreferencesState {
  layout: HomeLayout;
  tabs: HomeTabsConfig;
  continueTabs: HomeContinueTabsConfig;
  selections: HomeSelections;
  preview: HomeCustomization | null;
  /** False until the stored preferences have been loaded, so the page never flashes the defaults. */
  isHydrated: boolean;
}

const initialState: HomePreferencesState = {
  layout: DEFAULT_HOME_LAYOUT,
  tabs: DEFAULT_HOME_TABS,
  continueTabs: DEFAULT_HOME_CONTINUE_TABS,
  selections: DEFAULT_HOME_SELECTIONS,
  preview: null,
  isHydrated: false,
};

const homePreferencesSlice = createSlice({
  name: 'homePreferences',
  initialState,
  reducers: {
    hydrateHomePreferences: (state, action: PayloadAction<HomePreferences>) => {
      state.layout = action.payload.layout;
      state.tabs = action.payload.tabs;
      state.continueTabs = action.payload.continueTabs;
      state.selections = action.payload.selections;
      state.isHydrated = true;
    },
    setHomeLayout: (state, action: PayloadAction<HomeLayout>) => {
      state.layout = action.payload;
    },
    setHomeTabs: (state, action: PayloadAction<HomeTabsConfig>) => {
      state.tabs = action.payload;
    },
    setHomeContinueTabs: (state, action: PayloadAction<HomeContinueTabsConfig>) => {
      state.continueTabs = action.payload;
    },
    setHomePreview: (state, action: PayloadAction<HomeCustomization>) => {
      state.preview = action.payload;
    },
    clearHomePreview: state => {
      state.preview = null;
    },
    commitHomePreview: state => {
      if (!state.preview) return;
      state.layout = state.preview.layout;
      state.tabs = state.preview.tabs;
      state.selections.sort = state.preview.sort;
      state.selections.pinnedAssignedGroup = state.preview.assignedDefault;
      state.preview = null;
    },
    setHomeSelections: (state, action: PayloadAction<Partial<HomeSelections>>) => {
      state.selections = { ...state.selections, ...action.payload };
    },
  },
});

export const {
  hydrateHomePreferences,
  setHomeLayout,
  setHomeTabs,
  setHomeContinueTabs,
  setHomeSelections,
  setHomePreview,
  clearHomePreview,
  commitHomePreview,
} = homePreferencesSlice.actions;

// What the page should render: the dialog's live preview when one is open, the saved value otherwise.
// Anything that persists must read the saved values from the state directly instead.
type WithHomePreferences = { homePreferencesReducer: HomePreferencesState };
export const selectHomeLayout = (state: WithHomePreferences) =>
  state.homePreferencesReducer.preview?.layout ?? state.homePreferencesReducer.layout;
export const selectHomeTabs = (state: WithHomePreferences) =>
  state.homePreferencesReducer.preview?.tabs ?? state.homePreferencesReducer.tabs;
export const selectHomeSort = (state: WithHomePreferences) => {
  const { preview, selections } = state.homePreferencesReducer;
  return preview ? preview.sort : selections.sort;
};
export default homePreferencesSlice.reducer;
