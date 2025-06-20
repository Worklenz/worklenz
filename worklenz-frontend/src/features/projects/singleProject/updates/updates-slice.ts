import { createSlice } from '@reduxjs/toolkit';
import { UpdatesType } from '../../../../types/updates.types';

type UpdatesState = {
  updatesList: UpdatesType[];
};

const initialState = {
  updatesList: [],
};

const updatesSlice = createSlice({
  name: 'updatesReducer',
  initialState,
  reducers: {},
});

export default updatesSlice.reducer;
