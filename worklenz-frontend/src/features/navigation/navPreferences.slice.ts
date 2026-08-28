import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { getJSONFromLocalStorage, saveJSONToLocalStorage } from '@/utils/localStorageFunctions';
import type { SurfaceKey } from './nav-registry.types';

// Personal preferences only — never shared between users, never affects what
// items exist (that's nav-registry.tsx). No generic per-user preferences
// backend exists yet in worklenz-backend, so this persists to localStorage
// for now (same v1 approach as themeSlice.ts and PinRouteToNavbarButton's
// localStorage['navRoutes']) — device/browser-scoped, not cross-device.
const LOCAL_STORAGE_KEY = 'worklenz.navPreferences';

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
}

const EMPTY_STATE: NavPreferencesState = {
  collapsed: false,
  collapsedIsUserSet: false,
  pinnedDefaults: {},
  order: {},
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
    saveJSONToLocalStorage(LOCAL_STORAGE_KEY, state);
  } catch (error) {
    console.warn('Failed to save nav preferences to localStorage:', error);
  }
};

const initialState: NavPreferencesState = loadFromLocalStorage();

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
  },
});

export const { setCollapsed, setPinnedDefault, clearPinnedDefault, setGroupOrder } =
  navPreferencesSlice.actions;
export default navPreferencesSlice.reducer;
