import { createSlice } from '@reduxjs/toolkit';

interface billingState {
  isDrawerOpen: boolean;
  isModalOpen: boolean;
}

const initialState: billingState = {
  isDrawerOpen: false,
  isModalOpen: false,
};

const billingSlice = createSlice({
  name: 'billingReducer',
  initialState,
  reducers: {
    toggleDrawer: state => {
      state.isDrawerOpen ? (state.isDrawerOpen = false) : (state.isDrawerOpen = true);
    },
    toggleUpgradeModal: state => {
      state.isModalOpen ? (state.isModalOpen = false) : (state.isModalOpen = true);
    },
  },
});

export const { toggleDrawer, toggleUpgradeModal } = billingSlice.actions;
export default billingSlice.reducer;
