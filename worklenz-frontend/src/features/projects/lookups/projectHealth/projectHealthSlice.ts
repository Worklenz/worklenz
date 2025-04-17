import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import logger from '@/utils/errorLogger';
import { IProjectHealth } from '@/types/project/projectHealth.types';
import { projectHealthApiService } from '@/api/projects/lookups/projectHealth.api.service';

type ProjectHealthState = {
  initialized: boolean;
  projectHealths: IProjectHealth[];
  loading: boolean;
};

// Async thunk
export const fetchProjectHealth = createAsyncThunk(
  'projectHealth/fetchAll',
  async (_, { rejectWithValue }) => {
    try {
      const response = await projectHealthApiService.getHealthOptions();
      return response.body;
    } catch (error) {
      logger.error('Fetch Project Health Options', error);
      if (error instanceof Error) {
        return rejectWithValue(error.message);
      }
      return rejectWithValue('Failed to fetch project statuses');
    }
  }
);

const initialState: ProjectHealthState = {
  projectHealths: [],
  initialized: false,
  loading: false,
};

const projectHealthSlice = createSlice({
  name: 'projectHealth',
  initialState,
  reducers: {},
  extraReducers: builder => {
    builder
      .addCase(fetchProjectHealth.pending, state => {
        state.loading = true;
      })
      .addCase(fetchProjectHealth.fulfilled, (state, action) => {
        state.projectHealths = action.payload;
        state.loading = false;
        state.initialized = true;
      })
      .addCase(fetchProjectHealth.rejected, state => {
        state.loading = false;
      });
  },
});

export default projectHealthSlice.reducer;
