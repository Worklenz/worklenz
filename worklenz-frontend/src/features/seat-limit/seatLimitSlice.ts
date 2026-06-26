import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface SeatLimitData {
  error_code: string;
  current_members: number;
  plan_seat_limit: number;
  business_plan_limit: number;
  is_appsumo_user: boolean;
  subscription_type: string;
}

interface PendingInvite {
  type: 'team' | 'project';
  data: any;
  projectId?: string;
  projectName?: string;
}

interface SeatLimitState {
  isModalOpen: boolean;
  seatLimitData: SeatLimitData | null;
  pendingInvite: PendingInvite | null;
}

const initialState: SeatLimitState = {
  isModalOpen: false,
  seatLimitData: null,
  pendingInvite: null,
};

const seatLimitSlice = createSlice({
  name: 'seatLimit',
  initialState,
  reducers: {
    openSeatLimitModal: (
      state,
      action: PayloadAction<{ seatLimitData: SeatLimitData; pendingInvite: PendingInvite }>
    ) => {
      state.isModalOpen = true;
      state.seatLimitData = action.payload.seatLimitData;
      state.pendingInvite = action.payload.pendingInvite;
    },
    closeSeatLimitModal: state => {
      state.isModalOpen = false;
      state.seatLimitData = null;
      state.pendingInvite = null;
    },
    clearPendingInvite: state => {
      state.pendingInvite = null;
    },
  },
});

export const { openSeatLimitModal, closeSeatLimitModal, clearPendingInvite } =
  seatLimitSlice.actions;

export default seatLimitSlice.reducer;
