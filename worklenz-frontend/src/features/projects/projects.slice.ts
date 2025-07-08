import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { projectsApiService } from '@/api/projects/projects.api.service';

interface UpdateProjectPayload {
  id: string;
  [key: string]: any;
}

export const projectsSlice = createSlice({
  name: 'projects',
  initialState: {
    loading: false,
    error: null,
  },
  reducers: {
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
  },
});

// Export actions
export const { setLoading, setError } = projectsSlice.actions;

// Async thunks
export const updateProject = (payload: UpdateProjectPayload) => async (dispatch: any) => {
  try {
    dispatch(setLoading(true));
    const response = await projectsApiService.updateProject(payload);
    dispatch(setLoading(false));
    return response;
  } catch (error) {
    dispatch(setError((error as Error).message));
    dispatch(setLoading(false));
    throw error;
  }
};

export default projectsSlice.reducer;
