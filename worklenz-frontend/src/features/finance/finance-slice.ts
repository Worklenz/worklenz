import { createSlice, PayloadAction } from '@reduxjs/toolkit';

type financeState = {
  isRatecardDrawerOpen: boolean;
  isFinanceDrawerOpen: boolean;
  isImportRatecardsDrawerOpen: boolean;
  currency: string;
};

const initialState: financeState = {
  isRatecardDrawerOpen: false,
  isFinanceDrawerOpen: false,
  isImportRatecardsDrawerOpen: false,
  currency: 'LKR',
};

const financeSlice = createSlice({
  name: 'financeReducer',
  initialState,
  reducers: {
    toggleRatecardDrawer: (state) => {
      state.isRatecardDrawerOpen = !state.isRatecardDrawerOpen;
    },
    toggleFinanceDrawer: (state) => {
      state.isFinanceDrawerOpen = !state.isFinanceDrawerOpen;
    },
    toggleImportRatecardsDrawer: (state) => {
      state.isImportRatecardsDrawerOpen = !state.isImportRatecardsDrawerOpen;
    },
    changeCurrency: (state, action: PayloadAction<string>) => {
      state.currency = action.payload;
    },
  },
});

export const {
  toggleRatecardDrawer,
  toggleFinanceDrawer,
  toggleImportRatecardsDrawer,
  changeCurrency,
} = financeSlice.actions;
export default financeSlice.reducer;
