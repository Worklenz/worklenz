import { projectsApiService } from '@/api/projects/projects.api.service';
import { IProjectViewModel } from '@/types/project/projectViewModel.types';
import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';

interface IProjectDrawerState {
  isProjectDrawerOpen: boolean;
  projectId: string | null;
  projectLoading: boolean;
  project: IProjectViewModel | null;
}

const initialState: IProjectDrawerState = {
  isProjectDrawerOpen: false,
  projectId: null,
  projectLoading: false,
  project: null,
};

export const fetchProjectData = createAsyncThunk(
  'project/fetchProjectData',
  async (projectId: string, { rejectWithValue, dispatch }) => {
    try {
      const response = await projectsApiService.getProject(projectId);
      return response.body;
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to fetch project');
    }
  }
);

const projectDrawerSlice = createSlice({
  name: 'projectDrawer',
  initialState,
  reducers: {
    toggleProjectDrawer: state => {
      state.isProjectDrawerOpen = !state.isProjectDrawerOpen;
    },
    setProjectId: (state, action) => {
      state.projectId = action.payload;
    },
    setProjectData: (state, action) => {
      state.project = action.payload;
    },
  },
  extraReducers: builder => {
    builder

      .addCase(fetchProjectData.pending, state => {
        state.projectLoading = true;
      })
      .addCase(fetchProjectData.fulfilled, (state, action) => {
        state.project = action.payload;
        state.projectLoading = false;
      })
      .addCase(fetchProjectData.rejected, state => {
        state.projectLoading = false;
      });
  },
});

export const { toggleProjectDrawer, setProjectId, setProjectData } = projectDrawerSlice.actions;
export default projectDrawerSlice.reducer;
