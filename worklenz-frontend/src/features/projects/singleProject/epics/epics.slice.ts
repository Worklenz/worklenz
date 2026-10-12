import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';

import { projectEpicsApiService } from '@/api/project-epics/project-epics.api.service';
import { IProjectEpic } from '@/types/project/projectEpic.types';

interface EpicsState {
  epics: IProjectEpic[];
  isLoading: boolean;
  hasError: boolean;
  filterEpicId: string | null;
  /** Project the loaded `epics` belong to. */
  projectId: string | null;
}

const initialState: EpicsState = {
  epics: [],
  projectId: null,
  isLoading: false,
  hasError: false,
  filterEpicId: null,
};

export const fetchProjectEpics = createAsyncThunk(
  'epics/fetchProjectEpics',
  async (projectId: string, { rejectWithValue }) => {
    try {
      const response = await projectEpicsApiService.getByProjectId(projectId);
      if (!response.done) return rejectWithValue(response.message);
      return response.body;
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);

const epicsSlice = createSlice({
  name: 'epicsReducer',
  initialState,
  reducers: {
    upsertEpic: (state, action: PayloadAction<IProjectEpic>) => {
      const index = state.epics.findIndex(epic => epic.id === action.payload.id);
      if (index === -1) {
        state.epics.push(action.payload);
      } else {
        state.epics[index] = action.payload;
      }
    },
    setEpicFilter: (state, action: PayloadAction<string | null>) => {
      state.filterEpicId = action.payload;
    },
    resetEpics: () => initialState,
  },
  extraReducers: builder => {
    builder
      .addCase(fetchProjectEpics.pending, state => {
        state.isLoading = true;
        state.hasError = false;
      })
      .addCase(fetchProjectEpics.fulfilled, (state, action) => {
        state.isLoading = false;
        state.epics = action.payload ?? [];
        state.projectId = action.meta.arg;
      })
      .addCase(fetchProjectEpics.rejected, state => {
        state.isLoading = false;
        state.hasError = true;
      });
  },
});

export const { upsertEpic, setEpicFilter, resetEpics } = epicsSlice.actions;
export default epicsSlice.reducer;
