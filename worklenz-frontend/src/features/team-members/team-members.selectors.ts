import { createSelector } from '@reduxjs/toolkit';
import { RootState } from '@/app/store';

// Base selectors
const selectTeamMembersReducer = (state: RootState) => state.teamMembersReducer;

// Memoized selectors
export const selectTeamMembers = createSelector(
  [selectTeamMembersReducer],
  (teamMembersReducer) => teamMembersReducer.teamMembers
);

export const selectTeamMembersData = createSelector(
  [selectTeamMembers],
  (teamMembers) => teamMembers?.data || []
);

// Selector for filtered members (can be used with search query)
export const createSelectFilteredMembers = (searchQuery: string) =>
  createSelector(
    [selectTeamMembersData],
    (membersData) => {
      if (!searchQuery) return membersData;
      return membersData.filter(member =>
        member.name?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
  ); 