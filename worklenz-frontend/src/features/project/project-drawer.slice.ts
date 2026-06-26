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
      if (!projectId) {
        throw new Error('Project ID is required');
      }

      console.log(`Fetching project data for ID: ${projectId}`);
      const response = await projectsApiService.getProject(projectId);

      if (!response) {
        throw new Error('No response received from API');
      }

      if (!response.done) {
        throw new Error(response.message || 'API request failed');
      }

      if (!response.body) {
        throw new Error('No project data in response body');
      }

      console.log(`Successfully fetched project data:`, response.body);
      return response.body;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch project';
      console.error(`Error fetching project data for ID ${projectId}:`, error);
      return rejectWithValue(errorMessage);
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
        console.log('Starting project data fetch...');
        state.projectLoading = true;
        state.project = null; // Clear existing data while loading
      })
      .addCase(fetchProjectData.fulfilled, (state, action) => {
        console.log('Project data fetch completed successfully:', action.payload);
        state.project = action.payload;
        state.projectLoading = false;
      })
      .addCase(fetchProjectData.rejected, (state, action) => {
        console.error('Project data fetch failed:', action.payload);
        state.projectLoading = false;
        state.project = null;
        // You could add an error field to the state if needed for UI feedback
      });
  },
});

export const { toggleProjectDrawer, setProjectId, setProjectData } = projectDrawerSlice.actions;
export default projectDrawerSlice.reducer;
