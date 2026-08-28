import { createSlice } from '@reduxjs/toolkit';
import { ClientPortalRequest } from '../../../api/client-portal/client-portal-api';

export type RequestsState = {
  selectedRequestNo: string | null;
};

const initialState: RequestsState = {
  selectedRequestNo: null,
};

const requestsSlice = createSlice({
  name: 'requestsReducer',
  initialState,
  reducers: {
    setSelectedRequestNo: (state, action) => {
      state.selectedRequestNo = action.payload;
    },
  },
});

export const { setSelectedRequestNo } = requestsSlice.actions;
export default requestsSlice.reducer;
