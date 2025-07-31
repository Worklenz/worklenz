import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface Status {
  id: string;
  name: string;
  category: string;
}

interface StatusState {
  isCreateStatusDrawerOpen: boolean;
  status: Status[];
}

const initialState: StatusState = {
  isCreateStatusDrawerOpen: false,
  status: [],
};

const statusSlice = createSlice({
  name: 'statusReducer',
  initialState,
  reducers: {
    toggleDrawer: state => {
      state.isCreateStatusDrawerOpen = !state.isCreateStatusDrawerOpen;
    },
    addStatus: (state, action: PayloadAction<Status>) => {
      state.status.push(action.payload);
    },
    updateStatusCategory: (state, action: PayloadAction<{ id: string; category: string }>) => {
      const status = state.status.find(status => status.id === action.payload.id);
      if (status) {
        status.category = action.payload.category;
      }
    },
    deleteStatus: (state, action: PayloadAction<string>) => {
      state.status = state.status.filter(status => status.id !== action.payload);
    },
  },
});

export const { toggleDrawer, addStatus, updateStatusCategory, deleteStatus } = statusSlice.actions;
export default statusSlice.reducer;
