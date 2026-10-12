import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export type RequestsState = {
  selectedRequestNo: string | null;
  // Filter and Pagination State (for UI controls) — mirrors clients-slice.ts so the two lists
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

const initialState: RequestsState = {
  selectedRequestNo: null,
  filters: {
    search: '',
    status: 'all',
    sortBy: 'created_at',
    sortOrder: 'desc',
  },
  pagination: {
    page: 1,
    limit: 10,
  },
};

const requestsSlice = createSlice({
  name: 'requestsReducer',
  initialState,
  reducers: {
    setSelectedRequestNo: (state, action: PayloadAction<string | null>) => {
      state.selectedRequestNo = action.payload;
    },

    // Filter and Pagination Actions
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
        sortBy: 'created_at',
        sortOrder: 'desc',
      };
      state.pagination.page = 1;
    },
  },
});

export const {
  setSelectedRequestNo,
  setSearchFilter,
  setStatusFilter,
  setSortBy,
  setSortOrder,
  setPage,
  setLimit,
  clearFilters,
} = requestsSlice.actions;
export default requestsSlice.reducer;
