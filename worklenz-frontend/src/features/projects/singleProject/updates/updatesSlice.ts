import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import {
  IProjectUpdateCommentViewModel,
  IProjectUpdateComment,
  IProjectCommentReplyPreview,
} from '@/types/project/project.types';
import { projectCommentsApiService } from '@/api/projects/comments/project-comments.api.service';
import { IProjectCommentsCreateRequest } from '@/types/project/projectComments.types';
import { IProjectCommentPinChangedSocketPayload } from '@/types/home/inbox.types';

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
  count: 0,
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
  async (
    data: IProjectCommentsCreateRequest & { reply_to_preview?: IProjectCommentReplyPreview },
    { rejectWithValue, getState }
  ) => {
    try {
      // reply_to_preview is client-only (parent snippet for the optimistic
      // render); the API only needs reply_to_id.
      const { reply_to_preview, ...payload } = data;
      const response = await projectCommentsApiService.createProjectComment(payload);
      if (response.done) {
        // The API returns { comment: { ... } } in response.body
        const commentData = (response.body as any).comment;

        // create_project_comment() only returns id/content/project_name/team_name,
        // so the sender's optimistic render is missing the fields the comment list
        // needs (date, owner, avatar). Enrich from the current user + a client
        // timestamp; the socket-triggered refetch later replaces this with the
        // authoritative server row.
        const state = getState() as any;
        const currentUser = state.userReducer || {};
        const now = new Date().toISOString();
        const enriched: IProjectUpdateCommentViewModel = {
          ...commentData,
          user_id: commentData.user_id || currentUser.id,
          created_by: commentData.created_by || currentUser.name,
          avatar_url: commentData.avatar_url || currentUser.avatar_url,
          created_at: commentData.created_at || now,
          updated_at: commentData.updated_at || now,
          reactions: commentData.reactions || [],
          mentions:
            commentData.mentions ||
            ((data.mentions || []).map((m: any) => ({
              user_id: m.id || m.user_id,
              user_name: m.name,
              user_email: m.email,
            })) as any),
          reply_to_id: commentData.reply_to_id || payload.reply_to_id,
          reply_to: reply_to_preview || null,
          attachments: commentData.attachments || [],
        };
        return enriched;
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
    clearUpdates: state => {
      state.updatesList = [];
      state.count = 0;
    },
    addReactionToComment: (
      state,
      action: PayloadAction<{ comment_id: string; reactions: any[] }>
    ) => {
      const comment = state.updatesList.find(c => c.id === action.payload.comment_id);
      if (comment) {
        comment.reactions = action.payload.reactions;
      }
    },
    updateCommentAfterEdit: (state, action: PayloadAction<any>) => {
      const comment = state.updatesList.find(c => c.id === action.payload.comment_id);
      if (comment) {
        comment.content = action.payload.content;
        comment.edited = action.payload.edited;
        comment.edit_count = action.payload.edit_count;
        comment.last_edited_at = action.payload.last_edited_at;
        comment.last_edited_by_name = action.payload.last_edited_by_name;
      }
    },
    markCommentDeleted: (state, action: PayloadAction<string>) => {
      const comment = state.updatesList.find(c => c.id === action.payload);
      if (comment) {
        comment.is_deleted = true;
        comment.content = '';
        comment.mentions = [] as any;
        comment.reactions = [];
        comment.pinned_at = null;
        comment.pinned_by = null;
        comment.pinned_by_name = null;
        comment.attachments = [];
      }
      // Replies quoting the deleted message switch to the placeholder too
      state.updatesList.forEach(c => {
        if (c.reply_to && c.reply_to.id === action.payload) {
          c.reply_to.is_deleted = true;
          c.reply_to.content_snippet = '';
        }
      });
    },
    updateCommentPinState: (
      state,
      action: PayloadAction<IProjectCommentPinChangedSocketPayload>
    ) => {
      const comment = state.updatesList.find(c => c.id === action.payload.comment_id);
      if (comment) {
        comment.pinned_at = action.payload.pinned ? action.payload.pinned_at : null;
        comment.pinned_by = action.payload.pinned ? action.payload.pinned_by : null;
        comment.pinned_by_name = action.payload.pinned ? action.payload.pinned_by_name : null;
      }
    },
  },
  extraReducers: builder => {
    // Get Comments
    builder.addCase(getProjectComments.pending, state => {
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

    // Delete Comment — soft delete: keep the bubble, show the placeholder
    builder.addCase(deleteProjectComment.fulfilled, (state, action) => {
      const comment = state.updatesList.find(item => item.id === action.payload);
      if (comment) {
        comment.is_deleted = true;
        comment.content = '';
        comment.mentions = [] as any;
        comment.reactions = [];
        comment.pinned_at = null;
        comment.pinned_by = null;
        comment.pinned_by_name = null;
        comment.attachments = [];
      }
      state.updatesList.forEach(c => {
        if (c.reply_to && c.reply_to.id === action.payload) {
          c.reply_to.is_deleted = true;
          c.reply_to.content_snippet = '';
        }
      });
    });
  },
});

export const {
  addCommentFromSocket,
  clearUpdates,
  addReactionToComment,
  updateCommentAfterEdit,
  markCommentDeleted,
  updateCommentPinState,
} = updatesSlice.actions;
export default updatesSlice.reducer;
