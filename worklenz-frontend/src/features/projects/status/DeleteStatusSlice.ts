import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface Status {
  id: string;
  name: string;
  category_id: string;
  message: string;
}

interface StatusState {
  isDeleteStatusDrawerOpen: boolean;
  status: Status | null;
}

const initialState: StatusState = {
  isDeleteStatusDrawerOpen: false,
  status: null,
};

const deleteStatusSlice = createSlice({
  name: 'deleteStatusReducer',
  initialState,
  reducers: {
    deleteStatusToggleDrawer: state => {
      state.isDeleteStatusDrawerOpen = !state.isDeleteStatusDrawerOpen;
    },
    seletedStatusCategory: (
      state,
      action: PayloadAction<{ id: string; name: string; category_id: string; message: string }>
    ) => {
      state.status = action.payload;
    },
    // deleteStatus: (state, action: PayloadAction<string>) => {
    //   state.status = state.status.filter(status => status.id !== action.payload);
    // },
  },
});

export const {
  deleteStatusToggleDrawer,
  seletedStatusCategory,
  // deleteStatus
} = deleteStatusSlice.actions;
export default deleteStatusSlice.reducer;
