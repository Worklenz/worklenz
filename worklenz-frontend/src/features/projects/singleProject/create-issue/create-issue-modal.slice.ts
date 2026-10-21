import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface CreateIssueModalState {
  isOpen: boolean;
  /** Sprint the new issue is created in; null creates it in the Backlog. */
  sprintId: string | null;
  /** Status the new issue starts in; null uses the project's default status. */
  statusId: string | null;
}

interface OpenCreateIssueModalPayload {
  sprintId?: string | null;
  statusId?: string | null;
}

const initialState: CreateIssueModalState = {
  isOpen: false,
  sprintId: null,
  statusId: null,
};

const createIssueModalSlice = createSlice({
  name: 'createIssueModalReducer',
  initialState,
  reducers: {
    openCreateIssueModal: (state, action: PayloadAction<OpenCreateIssueModalPayload | undefined>) => {
      state.isOpen = true;
      state.sprintId = action.payload?.sprintId ?? null;
      state.statusId = action.payload?.statusId ?? null;
    },
    closeCreateIssueModal: state => {
      state.isOpen = false;
    },
  },
});

export const { openCreateIssueModal, closeCreateIssueModal } = createIssueModalSlice.actions;
export default createIssueModalSlice.reducer;
