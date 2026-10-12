import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export type SoftwareQuickFilter = 'mine' | 'bugs' | 'blocked';

interface SoftwareQuickFiltersState {
  active: SoftwareQuickFilter[];
}

const initialState: SoftwareQuickFiltersState = {
  active: [],
};

const softwareQuickFiltersSlice = createSlice({
  name: 'softwareQuickFiltersReducer',
  initialState,
  reducers: {
    toggleSoftwareQuickFilter: (state, action: PayloadAction<SoftwareQuickFilter>) => {
      state.active = state.active.includes(action.payload)
        ? state.active.filter(filter => filter !== action.payload)
        : [...state.active, action.payload];
    },
    resetSoftwareQuickFilters: () => initialState,
  },
});

/** Serialises active quick filters for the `quick_filters` task list query param. */
export const toQuickFiltersParam = (active: SoftwareQuickFilter[]) => active.join(' ');

export const { toggleSoftwareQuickFilter, resetSoftwareQuickFilters } =
  softwareQuickFiltersSlice.actions;
export default softwareQuickFiltersSlice.reducer;
