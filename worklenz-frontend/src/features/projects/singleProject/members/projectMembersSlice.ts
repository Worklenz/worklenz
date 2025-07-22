import { projectMembersApiService } from '@/api/project-members/project-members.api.service';
import { projectsApiService } from '@/api/projects/projects.api.service';
import { IMentionMemberViewModel } from '@/types/project/projectComments.types';
import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';

interface ProjectMembersState {
  membersList: IMentionMemberViewModel[];
  currentMembersList: IMentionMemberViewModel[];
  isDrawerOpen: boolean;
  isLoading: boolean;
  isFromAssigner: boolean;
  error: string | null;
}

const initialState: ProjectMembersState = {
  membersList: [],
  currentMembersList: [],
  isDrawerOpen: false,
  isLoading: false,
  isFromAssigner: false,
  error: null,
};

const getProjectMembers = createAsyncThunk(
  'projectMembers/getProjectMembers',
  async (params: {
    projectId: string;
    index: number;
    size: number;
    field: string;
    order: string;
    search: string | null;
  }) => {
    const { projectId, index, size, field, order, search } = params;
    const response = await projectsApiService.getMembers(
      projectId,
      index,
      size,
      field,
      order,
      search
    );
    if (!response.done) {
      throw new Error('Failed to fetch project members');
    }
    return response.body;
  }
);

const getAllProjectMembers = createAsyncThunk(
  'projectMembers/getAllProjectMembers',
  async (projectId: string) => {
    const response = await projectMembersApiService.getByProjectId(projectId);
    return response.body;
  }
);

const deleteProjectMember = createAsyncThunk(
  'projectMembers/deleteProjectMember',
  async (params: { memberId: string; projectId: string }) => {
    const { memberId, projectId } = params;
    const response = await projectMembersApiService.deleteProjectMember(memberId, projectId);
    return response;
  }
);

const addProjectMember = createAsyncThunk(
  'projectMembers/addProjectMember',
  async (params: { memberId: string; projectId: string }) => {
    const { memberId, projectId } = params;
    const response = await projectMembersApiService.createProjectMember({
      project_id: projectId,
      team_member_id: memberId,
    });
    return response;
  }
);

const createByEmail = createAsyncThunk(
  'projectMembers/createByEmail',
  async (params: { email: string; project_id: string }) => {
    const response = await projectMembersApiService.createByEmail(params);
    return response;
  }
);

const projectMembersSlice = createSlice({
  name: 'projectMembers',

  initialState,
  reducers: {
    toggleProjectMemberDrawer: state => {
      state.isDrawerOpen = !state.isDrawerOpen;
      if (state.isDrawerOpen === false) {
        state.isFromAssigner = false;
      }
    },
    setIsFromAssigner: (state, action: PayloadAction<boolean>) => {
      state.isFromAssigner = action.payload;
    },
  },
  extraReducers: builder => {
    builder
      .addCase(getProjectMembers.pending, state => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(getProjectMembers.fulfilled, (state, action) => {
        state.membersList = action.payload as IMentionMemberViewModel[];
        state.isLoading = false;
        state.error = null;
      })
      .addCase(getProjectMembers.rejected, (state, action) => {
        state.membersList = [];
        state.isLoading = false;
        state.error = action.error.message || 'Failed to fetch members';
      })
      .addCase(getAllProjectMembers.pending, state => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(getAllProjectMembers.fulfilled, (state, action) => {
        state.currentMembersList = action.payload as IMentionMemberViewModel[];
        state.isLoading = false;
        state.error = null;
      })
      .addCase(getAllProjectMembers.rejected, (state, action) => {
        state.currentMembersList = [];
        state.isLoading = false;
        state.error = action.error.message || 'Failed to fetch members';
      })
      .addCase(deleteProjectMember.pending, state => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(deleteProjectMember.fulfilled, (state, action) => {
        state.currentMembersList = state.currentMembersList.filter(
          member => member.id !== action.payload.body.id
        );
        state.isLoading = false;
        state.error = null;
      })
      .addCase(deleteProjectMember.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'Failed to delete member';
      });
  },
});

export const { toggleProjectMemberDrawer, setIsFromAssigner } = projectMembersSlice.actions;
export {
  getProjectMembers,
  getAllProjectMembers,
  deleteProjectMember,
  addProjectMember,
  createByEmail,
};
export default projectMembersSlice.reducer;
