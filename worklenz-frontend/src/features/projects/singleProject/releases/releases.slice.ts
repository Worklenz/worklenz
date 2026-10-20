import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';

import { projectReleasesApiService } from '@/api/project-releases/project-releases.api.service';
import { IProjectRelease } from '@/types/project/projectRelease.types';

interface ReleasesState {
  releases: IProjectRelease[];
  isLoading: boolean;
  hasError: boolean;
  /** Project the loaded `releases` belong to. */
  projectId: string | null;
}

const initialState: ReleasesState = {
  releases: [],
  projectId: null,
  isLoading: false,
  hasError: false,
};

export const fetchProjectReleases = createAsyncThunk(
  'releases/fetchProjectReleases',
  async (projectId: string, { rejectWithValue }) => {
    try {
      const response = await projectReleasesApiService.getByProjectId(projectId);
      if (!response.done) return rejectWithValue(response.message);
      return response.body;
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);

const releasesSlice = createSlice({
  name: 'releasesReducer',
  initialState,
  reducers: {
    upsertRelease: (state, action: PayloadAction<IProjectRelease>) => {
      const index = state.releases.findIndex(release => release.id === action.payload.id);
      if (index === -1) {
        state.releases.unshift(action.payload);
      } else {
        state.releases[index] = action.payload;
      }
    },
    resetReleases: () => initialState,
  },
  extraReducers: builder => {
    builder
      .addCase(fetchProjectReleases.pending, state => {
        state.isLoading = true;
        state.hasError = false;
      })
      .addCase(fetchProjectReleases.fulfilled, (state, action) => {
        state.isLoading = false;
        state.releases = action.payload ?? [];
        state.projectId = action.meta.arg;
      })
      .addCase(fetchProjectReleases.rejected, state => {
        state.isLoading = false;
        state.hasError = true;
      });
  },
});

export const { upsertRelease, resetReleases } = releasesSlice.actions;
export default releasesSlice.reducer;
