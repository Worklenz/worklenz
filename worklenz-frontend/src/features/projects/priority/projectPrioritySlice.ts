import { projectPrioritiesApiService } from '@/api/projects/project-priorities.api.service';
import {
  IProjectPriority,
  IProjectPrioritiesGetResponse,
} from '@/types/project/projectPriority.types';
import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import logger from '@utils/errorLogger';

interface IProjectPriorityState {
  priorities: IProjectPrioritiesGetResponse[];
  selectedPriority: IProjectPriority | null;
  loading: boolean;
  error: string | null;
  initialized: boolean;
}

const initialState: IProjectPriorityState = {
  priorities: [],
  selectedPriority: null,
  loading: false,
  error: null,
  initialized: false,
};

export const fetchProjectPriorities = createAsyncThunk(
  'projectPriority/fetchPriorities',
  async (_, { rejectWithValue }) => {
    try {
      const response = await projectPrioritiesApiService.getPriorities();
      return response.body;
    } catch (error) {
      logger.error('Fetch Project Priorities', error);
      if (error instanceof Error) {
        return rejectWithValue(error.message);
      }
      return rejectWithValue('Failed to fetch project priorities');
    }
  }
);

export const fetchProjectPriorityById = createAsyncThunk(
  'projectPriority/fetchPriorityById',
  async (priorityId: string, { rejectWithValue }) => {
    try {
      const response = await projectPrioritiesApiService.getPriorityById(priorityId);
      return response.body;
    } catch (error) {
      logger.error('Fetch Project Priority By Id', error);
      if (error instanceof Error) {
        return rejectWithValue(error.message);
      }
      return rejectWithValue('Failed to fetch project priority');
    }
  }
);

export const initializeProjectPriorities = createAsyncThunk(
  'projectPriority/initialize',
  async (_, { dispatch, getState }) => {
    const state = getState() as { projectPriorityReducer: IProjectPriorityState };
    if (!state.projectPriorityReducer.initialized) {
      await dispatch(fetchProjectPriorities());
    }
  }
);

const projectPrioritySlice = createSlice({
  name: 'projectPriorityReducer',
  initialState,
  reducers: {},
  extraReducers: builder => {
    builder
      .addCase(fetchProjectPriorities.pending, state => {
        state.loading = true;
        state.error = null;
      })
      .addCase(
        fetchProjectPriorities.fulfilled,
        (state, action: PayloadAction<IProjectPrioritiesGetResponse[]>) => {
          state.loading = false;
          state.priorities = action.payload;
          state.initialized = true;
        }
      )
      .addCase(fetchProjectPriorities.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(fetchProjectPriorityById.pending, state => {
        state.loading = true;
        state.error = null;
      })
      .addCase(
        fetchProjectPriorityById.fulfilled,
        (state, action: PayloadAction<IProjectPriority>) => {
          state.loading = false;
          state.selectedPriority = action.payload;
        }
      )
      .addCase(fetchProjectPriorityById.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export default projectPrioritySlice.reducer;
