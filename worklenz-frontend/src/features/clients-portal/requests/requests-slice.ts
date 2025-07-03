import { createSlice } from '@reduxjs/toolkit';
import { TempRequestsType } from '../../../types/client-portal/temp-client-portal.types';

const TempRequests: TempRequestsType[] = [
  {
    id: '1',
    req_no: '#123',
    service: 'Marketing video',
    client: 'john doe',
    status: 'pending',
    time: new Date('2025-01-27T09:00:00'),
  },
  {
    id: '2',
    req_no: '#232',
    service: 'Product portfolio video',
    client: 'alexander turner',
    status: 'inProgress',
    time: new Date('2025-01-28T10:00:00'),
  },
  {
    id: '3',
    req_no: '#454',
    service: 'Animated video',
    client: 'john smith',
    status: 'accepted',
    time: new Date('2025-01-28T11:00:00'),
  },
];

export type RequestsState = {
  requests: TempRequestsType[];
  selectedRequestNo: string | null;
};

const initialState: RequestsState = {
  requests: TempRequests,
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
