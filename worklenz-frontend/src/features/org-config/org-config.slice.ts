import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import { orgConfigurationApiService } from '@/api/settings/org-configuration/org-configuration.api.service';

export interface IOrgConfig {
  restrict_task_creation: boolean;
}

interface OrgConfigState extends IOrgConfig {
  isLoading: boolean;
  error: string | null;
}

const initialState: OrgConfigState = {
  restrict_task_creation: false,
  isLoading: false,
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
        state.restrict_task_creation = action.payload.restrict_task_creation;
      })
      .addCase(fetchOrgConfig.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      .addCase(updateOrgConfig.fulfilled, (state, action) => {
        state.restrict_task_creation = action.payload.restrict_task_creation;
      });
  },
});

export const { setOrgConfig } = orgConfigSlice.actions;
export default orgConfigSlice.reducer;
