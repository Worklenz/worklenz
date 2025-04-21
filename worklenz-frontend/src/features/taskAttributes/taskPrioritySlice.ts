import { priorityApiService } from '@/api/taskAttributes/priority/priority.api.service';
import { ITaskPrioritiesGetResponse, ITaskPriority } from '@/types/tasks/taskPriority.types';
import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import logger from '@utils/errorLogger';

interface ITaskPriorityState {
  priorities: ITaskPrioritiesGetResponse[];
  selectedPriority: ITaskPriority | null;
  loading: boolean;
  error: string | null;
  initialized: boolean;
}

const initialState: ITaskPriorityState = {
  priorities: [],
  selectedPriority: null,
  loading: false,
  error: null,
  initialized: false,
};

// Create async thunk for fetching priorities
export const fetchPriorities = createAsyncThunk(
  'taskPriority/fetchPriorities',
  async (_, { rejectWithValue }) => {
    try {
      const response = await priorityApiService.getPriorities();
      return response.body;
    } catch (error) {
      logger.error('Fetch Priorities', error);
      if (error instanceof Error) {
        return rejectWithValue(error.message);
      }
      return rejectWithValue('Failed to fetch priorities');
    }
  }
);

// Create async thunk for fetching priority by ID
export const fetchPriorityById = createAsyncThunk(
  'taskPriority/fetchPriorityById',
  async (priorityId: string, { rejectWithValue }) => {
    try {
      const response = await priorityApiService.getPriorityById(priorityId);
      return response.body;
    } catch (error) {
      logger.error('Fetch Priority By Id', error);
      if (error instanceof Error) {
        return rejectWithValue(error.message);
      }
      return rejectWithValue('Failed to fetch priority');
    }
  }
);

// Initialization thunk
export const initializePriorities = createAsyncThunk(
  'taskPriority/initialize',
  async (_, { dispatch, getState }) => {
    const state = getState() as { taskPriorityReducer: ITaskPriorityState };
    if (!state.taskPriorityReducer.initialized) {
      await dispatch(fetchPriorities());
    }
  }
);

const taskPrioritySlice = createSlice({
  name: 'taskPriorityReducer',
  initialState,
  reducers: {},
  extraReducers: builder => {
    builder
      .addCase(fetchPriorities.pending, state => {
        state.loading = true;
        state.error = null;
      })
      .addCase(
        fetchPriorities.fulfilled,
        (state, action: PayloadAction<ITaskPrioritiesGetResponse[]>) => {
          state.loading = false;
          state.priorities = action.payload;
          state.initialized = true;
        }
      )
      .addCase(fetchPriorities.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Fetch Priority By Id
      .addCase(fetchPriorityById.pending, state => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchPriorityById.fulfilled, (state, action: PayloadAction<ITaskPriority>) => {
        state.loading = false;
        state.selectedPriority = action.payload;
      })
      .addCase(fetchPriorityById.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export default taskPrioritySlice.reducer;
