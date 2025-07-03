import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { SelectionState } from '@/types/task-management.types';
import { RootState } from '@/app/store';

const initialState: SelectionState = {
  selectedTaskIds: [],
  lastSelectedId: null,
};

const selectionSlice = createSlice({
  name: 'selection',
  initialState,
  reducers: {
    toggleTaskSelection: (state, action: PayloadAction<string>) => {
      const taskId = action.payload;
      const index = state.selectedTaskIds.indexOf(taskId);

      if (index === -1) {
        state.selectedTaskIds.push(taskId);
      } else {
        state.selectedTaskIds.splice(index, 1);
      }

      state.lastSelectedId = taskId;
    },

    selectTask: (state, action: PayloadAction<string>) => {
      const taskId = action.payload;
      if (!state.selectedTaskIds.includes(taskId)) {
        state.selectedTaskIds.push(taskId);
      }
      state.lastSelectedId = taskId;
    },

    deselectTask: (state, action: PayloadAction<string>) => {
      const taskId = action.payload;
      state.selectedTaskIds = state.selectedTaskIds.filter(id => id !== taskId);
      if (state.lastSelectedId === taskId) {
        state.lastSelectedId = state.selectedTaskIds[state.selectedTaskIds.length - 1] || null;
      }
    },

    selectMultipleTasks: (state, action: PayloadAction<string[]>) => {
      const taskIds = action.payload;
      // Add new task IDs that aren't already selected
      taskIds.forEach(id => {
        if (!state.selectedTaskIds.includes(id)) {
          state.selectedTaskIds.push(id);
        }
      });
      state.lastSelectedId = taskIds[taskIds.length - 1] || state.lastSelectedId;
    },

    selectRangeTasks: (
      state,
      action: PayloadAction<{ startId: string; endId: string; allTaskIds: string[] }>
    ) => {
      const { startId, endId, allTaskIds } = action.payload;
      const startIndex = allTaskIds.indexOf(startId);
      const endIndex = allTaskIds.indexOf(endId);

      if (startIndex !== -1 && endIndex !== -1) {
        const [start, end] =
          startIndex <= endIndex ? [startIndex, endIndex] : [endIndex, startIndex];
        const rangeIds = allTaskIds.slice(start, end + 1);

        // Add range IDs that aren't already selected
        rangeIds.forEach(id => {
          if (!state.selectedTaskIds.includes(id)) {
            state.selectedTaskIds.push(id);
          }
        });

        state.lastSelectedId = endId;
      }
    },

    selectAllTasks: (state, action: PayloadAction<string[]>) => {
      state.selectedTaskIds = action.payload;
      state.lastSelectedId = action.payload[action.payload.length - 1] || null;
    },

    clearSelection: state => {
      state.selectedTaskIds = [];
      state.lastSelectedId = null;
    },

    setSelection: (state, action: PayloadAction<string[]>) => {
      state.selectedTaskIds = action.payload;
      state.lastSelectedId = action.payload[action.payload.length - 1] || null;
    },

    resetSelection: () => initialState,
  },
});

export const {
  toggleTaskSelection,
  selectTask,
  deselectTask,
  selectMultipleTasks,
  selectRangeTasks,
  selectAllTasks,
  clearSelection,
  setSelection,
  resetSelection,
} = selectionSlice.actions;

// Selectors
export const selectSelectedTaskIds = (state: RootState) =>
  state.taskManagementSelection.selectedTaskIds;
export const selectLastSelectedId = (state: RootState) =>
  state.taskManagementSelection.lastSelectedId;
export const selectHasSelection = (state: RootState) =>
  state.taskManagementSelection.selectedTaskIds.length > 0;
export const selectSelectionCount = (state: RootState) =>
  state.taskManagementSelection.selectedTaskIds.length;
export const selectIsTaskSelected = (taskId: string) => (state: RootState) =>
  state.taskManagementSelection.selectedTaskIds.includes(taskId);

export default selectionSlice.reducer;
