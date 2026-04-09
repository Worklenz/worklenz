import { createSelector } from '@reduxjs/toolkit';
import { RootState } from '@/app/store';

// Export the selectors
export const selectAllTasks = (state: RootState) => state.taskManagement.entities;

// Memoized selector to prevent unnecessary re-renders
export const selectAllTasksArray = createSelector([selectAllTasks], entities =>
  Object.values(entities)
);
export const selectTaskById = (state: RootState, taskId: string) =>
  state.taskManagement.entities[taskId];
export const selectTaskIds = (state: RootState) => state.taskManagement.ids;
export const selectGroups = (state: RootState) => state.taskManagement.groups;
export const selectGrouping = (state: RootState) => state.taskManagement.grouping;
export const selectLoading = (state: RootState) => state.taskManagement.loading;
export const selectError = (state: RootState) => state.taskManagement.error;
export const selectLoadedProjectId = (state: RootState) => state.taskManagement.loadedProjectId;
export const selectSelectedPriorities = (state: RootState) =>
  state.taskManagement.selectedPriorities;
export const selectSearch = (state: RootState) => state.taskManagement.search;
export const selectSortField = (state: RootState) => state.taskManagement.sortField;
export const selectSortOrder = (state: RootState) => state.taskManagement.sortOrder;
export const selectSort = (state: RootState) => ({
  field: state.taskManagement.sortField,
  order: state.taskManagement.sortOrder,
});
export const selectSubtaskLoading = (state: RootState, taskId: string) =>
  state.taskManagement.loadingSubtasks[taskId] || false;

// Memoized selectors to prevent unnecessary re-renders
export const selectTasksByStatus = createSelector(
  [selectAllTasksArray, (_state: RootState, status: string) => status],
  (tasks, status) => tasks.filter(task => task.status === status)
);

export const selectTasksByPriority = createSelector(
  [selectAllTasksArray, (_state: RootState, priority: string) => priority],
  (tasks, priority) => tasks.filter(task => task.priority === priority)
);

export const selectTasksByPhase = createSelector(
  [selectAllTasksArray, (_state: RootState, phase: string) => phase],
  (tasks, phase) => tasks.filter(task => task.phase === phase)
);

// Add archived selector
export const selectArchived = (state: RootState) => state.taskManagement.archived;

// V3 API selectors - no processing needed, data is pre-processed by backend
export const selectTaskGroupsV3 = (state: RootState) => state.taskManagement.groups;
export const selectCurrentGroupingV3 = (state: RootState) => state.grouping.currentGrouping;

// Column-related selectors
export const selectColumns = (state: RootState) => state.taskManagement.columns;
export const selectCustomColumns = (state: RootState) => state.taskManagement.customColumns;
export const selectLoadingColumns = (state: RootState) => state.taskManagement.loadingColumns;

// Helper selector to check if columns are in sync with local fields
export const selectColumnsInSync = (state: RootState) => {
  const columns = state.taskManagement.columns;
  const fields = state.taskManagementFields?.fields || [];

  if (columns.length === 0 || fields.length === 0) return true;

  return !fields.some(field => {
    const backendColumn = columns.find(c => c.key === field.key);
    if (backendColumn) {
      return (backendColumn.pinned ?? false) !== field.visible;
    }
    return false;
  });
};
