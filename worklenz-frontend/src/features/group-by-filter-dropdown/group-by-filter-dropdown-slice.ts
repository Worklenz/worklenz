import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface GroupByFilterState {
  groupBy: string;
}

const initialState: GroupByFilterState = {
  groupBy: 'status',
};

const groupByFilterDropdownSlice = createSlice({
  name: 'groupByFilterDropdown',
  initialState,
  reducers: {
    setGroupBy(state, action: PayloadAction<string>) {
      state.groupBy = action.payload;
    },
  },
});

export const { setGroupBy } = groupByFilterDropdownSlice.actions;
export default groupByFilterDropdownSlice.reducer;
