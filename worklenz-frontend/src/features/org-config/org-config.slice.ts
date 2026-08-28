import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import { orgConfigurationApiService } from '@/api/settings/org-configuration/org-configuration.api.service';

export interface IOrgConfig {
  restrict_task_creation: boolean;
  base_currency: string;
  /** How far back a manual time log may be dated. 0 means no limit. */
  timelog_backdate_limit_days: number;
}

interface OrgConfigState extends IOrgConfig {
  isLoading: boolean;
  /** True once a fetch has resolved, so consumers can avoid refetching per mount. */
  isInitialized: boolean;
  error: string | null;
}

const initialState: OrgConfigState = {
  restrict_task_creation: false,
  base_currency: 'USD',
  timelog_backdate_limit_days: 0,
  isLoading: false,
  isInitialized: false,
  error: null,
};

export const fetchOrgConfig = createAsyncThunk(
  'orgConfig/fetch',
  async (_, { rejectWithValue }) => {
    try {
      const res = await orgConfigurationApiService.getOrgConfiguration();
      return res.body as IOrgConfig;
    } catch (error: any) {
      return rejectWithValue(error?.message || 'Failed to fetch org configuration');
    }
  }
);

export const updateOrgConfig = createAsyncThunk(
  'orgConfig/update',
  async (config: Partial<IOrgConfig>, { rejectWithValue }) => {
    try {
      const res = await orgConfigurationApiService.updateOrgConfiguration(config);
      return res.body as IOrgConfig;
    } catch (error: any) {
      return rejectWithValue(error?.message || 'Failed to update org configuration');
    }
  }
);

const orgConfigSlice = createSlice({
  name: 'orgConfig',
  initialState,
  reducers: {
    setOrgConfig: (state, action: PayloadAction<IOrgConfig>) => {
      state.restrict_task_creation = action.payload.restrict_task_creation;
      state.base_currency = action.payload.base_currency || 'USD';
      state.timelog_backdate_limit_days = Number(action.payload.timelog_backdate_limit_days) || 0;
    },
  },
  extraReducers: builder => {
    builder
      .addCase(fetchOrgConfig.pending, state => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchOrgConfig.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isInitialized = true;
        state.restrict_task_creation = action.payload.restrict_task_creation;
        state.base_currency = action.payload.base_currency || 'USD';
        state.timelog_backdate_limit_days = Number(action.payload.timelog_backdate_limit_days) || 0;
      })
      .addCase(fetchOrgConfig.rejected, (state, action) => {
        state.isLoading = false;
        state.isInitialized = true;
        state.error = action.payload as string;
      })
      .addCase(updateOrgConfig.fulfilled, (state, action) => {
        state.restrict_task_creation = action.payload.restrict_task_creation;
        state.base_currency = action.payload.base_currency || 'USD';
        state.timelog_backdate_limit_days = Number(action.payload.timelog_backdate_limit_days) || 0;
      });
  },
});

export const { setOrgConfig } = orgConfigSlice.actions;
export default orgConfigSlice.reducer;
