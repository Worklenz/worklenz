import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import { IProjectUpdateCommentViewModel, IProjectUpdateComment } from '@/types/project/project.types';
import { projectCommentsApiService } from '@/api/projects/comments/project-comments.api.service';
import { IProjectCommentsCreateRequest } from '@/types/project/projectComments.types';

interface UpdatesState {
  updatesList: IProjectUpdateCommentViewModel[];
  loading: boolean;
  error: string | null;
  count: number;
}

const initialState: UpdatesState = {
  updatesList: [],
  loading: false,
  error: null,
  count: 0
};

// Async Thunks
export const getProjectComments = createAsyncThunk(
  'updates/getProjectComments',
  async (projectId: string, { rejectWithValue }) => {
    try {
      const response = await projectCommentsApiService.getByProjectId(projectId);
      if (response.done) {
        return response.body;
      }
      return rejectWithValue(response.message);
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to fetch comments');
    }
  }
);

export const createProjectComment = createAsyncThunk(
  'updates/createProjectComment',
  async (data: IProjectCommentsCreateRequest, { rejectWithValue }) => {
    try {
      const response = await projectCommentsApiService.createProjectComment(data);
      if (response.done) {
        // The API returns { comment: { ... } }, so we need to extract the comment object
        return (response.body as any).comment as IProjectUpdateCommentViewModel;
      }
      return rejectWithValue(response.message);
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to create comment');
    }
  }
);

export const deleteProjectComment = createAsyncThunk(
  'updates/deleteProjectComment',
  async (commentId: string, { rejectWithValue }) => {
    try {
      const response = await projectCommentsApiService.deleteComment(commentId);
      if (response.done) {
        return commentId;
      }
      return rejectWithValue(response.message);
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to delete comment');
    }
  }
);

const updatesSlice = createSlice({
  name: 'updatesReducer',
  initialState,
  reducers: {
    addCommentFromSocket: (state, action: PayloadAction<IProjectUpdateCommentViewModel>) => {
      // Check if comment already exists to prevent duplicates
      if (!state.updatesList.some(c => c.id === action.payload.id)) {
        state.updatesList.push(action.payload);
        state.count += 1;
      }
    },
    clearUpdates: (state) => {
      state.updatesList = [];
      state.count = 0;
    }
  },
  extraReducers: (builder) => {
    // Get Comments
    builder.addCase(getProjectComments.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(getProjectComments.fulfilled, (state, action) => {
      state.loading = false;
      state.updatesList = action.payload || [];
      state.count = action.payload?.length || 0;
    });
    builder.addCase(getProjectComments.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload as string;
    });

    // Create Comment
    // We don't necessarily need to add it here if we rely on socket or subsequent fetch, 
    // but adding it optimistically or after success is good UX.
    // However, the API create response structure might need verification. 
    // Assuming it returns the created comment.
    builder.addCase(createProjectComment.fulfilled, (state, action) => {
      // If the socket also sends it, we might duplicate. 
      // Safest is to let socket handle it OR check duplicates.
      // But typically we want immediate feedback.
      // Let's add it if not present.
      if (action.payload && !state.updatesList.some(c => c.id === action.payload.id)) {
        state.updatesList.push(action.payload);
        state.count += 1;
      }
    });

    // Delete Comment
    builder.addCase(deleteProjectComment.fulfilled, (state, action) => {
      state.updatesList = state.updatesList.filter(item => item.id !== action.payload);
      state.count -= 1;
    });
  },
});

export const { addCommentFromSocket, clearUpdates } = updatesSlice.actions;
export default updatesSlice.reducer;
