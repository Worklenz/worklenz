import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { ICategorizedStatus, ITaskStatus } from '@/types/tasks/taskStatus.types';
import logger from '@utils/errorLogger';
import { statusApiService } from '@/api/taskAttributes/status/status.api.service';
import { ITaskStatusCategory } from '@/types/status.types';
import { ITaskStatusCreateRequest } from '@/types/tasks/task-status-create-request';

interface IStatusState {
  status: ITaskStatus[];
  statusCategories: ITaskStatusCategory[];
  loading: boolean;
  error: string | null;
  initialized: boolean;
}

const initialState: IStatusState = {
  status: [],
  statusCategories: [],
  loading: false,
  error: null,
  initialized: false,
};

// Create async thunk for fetching statuses
export const fetchStatuses = createAsyncThunk(
  'status/fetchStatuses',
  async (projectId: string, { rejectWithValue }) => {
    try {
      const response = await statusApiService.getStatuses(projectId);
      return response.body;
    } catch (error) {
      logger.error('Fetch Statuses', error);
      if (error instanceof Error) {
        return rejectWithValue(error.message);
      }
      return rejectWithValue('Failed to fetch statuses');
    }
  }
);

export const fetchStatusesCategories = createAsyncThunk(
  'status/fetchStatusesCategories',
  async (_, { rejectWithValue }) => {
    try {
      const response = await statusApiService.getStatusCategories();
      return response.body;
    } catch (error) {
      logger.error('Fetch Statuses Categories', error);
      if (error instanceof Error) {
        return rejectWithValue(error.message);
      }
      return rejectWithValue('Failed to fetch statuses categories');
    }
  }
);

export const createStatus = createAsyncThunk(
  'status/createStatus',
  async (
    { body, currentProjectId }: { body: ITaskStatusCreateRequest; currentProjectId: string },
    { rejectWithValue }
  ) => {
    return await statusApiService.createStatus(body, currentProjectId);
  }
);

const taskStatusSlice = createSlice({
  name: 'taskStatusReducer',
  initialState,
  reducers: {
    addStatus: (state, action: PayloadAction<ITaskStatus>) => {
      state.status.push(action.payload);
    },
    updateStatus: (state, action: PayloadAction<ITaskStatus>) => {
      const index = state.status.findIndex(status => status.id === action.payload.id);
      if (index !== -1) {
        state.status[index] = action.payload;
      }
    },
    deleteStatus: (state, action: PayloadAction<string>) => {
      state.status = state.status.filter(status => status.id !== action.payload);
    },
    setCategorizedStatuses: (state, action: PayloadAction<ITaskStatusCategory[]>) => {
      state.statusCategories = action.payload;
    },
    resetStatuses: state => {
      state.status = [];
      state.loading = false;
      state.error = null;
      state.initialized = false;
    },
  },
  extraReducers: builder => {
    builder
      .addCase(fetchStatuses.pending, state => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchStatuses.fulfilled, (state, action: PayloadAction<ITaskStatus[]>) => {
        state.loading = false;
        state.status = action.payload;
        state.initialized = true;
        state.error = null;
      })
      .addCase(fetchStatuses.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(fetchStatusesCategories.pending, state => {
        state.loading = true;
        state.error = null;
      })
      .addCase(
        fetchStatusesCategories.fulfilled,
        (state, action: PayloadAction<ITaskStatusCategory[]>) => {
          state.loading = false;
          state.statusCategories = action.payload;
          state.error = null;
        }
      )
      .addCase(fetchStatusesCategories.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export const { addStatus, updateStatus, deleteStatus, setCategorizedStatuses, resetStatuses } =
  taskStatusSlice.actions;
export default taskStatusSlice.reducer;
