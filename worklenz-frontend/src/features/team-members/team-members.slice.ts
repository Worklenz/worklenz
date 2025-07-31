import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import { teamMembersApiService } from '@/api/team-members/teamMembers.api.service';
import { ITeamMember } from '@/types/teamMembers/teamMember.types';
import { ITeamMemberCreateRequest } from '@/types/teamMembers/team-member-create-request';
import { ITeamMembersViewModel } from '@/types/teamMembers/teamMembersViewModel.types';
import { ITeamMemberViewModel } from '@/types/teamMembers/teamMembersGetResponse.types';
import { IServerResponse } from '@/types/common.types';

interface TeamMembersState {
  teamMembers: ITeamMembersViewModel | null;
  teamMember: ITeamMemberViewModel | null;
  loading: boolean;
}

const initialState: TeamMembersState = {
  teamMembers: null,
  teamMember: null,
  loading: false,
};

// Async Thunks
export const createTeamMember = createAsyncThunk(
  'teamMembers/create',
  async (data: ITeamMemberCreateRequest) => {
    const response = await teamMembersApiService.createTeamMember(data);
    return response;
  }
);

export const getTeamMembers = createAsyncThunk(
  'teamMembers/getAll',
  async ({
    index,
    size,
    field,
    order,
    search,
    all,
  }: {
    index: number;
    size: number;
    field: string | null;
    order: string | null;
    search: string | null;
    all?: boolean;
  }) => {
    const response = await teamMembersApiService.get(index, size, field, order, search, all);
    return response;
  }
);

export const getTeamMemberById = createAsyncThunk('teamMembers/getById', async (id: string) => {
  const response = await teamMembersApiService.getById(id);
  return response;
});

export const updateTeamMember = createAsyncThunk(
  'teamMembers/update',
  async ({ id, data }: { id: string; data: ITeamMemberCreateRequest }) => {
    const response = await teamMembersApiService.update(id, data);
    return response;
  }
);

export const deleteTeamMember = createAsyncThunk(
  'teamMembers/delete',
  async ({ id, email }: { id: string; email: string }) => {
    const response = await teamMembersApiService.delete(id, email);
    return response;
  }
);

export const resendInvitation = createAsyncThunk(
  'teamMembers/resendInvitation',
  async (id: string) => {
    const response = await teamMembersApiService.resendInvitation(id);
    return response;
  }
);

export const toggleMemberStatus = createAsyncThunk(
  'teamMembers/toggleStatus',
  async ({ id, active, email }: { id: string; active: boolean; email: string }) => {
    const response = await teamMembersApiService.toggleMemberActiveStatus(id, active, email);
    return response;
  }
);

const teamMembersSlice = createSlice({
  name: 'teamMembers',
  initialState,
  reducers: {
    resetTeamMember: state => {
      state.teamMember = null;
    },
    setTeamMembers: (state, action: PayloadAction<ITeamMembersViewModel>) => {
      state.teamMembers = action.payload;
    },
  },
  extraReducers: builder => {
    builder
      .addCase(
        getTeamMembers.fulfilled,
        (
          state: TeamMembersState,
          action: PayloadAction<IServerResponse<ITeamMembersViewModel>>
        ) => {
          state.teamMembers = action.payload.body;
        }
      )
      .addCase(
        getTeamMemberById.fulfilled,
        (state: TeamMembersState, action: PayloadAction<IServerResponse<ITeamMemberViewModel>>) => {
          state.teamMember = action.payload.body;
        }
      )
      // Common loading state
      .addMatcher(
        action => action.type.endsWith('/pending'),
        state => {
          state.loading = true;
        }
      )
      // Common error state
      .addMatcher(
        action => action.type.endsWith('/rejected'),
        (state, action) => {
          state.loading = false;
        }
      )
      // Success states
      .addMatcher(
        action => action.type.endsWith('/fulfilled'),
        state => {
          state.loading = false;
        }
      );
  },
});

export const { resetTeamMember, setTeamMembers } = teamMembersSlice.actions;
export default teamMembersSlice.reducer;
