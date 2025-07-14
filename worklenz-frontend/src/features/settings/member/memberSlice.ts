import { createSlice, nanoid, PayloadAction } from '@reduxjs/toolkit';
import { MemberType } from '../../../types/member.types';
import { ITeamMemberViewModel } from '@/types/teamMembers/teamMembersGetResponse.types';

type MemberState = {
  owner: MemberType;
  membersList: MemberType[];
  isUpdateMemberDrawerOpen: boolean;
  isInviteMemberDrawerOpen: boolean;
  refreshTeamMembers: boolean;
};

const initialState: MemberState = {
  owner: {
    memberId: nanoid(),
    memberName: 'Sachintha Prasad',
    memberEmail: 'prasadsachintha1231@gmail.com',
    memberRole: 'owner',
    isActivate: true,
    isInivitationAccept: true,
  },
  membersList: [],
  isUpdateMemberDrawerOpen: false,
  isInviteMemberDrawerOpen: false,
  refreshTeamMembers: false,
};

const memberSlice = createSlice({
  name: 'memberReducer',
  initialState,
  reducers: {
    toggleInviteMemberDrawer: state => {
      state.isInviteMemberDrawerOpen
        ? (state.isInviteMemberDrawerOpen = false)
        : (state.isInviteMemberDrawerOpen = true);
    },
    toggleUpdateMemberDrawer: state => {
      state.isUpdateMemberDrawerOpen
        ? (state.isUpdateMemberDrawerOpen = false)
        : (state.isUpdateMemberDrawerOpen = true);
    },
    triggerTeamMembersRefresh(state) {
      state.refreshTeamMembers = !state.refreshTeamMembers; // Toggle to trigger effect
    },
  },
});

export const { toggleInviteMemberDrawer, toggleUpdateMemberDrawer, triggerTeamMembersRefresh } =
  memberSlice.actions;
export default memberSlice.reducer;
