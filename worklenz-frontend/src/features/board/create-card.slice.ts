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
      action: PayloadAction<{ group: string; position: 'top' | 'bottom'; disabled: boolean }>
    ) => {
      const { group, position, disabled } = action.payload;
      if (!state.taskCardDisabledStatus[group]) {
        state.taskCardDisabledStatus[group] = { top: true, bottom: true };
      }
      state.taskCardDisabledStatus[group][position] = disabled;
    },
  },
});

export const { setTaskCardDisabled, initializeGroup } = createCardSlice.actions;
export default createCardSlice.reducer;
