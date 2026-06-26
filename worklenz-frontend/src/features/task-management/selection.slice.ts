import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { TaskSelection } from '@/types/task-management.types';
import { RootState } from '@/app/store';

const initialState: TaskSelection = {
  selectedTaskIds: [],
  lastSelectedTaskId: null,
};

const selectionSlice = createSlice({
  name: 'taskManagementSelection',
  initialState,
  reducers: {
    selectTask: (state, action: PayloadAction<string>) => {
      const taskId = action.payload;
      if (!state.selectedTaskIds.includes(taskId)) {
        state.selectedTaskIds.push(taskId);
      }
      state.lastSelectedTaskId = taskId;
    },
    deselectTask: (state, action: PayloadAction<string>) => {
      const taskId = action.payload;
      state.selectedTaskIds = state.selectedTaskIds.filter(id => id !== taskId);
      if (state.lastSelectedTaskId === taskId) {
        state.lastSelectedTaskId = state.selectedTaskIds[state.selectedTaskIds.length - 1] || null;
      }
    },
    toggleTaskSelection: (state, action: PayloadAction<string>) => {
      const taskId = action.payload;
      const index = state.selectedTaskIds.indexOf(taskId);
      if (index === -1) {
        state.selectedTaskIds.push(taskId);
        state.lastSelectedTaskId = taskId;
      } else {
        state.selectedTaskIds.splice(index, 1);
        state.lastSelectedTaskId = state.selectedTaskIds[state.selectedTaskIds.length - 1] || null;
      }
    },
    selectRange: (state, action: PayloadAction<string[]>) => {
      const taskIds = action.payload;
      const uniqueIds = Array.from(new Set([...state.selectedTaskIds, ...taskIds]));
      state.selectedTaskIds = uniqueIds;
      state.lastSelectedTaskId = taskIds[taskIds.length - 1];
    },
    clearSelection: state => {
      state.selectedTaskIds = [];
      state.lastSelectedTaskId = null;
    },
    resetSelection: state => {
      state.selectedTaskIds = [];
      state.lastSelectedTaskId = null;
    },
  },
});

export const {
  selectTask,
  deselectTask,
  toggleTaskSelection,
  selectRange,
  clearSelection,
  resetSelection,
} = selectionSlice.actions;

// Selectors
export const selectSelectedTaskIds = (state: RootState) =>
  state.taskManagementSelection.selectedTaskIds;
export const selectLastSelectedTaskId = (state: RootState) =>
  state.taskManagementSelection.lastSelectedTaskId;
export const selectIsTaskSelected = (state: RootState, taskId: string) =>
  state.taskManagementSelection.selectedTaskIds.includes(taskId);

export default selectionSlice.reducer;
