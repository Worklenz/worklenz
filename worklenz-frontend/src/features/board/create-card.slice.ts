import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface CreateCardState {
  taskCardDisabledStatus: { [group: string]: { top: boolean; bottom: boolean } };
}

const initialState: CreateCardState = {
  taskCardDisabledStatus: {},
};

const createCardSlice = createSlice({
  name: 'createCard',
  initialState,
  reducers: {
    initializeGroup(state, action: PayloadAction<string>) {
      const group = action.payload;
      if (!state.taskCardDisabledStatus[group]) {
        state.taskCardDisabledStatus[group] = { top: true, bottom: true };
      }
    },
    setTaskCardDisabled: (
      state,
      action: PayloadAction<{
        group?: string;
        status?: string;
        position: 'top' | 'bottom';
        disabled: boolean;
      }>
    ) => {
      const group = action.payload.group ?? action.payload.status ?? '';
      const { position, disabled } = action.payload;
      if (!state.taskCardDisabledStatus[group]) {
        state.taskCardDisabledStatus[group] = { top: true, bottom: true };
      }
      state.taskCardDisabledStatus[group][position] = disabled;
    },
  },
});

export const { setTaskCardDisabled, initializeGroup } = createCardSlice.actions;
export const initializeStatus = initializeGroup;
export default createCardSlice.reducer;
