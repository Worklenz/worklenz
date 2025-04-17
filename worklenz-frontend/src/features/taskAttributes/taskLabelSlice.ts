import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { ITaskLabel } from '@/types/tasks/taskLabel.types';
import logger from '@utils/errorLogger';
import { labelsApiService } from '@/api/taskAttributes/labels/labels.api.service';

interface ILabelState {
  labels: ITaskLabel[];
  selectedLabel: ITaskLabel | null;
  loading: boolean;
  error: string | null;
  initialized: boolean;
}

const initialState: ILabelState = {
  labels: [],
  selectedLabel: null,
  loading: false,
  error: null,
  initialized: false,
};

// Create async thunk for fetching labels
export const fetchLabels = createAsyncThunk(
  'taskLabel/fetchLabels',
  async (_, { rejectWithValue }) => {
    try {
      const response = await labelsApiService.getLabels();
      return response.body;
    } catch (error) {
      logger.error('Fetch Labels', error);
      if (error instanceof Error) {
        return rejectWithValue(error.message);
      }
      return rejectWithValue('Failed to fetch labels');
    }
  }
);

// Create async thunk for fetching labels by task
export const fetchLabelsByTask = createAsyncThunk(
  'taskLabel/fetchLabelsByTask',
  async (taskId: string, { rejectWithValue }) => {
    try {
      const response = await labelsApiService.getPriorityByTask(taskId);
      return response.body;
    } catch (error) {
      logger.error('Fetch Labels By Task', error);
      if (error instanceof Error) {
        return rejectWithValue(error.message);
      }
      return rejectWithValue('Failed to fetch task labels');
    }
  }
);

// Initialization thunk
export const initializeLabels = createAsyncThunk(
  'taskLabel/initialize',
  async (_, { dispatch, getState }) => {
    const state = getState() as { taskLabelReducer: ILabelState };
    if (!state.taskLabelReducer.initialized) {
      await dispatch(fetchLabels());
    }
  }
);

const taskLabelSlice = createSlice({
  name: 'taskLabelReducer',
  initialState,
  reducers: {
    updateLabelColor: (state, action: PayloadAction<{ id: string; color: string }>) => {
      const label = state.labels.find(l => l.id === action.payload.id);
      if (label) {
        label.color_code = action.payload.color;
      }
    },
    deleteLabel: (state, action: PayloadAction<string>) => {
      state.labels = state.labels.filter(label => label.id !== action.payload);
    },
  },
  extraReducers: builder => {
    builder
      .addCase(fetchLabels.pending, state => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchLabels.fulfilled, (state, action: PayloadAction<ITaskLabel[]>) => {
        state.loading = false;
        state.labels = action.payload;
        state.initialized = true;
      })
      .addCase(fetchLabels.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Fetch Labels By Task
      .addCase(fetchLabelsByTask.pending, state => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchLabelsByTask.fulfilled, (state, action: PayloadAction<ITaskLabel[]>) => {
        state.loading = false;
        state.labels = action.payload;
      })
      .addCase(fetchLabelsByTask.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export const { updateLabelColor, deleteLabel } = taskLabelSlice.actions;
export default taskLabelSlice.reducer;
