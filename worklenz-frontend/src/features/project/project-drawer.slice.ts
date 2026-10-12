import { projectsApiService } from '@/api/projects/projects.api.service';
import { IProjectViewModel } from '@/types/project/projectViewModel.types';
import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { cacheProjectAccess } from '@/features/project/project.slice';
import { extractProjectAccess } from '@/utils/project-access.utils';

interface IProjectDrawerState {
  projectId: string | null;
  projectLoading: boolean;
  project: IProjectViewModel | null;
}

const initialState: IProjectDrawerState = {
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

      const access = extractProjectAccess(response.body);
      if (access && response.body.id) {
        dispatch(cacheProjectAccess({ projectId: response.body.id, access }));
      }

      return response.body;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch project';
      console.error('Error fetching project data for ID', projectId, error);
      return rejectWithValue(errorMessage);
    }
  }
);

const projectDrawerSlice = createSlice({
  name: 'projectDrawer',
  initialState,
  reducers: {
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
        state.project = null;
      })
      .addCase(fetchProjectData.fulfilled, (state, action) => {
        state.project = action.payload;
        state.projectLoading = false;
      })
      .addCase(fetchProjectData.rejected, (state, action) => {
        state.projectLoading = false;
        state.project = null;
      });
  },
});

export const { setProjectId, setProjectData } = projectDrawerSlice.actions;
export default projectDrawerSlice.reducer;
