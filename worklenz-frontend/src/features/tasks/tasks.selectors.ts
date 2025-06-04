import { createSelector } from '@reduxjs/toolkit';
import { RootState } from '@/app/store';

// Base selectors
const selectTaskReducer = (state: RootState) => state.taskReducer;

// Memoized selectors
export const selectTaskGroups = createSelector(
  [selectTaskReducer],
  (taskReducer) => taskReducer.taskGroups
);

export const selectGroupBy = createSelector(
  [selectTaskReducer],
  (taskReducer) => taskReducer.groupBy
);

export const selectColumns = createSelector(
  [selectTaskReducer],
  (taskReducer) => taskReducer.columns
);

export const selectTasks = createSelector(
  [selectTaskReducer],
  (taskReducer) => taskReducer.tasks
);

// Combined selectors for common use cases
export const selectTaskGroupsAndGroupBy = createSelector(
  [selectTaskGroups, selectGroupBy],
  (taskGroups, groupBy) => ({ taskGroups, groupBy })
);

export const selectVisibleColumns = createSelector(
  [selectColumns],
  (columns) => columns.filter((column: any) => column.pinned)
); 