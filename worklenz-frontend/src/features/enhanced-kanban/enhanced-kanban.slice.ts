import { createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit';
import {
  IGroupByOption,
  ITaskListConfigV2,
  ITaskListGroup,
  ITaskListSortableColumn,
} from '@/types/tasks/taskList.types';
import { tasksApiService } from '@/api/tasks/tasks.api.service';
import logger from '@/utils/errorLogger';
import { ITaskListMemberFilter } from '@/types/tasks/taskListFilters.types';
import { IProjectTask } from '@/types/project/projectTasksViewModel.types';
import { ITaskStatusViewModel } from '@/types/tasks/taskStatusGetResponse.types';
import { ITaskListStatusChangeResponse } from '@/types/tasks/task-list-status.types';
import { ITaskListPriorityChangeResponse } from '@/types/tasks/task-list-priority.types';
import { ITaskLabelFilter } from '@/types/tasks/taskLabel.types';
import { labelsApiService } from '@/api/taskAttributes/labels/labels.api.service';

export enum IGroupBy {
  STATUS = 'status',
  PRIORITY = 'priority',
  PHASE = 'phase',
  MEMBERS = 'members',
}

export const GROUP_BY_OPTIONS: IGroupByOption[] = [
  { label: 'Status', value: IGroupBy.STATUS },
  { label: 'Priority', value: IGroupBy.PRIORITY },
  { label: 'Phase', value: IGroupBy.PHASE },
];

const LOCALSTORAGE_GROUP_KEY = 'worklenz.enhanced-kanban.group_by';

export const getCurrentGroup = (): IGroupBy => {
  const key = localStorage.getItem(LOCALSTORAGE_GROUP_KEY);
  if (key && Object.values(IGroupBy).includes(key as IGroupBy)) {
    return key as IGroupBy;
  }
  setCurrentGroup(IGroupBy.STATUS);
  return IGroupBy.STATUS;
};

export const setCurrentGroup = (groupBy: IGroupBy): void => {
  localStorage.setItem(LOCALSTORAGE_GROUP_KEY, groupBy);
};

interface EnhancedKanbanState {
  // Core state
  search: string | null;
  archived: boolean;
  groupBy: IGroupBy;
  isSubtasksInclude: boolean;
  fields: ITaskListSortableColumn[];

  // Task data
  taskGroups: ITaskListGroup[];
  loadingGroups: boolean;
  error: string | null;

  // Filters - Original data (should not be filtered)
  originalTaskAssignees: ITaskListMemberFilter[];
  originalLabels: ITaskLabelFilter[];

  // Filters - Current filtered data
  taskAssignees: ITaskListMemberFilter[];
  loadingAssignees: boolean;
  statuses: ITaskStatusViewModel[];
  labels: ITaskLabelFilter[];
  loadingLabels: boolean;
  priorities: string[];
  members: string[];

  // Performance optimizations
  virtualizedRendering: boolean;
  taskCache: Record<string, IProjectTask>;
  groupCache: Record<string, ITaskListGroup>;

  // Performance monitoring
  performanceMetrics: {
    totalTasks: number;
    largestGroupSize: number;
    averageGroupSize: number;
    renderTime: number;
    lastUpdateTime: number;
    virtualizationEnabled: boolean;
  };

  // Drag and drop state
  dragState: {
    activeTaskId: string | null;
    activeGroupId: string | null;
    overId: string | null;
    isDragging: boolean;
  };

  // UI state
  selectedTaskIds: string[];
  expandedSubtasks: Record<string, boolean>;
  columnOrder: string[];
}

const initialState: EnhancedKanbanState = {
  search: null,
  archived: false,
  groupBy: getCurrentGroup(),
  isSubtasksInclude: false,
  fields: [],
  taskGroups: [],
  loadingGroups: false,
  error: null,
  originalTaskAssignees: [],
  originalLabels: [],
  taskAssignees: [],
  loadingAssignees: false,
  statuses: [],
  labels: [],
  loadingLabels: false,
  priorities: [],
  members: [],
  virtualizedRendering: true,
  taskCache: {},
  groupCache: {},
  performanceMetrics: {
    totalTasks: 0,
    largestGroupSize: 0,
    averageGroupSize: 0,
    renderTime: 0,
    lastUpdateTime: 0,
    virtualizationEnabled: false,
  },
  dragState: {
    activeTaskId: null,
    activeGroupId: null,
    overId: null,
    isDragging: false,
  },
  selectedTaskIds: [],
  expandedSubtasks: {},
  columnOrder: [],
};

// Performance monitoring utility
const calculatePerformanceMetrics = (taskGroups: ITaskListGroup[]) => {
  const totalTasks = taskGroups.reduce((sum, group) => sum + group.tasks.length, 0);
  const groupSizes = taskGroups.map(group => group.tasks.length);
  const largestGroupSize = Math.max(...groupSizes, 0);
  const averageGroupSize = groupSizes.length > 0 ? totalTasks / groupSizes.length : 0;

  return {
    totalTasks,
    largestGroupSize,
    averageGroupSize,
    renderTime: performance.now(),
    lastUpdateTime: Date.now(),
    virtualizationEnabled: largestGroupSize > 50,
  };
};

// Optimized task fetching with caching
export const fetchEnhancedKanbanGroups = createAsyncThunk(
  'enhancedKanban/fetchGroups',
  async (projectId: string, { rejectWithValue, getState }) => {
    try {
      const state = getState() as { enhancedKanbanReducer: EnhancedKanbanState };
      const { enhancedKanbanReducer } = state;
      const selectedMembers = enhancedKanbanReducer.taskAssignees
        .filter(member => member.selected)
        .map(member => member.id)
        .join(' ');

      const selectedLabels = enhancedKanbanReducer.labels
        .filter(label => label.selected)
        .map(label => label.id)
        .join(' ');

      const config: ITaskListConfigV2 = {
        id: projectId,
        archived: enhancedKanbanReducer.archived,
        group: enhancedKanbanReducer.groupBy,
        field: enhancedKanbanReducer.fields.map(field => `${field.key} ${field.sort_order}`).join(','),
        order: '',
        search: enhancedKanbanReducer.search || '',
        statuses: '',
        members: selectedMembers,
        projects: '',
        isSubtasksInclude: enhancedKanbanReducer.isSubtasksInclude,
        labels: selectedLabels,
        priorities: enhancedKanbanReducer.priorities.join(' '),
      };

      const response = await tasksApiService.getTaskList(config);
      return response.body;
    } catch (error) {
      logger.error('Fetch Enhanced Kanban Groups', error);
      if (error instanceof Error) {
        return rejectWithValue(error.message);
      }
      return rejectWithValue('Failed to fetch task groups');
    }
  }
);

// Optimized task reordering
export const reorderEnhancedKanbanTasks = createAsyncThunk(
  'enhancedKanban/reorderTasks',
  async (
    {
      activeGroupId,
      overGroupId,
      fromIndex,
      toIndex,
      task,
      updatedSourceTasks,
      updatedTargetTasks,
    }: {
      activeGroupId: string;
      overGroupId: string;
      fromIndex: number;
      toIndex: number;
      task: IProjectTask;
      updatedSourceTasks: IProjectTask[];
      updatedTargetTasks: IProjectTask[];
    },
    { rejectWithValue }
  ) => {
    try {
      // Optimistic update - return immediately for UI responsiveness
      return {
        activeGroupId,
        overGroupId,
        fromIndex,
        toIndex,
        task,
        updatedSourceTasks,
        updatedTargetTasks,
      };
    } catch (error) {
      logger.error('Reorder Enhanced Kanban Tasks', error);
      return rejectWithValue('Failed to reorder tasks');
    }
  }
);

// Group reordering
export const reorderEnhancedKanbanGroups = createAsyncThunk(
  'enhancedKanban/reorderGroups',
  async (
    {
      fromIndex,
      toIndex,
      reorderedGroups,
    }: {
      fromIndex: number;
      toIndex: number;
      reorderedGroups: ITaskListGroup[];
    },
    { rejectWithValue }
  ) => {
    try {
      // Optimistic update - return immediately for UI responsiveness
      return {
        fromIndex,
        toIndex,
        reorderedGroups,
      };
    } catch (error) {
      logger.error('Reorder Enhanced Kanban Groups', error);
      return rejectWithValue('Failed to reorder groups');
    }
  }
);

export const fetchBoardSubTasks = createAsyncThunk(
  'enhancedKanban/fetchBoardSubTasks',
  async (
    { taskId, projectId }: { taskId: string; projectId: string },
    { rejectWithValue, getState }
  ) => {
    try {
      const state = getState() as { enhancedKanbanReducer: EnhancedKanbanState };
      const { enhancedKanbanReducer } = state;

      // Check if the task is already expanded (optional, can be enhanced later)
      // const task = enhancedKanbanReducer.taskGroups.flatMap(group => group.tasks).find(t => t.id === taskId);
      // if (task?.show_sub_tasks) {
      //   return [];
      // }

      const selectedMembers = enhancedKanbanReducer.taskAssignees
        .filter(member => member.selected)
        .map(member => member.id)
        .join(' ');

      const selectedLabels = enhancedKanbanReducer.labels
        .filter(label => label.selected)
        .map(label => label.id)
        .join(' ');

      const config: ITaskListConfigV2 = {
        id: projectId,
        archived: enhancedKanbanReducer.archived,
        group: enhancedKanbanReducer.groupBy,
        field: enhancedKanbanReducer.fields.map(field => `${field.key} ${field.sort_order}`).join(','),
        order: '',
        search: enhancedKanbanReducer.search || '',
        statuses: '',
        members: selectedMembers,
        projects: '',
        isSubtasksInclude: false,
        labels: selectedLabels,
        priorities: enhancedKanbanReducer.priorities.join(' '),
        parent_task: taskId,
      };

      const response = await tasksApiService.getTaskList(config);
      return response.body;
    } catch (error) {
      logger.error('Fetch Enhanced Board Sub Tasks', error);
      if (error instanceof Error) {
        return rejectWithValue(error.message);
      }
      return rejectWithValue('Failed to fetch sub tasks');
    }
  }
);

// Async thunk for loading task assignees
export const fetchEnhancedKanbanTaskAssignees = createAsyncThunk(
  'enhancedKanban/fetchTaskAssignees',
  async (projectId: string, { rejectWithValue }) => {
    try {
      const response = await tasksApiService.fetchTaskAssignees(projectId);
      return response.body;
    } catch (error) {
      logger.error('Fetch Enhanced Kanban Task Assignees', error);
      if (error instanceof Error) {
        return rejectWithValue(error.message);
      }
      return rejectWithValue('Failed to fetch task assignees');
    }
  }
);

// Async thunk for loading labels
export const fetchEnhancedKanbanLabels = createAsyncThunk(
  'enhancedKanban/fetchLabels',
  async (projectId: string, { rejectWithValue }) => {
    try {
      const response = await labelsApiService.getPriorityByProject(projectId);
      return response.body;
    } catch (error) {
      logger.error('Fetch Enhanced Kanban Labels', error);
      if (error instanceof Error) {
        return rejectWithValue(error.message);
      }
      return rejectWithValue('Failed to fetch project labels');
    }
  }
);

const enhancedKanbanSlice = createSlice({
  name: 'enhancedKanbanReducer',
  initialState,
  reducers: {
    setGroupBy: (state, action: PayloadAction<IGroupBy>) => {
      state.groupBy = action.payload;
      setCurrentGroup(action.payload);
      // Clear caches when grouping changes
      state.taskCache = {};
      state.groupCache = {};
    },

    setSearch: (state, action: PayloadAction<string | null>) => {
      state.search = action.payload;
    },

    setArchived: (state, action: PayloadAction<boolean>) => {
      state.archived = action.payload;
    },

    setVirtualizedRendering: (state, action: PayloadAction<boolean>) => {
      state.virtualizedRendering = action.payload;
    },

    // Optimized drag state management
    setDragState: (state, action: PayloadAction<Partial<EnhancedKanbanState['dragState']>>) => {
      state.dragState = { ...state.dragState, ...action.payload };
    },

    // Task selection
    selectTask: (state, action: PayloadAction<string>) => {
      if (!state.selectedTaskIds.includes(action.payload)) {
        state.selectedTaskIds.push(action.payload);
      }
    },

    deselectTask: (state, action: PayloadAction<string>) => {
      state.selectedTaskIds = state.selectedTaskIds.filter(id => id !== action.payload);
    },

    clearSelection: (state) => {
      state.selectedTaskIds = [];
    },

    // Subtask expansion
    toggleSubtaskExpansion: (state, action: PayloadAction<string>) => {
      const taskId = action.payload;
      if (state.expandedSubtasks[taskId]) {
        delete state.expandedSubtasks[taskId];
      } else {
        state.expandedSubtasks[taskId] = true;
      }
    },

    // Column reordering
    reorderColumns: (state, action: PayloadAction<string[]>) => {
      state.columnOrder = action.payload;
    },

    // Cache management
    updateTaskCache: (state, action: PayloadAction<{ id: string; task: IProjectTask }>) => {
      state.taskCache[action.payload.id] = action.payload.task;
    },

    updateGroupCache: (state, action: PayloadAction<{ id: string; group: ITaskListGroup }>) => {
      state.groupCache[action.payload.id] = action.payload.group;
    },

    clearCaches: (state) => {
      state.taskCache = {};
      state.groupCache = {};
    },

    // Filter management
    setTaskAssignees: (state, action: PayloadAction<ITaskListMemberFilter[]>) => {
      state.taskAssignees = action.payload;
    },

    setLabels: (state, action: PayloadAction<ITaskLabelFilter[]>) => {
      state.labels = action.payload;
    },

    setPriorities: (state, action: PayloadAction<string[]>) => {
      state.priorities = action.payload;
    },

    setMembers: (state, action: PayloadAction<string[]>) => {
      state.members = action.payload;
    },

    // New actions for filter selection that work with original data
    setTaskAssigneeSelection: (state, action: PayloadAction<{ id: string; selected: boolean }>) => {
      const { id, selected } = action.payload;
      // Update both original and current data
      state.originalTaskAssignees = state.originalTaskAssignees.map(assignee =>
        assignee.id === id ? { ...assignee, selected } : assignee
      );
      state.taskAssignees = state.originalTaskAssignees;
    },

    setLabelSelection: (state, action: PayloadAction<{ id: string; selected: boolean }>) => {
      const { id, selected } = action.payload;
      // Update both original and current data
      state.originalLabels = state.originalLabels.map(label =>
        label.id === id ? { ...label, selected } : label
      );
      state.labels = state.originalLabels;
    },

    // Add missing actions for filter compatibility
    setSelectedPriorities: (state, action: PayloadAction<string[]>) => {
      state.priorities = action.payload;
    },

    setBoardSearch: (state, action: PayloadAction<string | null>) => {
      state.search = action.payload;
    },

    setBoardArchived: (state, action: PayloadAction<boolean>) => {
      state.archived = action.payload;
    },

    // Status updates
    updateTaskStatus: (state, action: PayloadAction<ITaskListStatusChangeResponse>) => {
      const { id: task_id, status_id } = action.payload;

      // Update in all groups
      state.taskGroups.forEach(group => {
        group.tasks.forEach(task => {
          if (task.id === task_id) {
            task.status_id = status_id;
            // Update cache
            state.taskCache[task_id] = task;
          }
        });
      });
    },

    updateTaskPriority: (state, action: PayloadAction<ITaskListPriorityChangeResponse>) => {
      const { id: task_id, priority_id } = action.payload;

      // Update in all groups
      state.taskGroups.forEach(group => {
        group.tasks.forEach(task => {
          if (task.id === task_id) {
            task.priority = priority_id;
            // Update cache
            state.taskCache[task_id] = task;
          }
        });
      });
    },

    // Task deletion
    deleteTask: (state, action: PayloadAction<string>) => {
      const taskId = action.payload;

      // Remove from all groups
      state.taskGroups.forEach(group => {
        group.tasks = group.tasks.filter(task => task.id !== taskId);
      });

      // Remove from caches
      delete state.taskCache[taskId];
      state.selectedTaskIds = state.selectedTaskIds.filter(id => id !== taskId);
    },

    // Reset state
    resetState: (state) => {
      return { ...initialState, groupBy: state.groupBy };
    },

    // Synchronous reorder for tasks
    reorderTasks: (state, action: PayloadAction<{
      activeGroupId: string;
      overGroupId: string;
      fromIndex: number;
      toIndex: number;
      task: IProjectTask;
      updatedSourceTasks: IProjectTask[];
      updatedTargetTasks: IProjectTask[];
    }>) => {
      const { activeGroupId, overGroupId, updatedSourceTasks, updatedTargetTasks } = action.payload;
      const sourceGroupIndex = state.taskGroups.findIndex(group => group.id === activeGroupId);
      const targetGroupIndex = state.taskGroups.findIndex(group => group.id === overGroupId);
      if (sourceGroupIndex !== -1) {
        state.taskGroups[sourceGroupIndex].tasks = updatedSourceTasks;
        state.groupCache[activeGroupId] = state.taskGroups[sourceGroupIndex];
      }
      if (targetGroupIndex !== -1 && activeGroupId !== overGroupId) {
        state.taskGroups[targetGroupIndex].tasks = updatedTargetTasks;
        state.groupCache[overGroupId] = state.taskGroups[targetGroupIndex];
      }
    },

    // Synchronous reorder for groups
    reorderGroups: (state, action: PayloadAction<{
      fromIndex: number;
      toIndex: number;
      reorderedGroups: ITaskListGroup[];
    }>) => {
      const { reorderedGroups } = action.payload;
      state.taskGroups = reorderedGroups;
      state.groupCache = reorderedGroups.reduce((cache, group) => {
        cache[group.id] = group;
        return cache;
      }, {} as Record<string, ITaskListGroup>);
      state.columnOrder = reorderedGroups.map(group => group.id);
    },

    addTaskToGroup: (state, action) => {
      const { sectionId, task } = action.payload;
      const group = state.taskGroups.find(g => g.id === sectionId);
      if (group) {
        group.tasks.push(task);
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchEnhancedKanbanGroups.pending, (state) => {
        state.loadingGroups = true;
        state.error = null;
      })
      .addCase(fetchEnhancedKanbanGroups.fulfilled, (state, action) => {
        state.loadingGroups = false;
        state.taskGroups = action.payload;

        // Update performance metrics
        state.performanceMetrics = calculatePerformanceMetrics(action.payload);

        // Update caches
        action.payload.forEach(group => {
          state.groupCache[group.id] = group;
          group.tasks.forEach(task => {
            state.taskCache[task.id!] = task;
          });
        });

        // Initialize column order if not set
        if (state.columnOrder.length === 0) {
          state.columnOrder = action.payload.map(group => group.id);
        }
      })
      .addCase(fetchEnhancedKanbanGroups.rejected, (state, action) => {
        state.loadingGroups = false;
        state.error = action.payload as string;
      })
      .addCase(reorderEnhancedKanbanTasks.fulfilled, (state, action) => {
        const { activeGroupId, overGroupId, updatedSourceTasks, updatedTargetTasks } = action.payload;

        // Update groups
        const sourceGroupIndex = state.taskGroups.findIndex(group => group.id === activeGroupId);
        const targetGroupIndex = state.taskGroups.findIndex(group => group.id === overGroupId);

        if (sourceGroupIndex !== -1) {
          state.taskGroups[sourceGroupIndex].tasks = updatedSourceTasks;
          state.groupCache[activeGroupId] = state.taskGroups[sourceGroupIndex];
        }

        if (targetGroupIndex !== -1 && activeGroupId !== overGroupId) {
          state.taskGroups[targetGroupIndex].tasks = updatedTargetTasks;
          state.groupCache[overGroupId] = state.taskGroups[targetGroupIndex];
        }
      })
      .addCase(reorderEnhancedKanbanGroups.fulfilled, (state, action) => {
        const { fromIndex, toIndex, reorderedGroups } = action.payload;

        // Update groups
        state.taskGroups = reorderedGroups;
        state.groupCache = reorderedGroups.reduce((cache, group) => {
          cache[group.id] = group;
          return cache;
        }, {} as Record<string, ITaskListGroup>);

        // Update column order
        state.columnOrder = reorderedGroups.map(group => group.id);
      })
      // Fetch Task Assignees
      .addCase(fetchEnhancedKanbanTaskAssignees.pending, (state) => {
        state.loadingAssignees = true;
        state.error = null;
      })
      .addCase(fetchEnhancedKanbanTaskAssignees.fulfilled, (state, action) => {
        state.loadingAssignees = false;
        // Store original data and current data
        state.originalTaskAssignees = action.payload;
        state.taskAssignees = action.payload;
      })
      .addCase(fetchEnhancedKanbanTaskAssignees.rejected, (state, action) => {
        state.loadingAssignees = false;
        state.error = action.payload as string;
      })
      // Fetch Labels
      .addCase(fetchEnhancedKanbanLabels.pending, (state) => {
        state.loadingLabels = true;
        state.error = null;
      })
      .addCase(fetchEnhancedKanbanLabels.fulfilled, (state, action) => {
        state.loadingLabels = false;
        // Transform labels to include selected property
        const newLabels = action.payload.map((label: any) => ({ ...label, selected: false }));
        // Store original data and current data
        state.originalLabels = newLabels;
        state.labels = newLabels;
      })
      .addCase(fetchEnhancedKanbanLabels.rejected, (state, action) => {
        state.loadingLabels = false;
        state.error = action.payload as string;
      });
  },
});

export const {
  setGroupBy,
  setSearch,
  setArchived,
  setVirtualizedRendering,
  setDragState,
  selectTask,
  deselectTask,
  clearSelection,
  toggleSubtaskExpansion,
  reorderColumns,
  updateTaskCache,
  updateGroupCache,
  clearCaches,
  setTaskAssignees,
  setLabels,
  setPriorities,
  setMembers,
  setTaskAssigneeSelection,
  setLabelSelection,
  setSelectedPriorities,
  setBoardSearch,
  setBoardArchived,
  updateTaskStatus,
  updateTaskPriority,
  deleteTask,
  resetState,
  reorderTasks,
  reorderGroups,
  addTaskToGroup,
} = enhancedKanbanSlice.actions;

export default enhancedKanbanSlice.reducer; 