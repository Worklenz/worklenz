import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import {
  financeOverviewApiService,
  IFinanceOverviewProject,
} from '@/api/finance-overview/finance-overview.api.service';

interface FinanceOverviewState {
  loading: boolean;
  projects: IFinanceOverviewProject[];
  error: string | null;
}

const initialState: FinanceOverviewState = {
  loading: false,
  projects: [],
  error: null,
};

export const fetchFinanceOverview = createAsyncThunk(
  'financeOverview/fetch',
  async (_, { rejectWithValue }) => {
    try {
      const res = await financeOverviewApiService.getPortfolioFinance();
      return res.body?.projects ?? [];
    } catch (err: any) {
      return rejectWithValue(err.message ?? 'Failed to load finance overview');
    }
  }
);

const financeOverviewSlice = createSlice({
  name: 'financeOverview',
  initialState,
  reducers: {},
  extraReducers: builder => {
    builder
      .addCase(fetchFinanceOverview.pending, state => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchFinanceOverview.fulfilled, (state, action) => {
        state.loading = false;
        state.projects = action.payload;
      })
      .addCase(fetchFinanceOverview.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export default financeOverviewSlice.reducer;
