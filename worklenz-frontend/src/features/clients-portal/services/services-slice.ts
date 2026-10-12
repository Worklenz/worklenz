import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export type ServicesState = {
  // Filter and Pagination State (for UI controls) — mirrors requests-slice.ts so the two lists
  // behave identically.
  filters: {
    search: string;
    status: string;
    sortBy: string;
    sortOrder: 'asc' | 'desc';
  };
  pagination: {
    page: number;
    limit: number;
  };
};

const initialState: ServicesState = {
  filters: {
    search: '',
    status: 'all',
    sortBy: 'name',
    sortOrder: 'asc',
  },
  pagination: {
    page: 1,
    limit: 10,
  },
};

const servicesSlice = createSlice({
  name: 'servicesReducer',
  initialState,
  reducers: {
    setSearchFilter: (state, action: PayloadAction<string>) => {
      state.filters.search = action.payload;
      state.pagination.page = 1;
    },
    setStatusFilter: (state, action: PayloadAction<string>) => {
      state.filters.status = action.payload;
      state.pagination.page = 1;
    },
    setSortBy: (state, action: PayloadAction<string>) => {
      state.filters.sortBy = action.payload;
    },
    setSortOrder: (state, action: PayloadAction<'asc' | 'desc'>) => {
      state.filters.sortOrder = action.payload;
    },
    setPage: (state, action: PayloadAction<number>) => {
      state.pagination.page = action.payload;
    },
    setLimit: (state, action: PayloadAction<number>) => {
      state.pagination.limit = action.payload;
      state.pagination.page = 1;
    },
    clearFilters: state => {
      state.filters = {
        search: '',
        status: 'all',
        sortBy: 'name',
        sortOrder: 'asc',
      };
      state.pagination.page = 1;
    },
  },
});

export const {
  setSearchFilter,
  setStatusFilter,
  setSortBy,
  setSortOrder,
  setPage,
  setLimit,
  clearFilters,
} = servicesSlice.actions;
export default servicesSlice.reducer;
