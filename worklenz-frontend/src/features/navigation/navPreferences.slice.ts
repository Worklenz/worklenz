import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { getJSONFromLocalStorage, saveJSONToLocalStorage } from '@/utils/localStorageFunctions';
import type { SurfaceKey } from './nav-registry.types';

// Personal preferences only — never shared between users, never affects what
// items exist (that's nav-registry.tsx). No generic per-user preferences
// backend exists yet in worklenz-backend, so this persists to localStorage
// for now (same v1 approach as themeSlice.ts and PinRouteToNavbarButton's
// localStorage['navRoutes']) — device/browser-scoped, not cross-device.
const LOCAL_STORAGE_KEY = 'worklenz.navPreferences';

/**
 * An unsaved edit of one surface's order and default page, shown live while a customize dialog is
 * open. It is never written to localStorage: it is either committed (becoming the saved order and
 * pin) or cleared (rolling the surface back to what was saved).
 */
export interface NavPreview {
  surfaceKey: SurfaceKey;
  /** groupKey -> ordered item keys, same shape as one surface's entry in `order`. */
  groupOrder: Record<string, string[]>;
  /** null = no pinned default page. */
  pinnedDefault: string | null;
  /** Item keys hidden from the surface. */
  hiddenItems: string[];
}

export interface NavPreferencesState {
  // One flag shared by every rail — expanding/collapsing on any page expands/
  // collapses all of them, rather than remembering a state per surface.
  collapsed: boolean;
  // True once the user has explicitly toggled collapse at least once. Until
  // then, useNavPreferences applies a responsive default (collapsed on
  // mobile/tablet, expanded on desktop) instead of this stored `collapsed`
  // value — see useNavPreferences.ts.
  collapsedIsUserSet: boolean;
  pinnedDefaults: Partial<Record<SurfaceKey, string>>;
  // surfaceKey -> groupKey -> ordered item keys. groupKey '' is the default,
  // ungrouped bucket every surface but Reporting uses today.
  order: Partial<Record<SurfaceKey, Record<string, string[]>>>;
  // surfaceKey -> the ORDER_VERSIONS value this user's saved order was last reset at.
  orderVersions?: Partial<Record<SurfaceKey, number>>;
  // surfaceKey -> item keys the user has hidden from that rail. Only the Home customize dialog
  // sets this today.
  hidden?: Partial<Record<SurfaceKey, string[]>>;
  // Transient — see NavPreview. Stripped before saving.
  preview?: NavPreview | null;
}

/** The preferences to render with: the saved ones, with any live preview laid over them. */
export const applyNavPreview = (
  prefs: NavPreferencesState,
  surfaceKey: SurfaceKey
): NavPreferencesState => {
  const preview = prefs.preview;
  if (!preview || preview.surfaceKey !== surfaceKey) return prefs;
  const pinnedDefaults = { ...prefs.pinnedDefaults };
  if (preview.pinnedDefault) pinnedDefaults[surfaceKey] = preview.pinnedDefault;
  else delete pinnedDefaults[surfaceKey];
  return {
    ...prefs,
    order: { ...prefs.order, [surfaceKey]: preview.groupOrder },
    pinnedDefaults,
    hidden: { ...prefs.hidden, [surfaceKey]: preview.hiddenItems },
  };
};

// A saved order always wins over the registry's default order, so changing a surface's default
// order would never reach anyone who had dragged its items once. Bumping a surface's version
// here discards that surface's saved order once per browser, so the new default shows; items
// reordered after that are saved as usual. Bump only when the default order itself changes.
const ORDER_VERSIONS: Partial<Record<SurfaceKey, number>> = {
  // v1: Clients, Requests, Services, Quotes, Invoices, Chats, Ticketing, ... Portal Settings
  // v2: Clients, Projects, Approvals, Change Req., Discussions, Quotes, Invoices, Audit Log, Portal Settings, Client Portal
  // v3: Overview, Clients, Projects, ... (Overview added as the landing page)
  'client-portal': 3,
  // v1: Adds Reporting & Analytics group under Time Reports
  reporting: 1,
};

/** Drops the saved order of any surface whose default order was changed since it was saved. */
export const applyOrderResets = (state: NavPreferencesState): { state: NavPreferencesState; changed: boolean } => {
  let changed = false;
  const order = { ...state.order };
  const orderVersions = { ...state.orderVersions };

  for (const [surfaceKey, version] of Object.entries(ORDER_VERSIONS) as [SurfaceKey, number][]) {
    if ((orderVersions[surfaceKey] ?? 0) >= version) continue;
    delete order[surfaceKey];
    orderVersions[surfaceKey] = version;
    changed = true;
  }

  return { state: changed ? { ...state, order, orderVersions } : state, changed };
};

const EMPTY_STATE: NavPreferencesState = {
  collapsed: false,
  collapsedIsUserSet: false,
  pinnedDefaults: {},
  order: {},
  orderVersions: {},
  hidden: {},
  preview: null,
};

const loadFromLocalStorage = (): NavPreferencesState => {
  try {
    const stored = getJSONFromLocalStorage(LOCAL_STORAGE_KEY);
    if (stored && typeof stored === 'object') {
      // Older saved state stored `collapsed` per-surface as an object —
      // fall back to the default rather than treating that object as truthy.
      const hasLegacyCollapsed = typeof stored.collapsed === 'boolean';
      return {
        ...EMPTY_STATE,
        ...stored,
        collapsed: hasLegacyCollapsed ? stored.collapsed : false,
        // State saved before `collapsedIsUserSet` existed has no such key,
        // but a stored `collapsed` boolean could only have been written by
        // the old toggleCollapsed reducer — i.e. a real explicit toggle.
        // Treat that as user-set so we don't silently discard it in favor of
        // the new responsive default; only a genuinely fresh user (no stored
        // `collapsed` at all) should get `collapsedIsUserSet: false`.
        collapsedIsUserSet:
          typeof stored.collapsedIsUserSet === 'boolean'
            ? stored.collapsedIsUserSet
            : hasLegacyCollapsed,
      };
    }
  } catch (error) {
    console.warn('Failed to load nav preferences from localStorage:', error);
  }
  return { ...EMPTY_STATE };
};

const saveToLocalStorage = (state: NavPreferencesState): void => {
  try {
    const { preview: _preview, ...persisted } = state;
    saveJSONToLocalStorage(LOCAL_STORAGE_KEY, persisted);
  } catch (error) {
    console.warn('Failed to save nav preferences to localStorage:', error);
  }
};

const loaded = applyOrderResets(loadFromLocalStorage());
if (loaded.changed) saveToLocalStorage(loaded.state);
const initialState: NavPreferencesState = { ...loaded.state, preview: null };

const navPreferencesSlice = createSlice({
  name: 'navPreferencesReducer',
  initialState,
  reducers: {
    // Takes the target value explicitly rather than blindly flipping the
    // stored `collapsed` — useNavPreferences derives an effective collapsed
    // value (see `collapsedIsUserSet`) that can differ from this raw stored
    // one, so toggling must flip *that* displayed value, not this one.
    setCollapsed: (state, action: PayloadAction<boolean>) => {
      state.collapsed = action.payload;
      state.collapsedIsUserSet = true;
      saveToLocalStorage(state);
    },
    // Toggles the collapsed state by inverting the current value.
    toggleCollapsed: (state) => {
      state.collapsed = !state.collapsed;
      state.collapsedIsUserSet = true;
      saveToLocalStorage(state);
    },
    setPinnedDefault: (state, action: PayloadAction<{ surfaceKey: SurfaceKey; itemKey: string }>) => {
      const { surfaceKey, itemKey } = action.payload;
      state.pinnedDefaults[surfaceKey] = itemKey;
      saveToLocalStorage(state);
    },
    clearPinnedDefault: (state, action: PayloadAction<SurfaceKey>) => {
      delete state.pinnedDefaults[action.payload];
      saveToLocalStorage(state);
    },
    setGroupOrder: (
      state,
      action: PayloadAction<{ surfaceKey: SurfaceKey; groupKey: string; order: string[] }>
    ) => {
      const { surfaceKey, groupKey, order } = action.payload;
      if (!state.order[surfaceKey]) state.order[surfaceKey] = {};
      state.order[surfaceKey]![groupKey] = order;
      saveToLocalStorage(state);
    },
    setNavPreview: (state, action: PayloadAction<NavPreview>) => {
      state.preview = action.payload;
    },
    clearNavPreview: state => {
      state.preview = null;
    },
    commitNavPreview: state => {
      const preview = state.preview;
      if (!preview) return;
      state.order[preview.surfaceKey] = preview.groupOrder;
      if (preview.pinnedDefault) state.pinnedDefaults[preview.surfaceKey] = preview.pinnedDefault;
      else delete state.pinnedDefaults[preview.surfaceKey];
      if (!state.hidden) state.hidden = {};
      if (preview.hiddenItems.length > 0) state.hidden[preview.surfaceKey] = preview.hiddenItems;
      else delete state.hidden[preview.surfaceKey];
      state.preview = null;
      saveToLocalStorage(state);
    },
  },
});

export const {
  setCollapsed,
  toggleCollapsed,
  setPinnedDefault,
  clearPinnedDefault,
  setGroupOrder,
  setNavPreview,
  clearNavPreview,
  commitNavPreview,
} = navPreferencesSlice.actions;
export default navPreferencesSlice.reducer;
