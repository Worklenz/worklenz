import { createSlice } from '@reduxjs/toolkit';

interface scheduleState {
  isSettingsDrawerOpen: boolean;
  isModalOpen: boolean;
  isScheduleDrawerOpen: boolean;
  workingDays: string[];
  workingHours: number;
}

const initialState: scheduleState = {
  isSettingsDrawerOpen: false,
  isModalOpen: false,
  isScheduleDrawerOpen: false,
  workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
  workingHours: 8,
};

const scheduleSlice = createSlice({
  name: 'scheduleReducer',
  initialState,
  reducers: {
    toggleSettingsDrawer: state => {
      state.isSettingsDrawerOpen
        ? (state.isSettingsDrawerOpen = false)
        : (state.isSettingsDrawerOpen = true);
    },
    updateSettings(state, action) {
      state.workingDays = action.payload.workingDays;
      state.workingHours = action.payload.workingHours;
    },
    toggleModal(state) {
      state.isModalOpen ? (state.isModalOpen = false) : (state.isModalOpen = true);
    },
    toggleScheduleDrawer: state => {
      state.isScheduleDrawerOpen
        ? (state.isScheduleDrawerOpen = false)
        : (state.isScheduleDrawerOpen = true);
    },
  },
});

export const { toggleSettingsDrawer, updateSettings, toggleModal, toggleScheduleDrawer } =
  scheduleSlice.actions;
export default scheduleSlice.reducer;
