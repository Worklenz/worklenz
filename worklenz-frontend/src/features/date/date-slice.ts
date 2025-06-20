import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';

type DateSliceState = {
  date: Dayjs;
};

const initialState: DateSliceState = {
  date: dayjs(),
};

const dateSlice = createSlice({
  name: 'dateReducer',
  initialState,
  reducers: {
    selectedDate: (state, action: PayloadAction<Dayjs>) => {
      state.date = action.payload;
    },
  },
});

export const { selectedDate } = dateSlice.actions;
export default dateSlice.reducer;
