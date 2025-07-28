import { createSelector } from '@reduxjs/toolkit';
import { shallowEqual } from 'react-redux';
import { RootState } from '@/app/store';
import { Task } from '@/types/task-management.types';

// Performance-optimized selectors using createSelector for memoization

// Basic state selectors (these will be cached)
const selectTaskManagementState = (state: RootState) => state.taskManagement;
const selectTaskReducerState = (state: RootState) => state.taskReducer;
const selectThemeState = (state: RootState) => state.themeReducer;
const selectTeamMembersState = (state: RootState) => state.teamMembersReducer;
const selectTaskStatusState = (state: RootState) => state.taskStatusReducer;
const selectPriorityState = (state: RootState) => state.priorityReducer;
const selectPhaseState = (state: RootState) => state.phaseReducer;
const selectTaskLabelsState = (state: RootState) => state.taskLabelsReducer;

// Memoized task selectors
export const selectOptimizedAllTasks = createSelector(
  [selectTaskManagementState],
  taskManagementState => Object.values(taskManagementState.entities || {})
);

export const selectOptimizedTasksById = createSelector(
  [selectTaskManagementState],
  taskManagementState => taskManagementState.entities || {}
);

export const selectOptimizedTaskGroups = createSelector(
  [selectTaskManagementState],
  taskManagementState => taskManagementState.groups || []
);

export const selectOptimizedCurrentGrouping = createSelector(
  [selectTaskManagementState],
  taskManagementState => taskManagementState.grouping || 'status'
);

export const selectOptimizedLoading = createSelector(
  [selectTaskManagementState],
  taskManagementState => taskManagementState.loading || false
);

export const selectOptimizedError = createSelector(
  [selectTaskManagementState],
  taskManagementState => taskManagementState.error
);

export const selectOptimizedSearch = createSelector(
  [selectTaskManagementState],
  taskManagementState => taskManagementState.search || ''
);

export const selectOptimizedArchived = createSelector(
  [selectTaskManagementState],
  taskManagementState => taskManagementState.archived || false
);

// Theme selectors
export const selectOptimizedIsDarkMode = createSelector(
  [selectThemeState],
  themeState => themeState?.mode === 'dark'
);

export const selectOptimizedThemeMode = createSelector(
  [selectThemeState],
  themeState => themeState?.mode || 'light'
);

// Team members selectors
export const selectOptimizedTeamMembers = createSelector(
  [selectTeamMembersState],
  teamMembersState => teamMembersState.teamMembers || []
);

export const selectOptimizedTeamMembersById = createSelector(
  [selectOptimizedTeamMembers],
  teamMembers => {
    if (!Array.isArray(teamMembers)) return {};
    const membersById: Record<string, any> = {};
    teamMembers.forEach((member: any) => {
      membersById[member.id] = member;
    });
    return membersById;
  }
);

// Task status selectors
export const selectOptimizedTaskStatuses = createSelector(
  [selectTaskStatusState],
  taskStatusState => taskStatusState.status || []
);

export const selectOptimizedTaskStatusCategories = createSelector(
  [selectTaskStatusState],
  taskStatusState => taskStatusState.statusCategories || []
);

// Priority selectors
export const selectOptimizedPriorities = createSelector(
  [selectPriorityState],
  priorityState => priorityState.priorities || []
);

// Phase selectors
export const selectOptimizedPhases = createSelector(
  [selectPhaseState],
  phaseState => phaseState.phaseList || []
);

// Labels selectors
export const selectOptimizedLabels = createSelector(
  [selectTaskLabelsState],
  labelsState => labelsState.labels || []
);

// Complex computed selectors
export const selectOptimizedTasksByGroup = createSelector(
  [selectOptimizedAllTasks, selectOptimizedTaskGroups],
  (tasks, groups) => {
    const tasksByGroup: Record<string, Task[]> = {};

    groups.forEach((group: any) => {
      tasksByGroup[group.id] = group.tasks || [];
    });

    return tasksByGroup;
  }
);

export const selectOptimizedTaskCounts = createSelector(
  [selectOptimizedTasksByGroup],
  tasksByGroup => {
    const counts: Record<string, number> = {};
    Object.keys(tasksByGroup).forEach(groupId => {
      counts[groupId] = tasksByGroup[groupId].length;
    });
    return counts;
  }
);

export const selectOptimizedTotalTaskCount = createSelector(
  [selectOptimizedAllTasks],
  tasks => tasks.length
);

// Selection state selectors
export const selectOptimizedSelectedTaskIds = createSelector(
  [(state: RootState) => state.taskManagementSelection?.selectedTaskIds],
  selectedTaskIds => selectedTaskIds || []
);

export const selectOptimizedSelectedTasksCount = createSelector(
  [selectOptimizedSelectedTaskIds],
  selectedTaskIds => selectedTaskIds.length
);

export const selectOptimizedSelectedTasks = createSelector(
  [selectOptimizedAllTasks, selectOptimizedSelectedTaskIds],
  (tasks, selectedTaskIds) => {
    return tasks.filter((task: Task) => selectedTaskIds.includes(task.id));
  }
);

// Performance utilities
export const createShallowEqualSelector = <T>(selector: (state: RootState) => T) => {
  let lastResult: T;
  let lastArgs: any;

  return (state: RootState): T => {
    const newArgs = selector(state);

    if (!shallowEqual(newArgs, lastArgs)) {
      lastArgs = newArgs;
      lastResult = newArgs;
    }

    return lastResult;
  };
};

// Memoized equality functions for React.memo
export const taskPropsAreEqual = (prevProps: any, nextProps: any): boolean => {
  // Quick reference checks first
  if (prevProps.task === nextProps.task) return true;
  if (!prevProps.task || !nextProps.task) return false;
  if (prevProps.task.id !== nextProps.task.id) return false;

  // Check other props
  if (prevProps.isSelected !== nextProps.isSelected) return false;
  if (prevProps.isDragOverlay !== nextProps.isDragOverlay) return false;
  if (prevProps.groupId !== nextProps.groupId) return false;
  if (prevProps.currentGrouping !== nextProps.currentGrouping) return false;
  if (prevProps.level !== nextProps.level) return false;

  // Deep comparison for task properties that commonly change
  const taskProps = [
    'title',
    'progress',
    'status',
    'priority',
    'description',
    'startDate',
    'dueDate',
    'updatedAt',
    'sub_tasks_count',
    'show_sub_tasks',
  ];

  for (const prop of taskProps) {
    if (prevProps.task[prop] !== nextProps.task[prop]) {
      return false;
    }
  }

  // Compare arrays with shallow equality
  if (!shallowEqual(prevProps.task.assignees, nextProps.task.assignees)) {
    return false;
  }

  if (!shallowEqual(prevProps.task.labels, nextProps.task.labels)) {
    return false;
  }

  return true;
};

export const taskGroupPropsAreEqual = (prevProps: any, nextProps: any): boolean => {
  // Quick reference checks
  if (prevProps.group === nextProps.group) return true;
  if (!prevProps.group || !nextProps.group) return false;
  if (prevProps.group.id !== nextProps.group.id) return false;

  // Check task lists
  if (!shallowEqual(prevProps.group.taskIds, nextProps.group.taskIds)) {
    return false;
  }

  // Check other props
  if (prevProps.projectId !== nextProps.projectId) return false;
  if (prevProps.currentGrouping !== nextProps.currentGrouping) return false;
  if (!shallowEqual(prevProps.selectedTaskIds, nextProps.selectedTaskIds)) {
    return false;
  }

  return true;
};

// Performance monitoring utilities
export const createPerformanceSelector = <T>(selector: (state: RootState) => T, name: string) => {
  return createSelector([selector], result => {
    if (process.env.NODE_ENV === 'development') {
      const startTime = performance.now();
      const endTime = performance.now();
      const duration = endTime - startTime;

      if (duration > 5) {
        console.warn(`Slow selector ${name}: ${duration.toFixed(2)}ms`);
      }
    }
    return result;
  });
};

// Utility to create batched state updates
export const createBatchedStateUpdate = <T>(
  updateFn: (updates: T[]) => void,
  delay: number = 16 // One frame
) => {
  let pending: T[] = [];
  let timeoutId: NodeJS.Timeout | null = null;

  return (update: T) => {
    pending.push(update);

    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      const updates = [...pending];
      pending = [];
      timeoutId = null;
      updateFn(updates);
    }, delay);
  };
};

// Performance monitoring hook
export const useReduxPerformanceMonitor = () => {
  if (process.env.NODE_ENV === 'development') {
    const startTime = performance.now();

    return () => {
      const endTime = performance.now();
      const duration = endTime - startTime;

      if (duration > 16) {
        console.warn(`Slow Redux operation: ${duration.toFixed(2)}ms`);
      }
    };
  }

  return () => {}; // No-op in production
};
