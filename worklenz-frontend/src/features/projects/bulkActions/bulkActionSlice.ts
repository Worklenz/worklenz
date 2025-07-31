import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { IProjectTask } from '@/types/project/projectTasksViewModel.types';
type BulkActionState = {
  selectedTasks: IProjectTask[];
  selectedTaskIdsList: string[];
};

const initialState: BulkActionState = {
  selectedTasks: [],
  selectedTaskIdsList: [],
};

const bulkActionSlice = createSlice({
  name: 'bulkActionReducer',
  initialState,
  reducers: {
    selectTaskIds: (state, action: PayloadAction<string[]>) => {
      state.selectedTaskIdsList = action.payload;
    },
    selectTasks: (state, action: PayloadAction<IProjectTask[]>) => {
      state.selectedTasks = action.payload;
    },
    deselectAll: state => {
      state.selectedTaskIdsList = [];
      state.selectedTasks = [];
    },
  },
});

export const { selectTaskIds, selectTasks, deselectAll } = bulkActionSlice.actions;
export default bulkActionSlice.reducer;
