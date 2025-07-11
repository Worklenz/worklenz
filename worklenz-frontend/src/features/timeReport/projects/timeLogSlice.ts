import { IRPTTimeProject } from '@/types/reporting/reporting.types';
import { createSlice } from '@reduxjs/toolkit';

interface timeLogState {
  isTimeLogDrawerOpen: boolean;
  selectedLabel: IRPTTimeProject | null;
}

const initialState: timeLogState = {
  isTimeLogDrawerOpen: false,
  selectedLabel: null,
};

const timeLogSlice = createSlice({
  name: 'timeLogReducer',
  initialState,
  reducers: {
    toggleTimeLogDrawer: state => {
      state.isTimeLogDrawerOpen
        ? (state.isTimeLogDrawerOpen = false)
        : (state.isTimeLogDrawerOpen = true);
    },
    setSelectedLabel(state, action) {
      state.selectedLabel = action.payload;
    },
    setLabelAndToggleDrawer(state, action) {
      state.selectedLabel = action.payload;
      state.isTimeLogDrawerOpen = true;
    },
  },
});

export const { toggleTimeLogDrawer, setSelectedLabel, setLabelAndToggleDrawer } =
  timeLogSlice.actions;
export default timeLogSlice.reducer;
