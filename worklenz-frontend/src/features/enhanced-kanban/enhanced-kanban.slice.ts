import { createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit';
import {
  IGroupByOption,
  ITaskListConfigV2,
  ITaskListGroup,
  ITaskListSortableColumn,
} from '@/types/tasks/taskList.types';
import { tasksApiService } from '@/api/tasks/tasks.api.service';
import { subTasksApiService } from '@/api/tasks/subtasks.api.service';
import logger from '@/utils/errorLogger';
import { ITaskListMemberFilter } from '@/types/tasks/taskListFilters.types';
import { IProjectTask } from '@/types/project/projectTasksViewModel.types';
import { ITaskStatusViewModel } from '@/types/tasks/taskStatusGetResponse.types';
import { ITaskListStatusChangeResponse } from '@/types/tasks/task-list-status.types';
import { ITaskListPriorityChangeResponse } from '@/types/tasks/task-list-priority.types';
import { ITaskLabelFilter } from '@/types/tasks/taskLabel.types';
import { labelsApiService } from '@/api/taskAttributes/labels/labels.api.service';
import { ITaskAssigneesUpdateResponse } from '@/types/tasks/task-assignee-update-response';
import { ITaskAssignee } from '@/types/project/projectTasksViewModel.types';
import { InlineMember } from '@/types/teamMembers/inlineMember.types';
import { ILabelsChangeResponse } from '@/types/tasks/taskList.types';

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

const LOCALSTORAGE_GROUP_KEY = 'worklenz.kanban.group_by';

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
  editableSectionId: string | null;
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
  editableSectionId: null,
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
        field: enhancedKanbanReducer.fields
          .map(field => `${field.key} ${field.sort_order}`)
          .join(','),
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
      // Use the dedicated subtasks API endpoint
      const response = await subTasksApiService.getSubTasks(taskId);
      return response.body || [];
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

// Helper functions for common operations (similar to board-slice.ts)
const findTaskInAllGroups = (
  taskGroups: ITaskListGroup[],
  taskId: string
): { task: IProjectTask; group: ITaskListGroup; groupId: string } | null => {
  for (const group of taskGroups) {
    const task = group.tasks.find(t => t.id === taskId);
    if (task) return { task, group, groupId: group.id };

    // Check in subtasks
    for (const parentTask of group.tasks) {
      if (!parentTask.sub_tasks) continue;
      const subtask = parentTask.sub_tasks.find(st => st.id === taskId);
      if (subtask) return { task: subtask, group, groupId: group.id };
    }
  }
  return null;
};

const deleteTaskFromGroup = (
  taskGroups: ITaskListGroup[],
  task: IProjectTask,
  groupId: string,
  index: number | null = null
): void => {
  const group = taskGroups.find(g => g.id === groupId);
  if (!group || !task.id) return;

  if (task.is_sub_task) {
    const parentTask = group.tasks.find(t => t.id === task.parent_task_id);
    if (parentTask) {
      const subTaskIndex = parentTask.sub_tasks?.findIndex(t => t.id === task.id);
      if (typeof subTaskIndex !== 'undefined' && subTaskIndex !== -1) {
        parentTask.sub_tasks_count = Math.max((parentTask.sub_tasks_count || 0) - 1, 0);
        parentTask.sub_tasks?.splice(subTaskIndex, 1);
      }
    }
  } else {
    const taskIndex = index ?? group.tasks.findIndex(t => t.id === task.id);
    if (taskIndex !== -1) {
      group.tasks.splice(taskIndex, 1);
    }
  }
};

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

    clearSelection: state => {
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

    clearCaches: state => {
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

    // Enhanced Kanban external status update (for use in task drawer dropdown)
    updateEnhancedKanbanTaskStatus: (
      state,
      action: PayloadAction<ITaskListStatusChangeResponse>
    ) => {
      const {
        id: task_id,
        status_id,
        color_code,
        color_code_dark,
        complete_ratio,
        statusCategory,
      } = action.payload;
      let oldGroupId: string | null = null;
      let foundTask: IProjectTask | null = null;
      // Find the task and its group
      for (const group of state.taskGroups) {
        const task = group.tasks.find(t => t.id === task_id);
        if (task) {
          foundTask = task;
          oldGroupId = group.id;
          break;
        }
      }
      if (!foundTask) return;

      // Update the task properties
      foundTask.status_color = color_code;
      foundTask.status_color_dark = color_code_dark;
      foundTask.complete_ratio = +complete_ratio;
      foundTask.status = status_id;
      foundTask.status_category = statusCategory;

      // If grouped by status and the group changes, move the task
      if (state.groupBy === IGroupBy.STATUS && oldGroupId && oldGroupId !== status_id) {
        // Remove from old group
        const oldGroup = state.taskGroups.find(g => g.id === oldGroupId);
        if (oldGroup) {
          oldGroup.tasks = oldGroup.tasks.filter(t => t.id !== task_id);
        }
        // Add to new group at the top
        const newGroup = state.taskGroups.find(g => g.id === status_id);
        if (newGroup) {
          foundTask.status_id = status_id;
          newGroup.tasks.unshift(foundTask);
        }
      } else {
        // Just update the status_id
        foundTask.status_id = status_id;
      }
      // Update cache
      state.taskCache[task_id] = foundTask;
    },

    // Enhanced Kanban priority update (for use in task drawer dropdown)
    updateEnhancedKanbanTaskPriority: (
      state,
      action: PayloadAction<ITaskListPriorityChangeResponse>
    ) => {
      const { id, priority_id, color_code, color_code_dark } = action.payload;
      // Find the task in any group
      const taskInfo = findTaskInAllGroups(state.taskGroups, id);
      if (!taskInfo || !priority_id) return;

      const { task, groupId } = taskInfo;

      // Update the task properties
      task.priority = priority_id;
      task.priority_color = color_code;
      task.priority_color_dark = color_code_dark;

      // If grouped by priority and not a subtask, move the task to the new priority group
      if (state.groupBy === IGroupBy.PRIORITY && !task.is_sub_task && groupId !== priority_id) {
        // Remove from current group
        deleteTaskFromGroup(state.taskGroups, task, groupId);

        // Add to new priority group
        const newGroup = state.taskGroups.find(g => g.id === priority_id);
        if (newGroup) {
          newGroup.tasks.unshift(task);
          state.groupCache[priority_id] = newGroup;
        }
      }

      // Update cache
      state.taskCache[id] = task;
    },
    // Enhanced Kanban assignee update (for use in task drawer dropdown)
    updateEnhancedKanbanTaskAssignees: (
      state,
      action: PayloadAction<ITaskAssigneesUpdateResponse>
    ) => {
      const { id, assignees, names } = action.payload;

      // Find the task in any group
      const taskInfo = findTaskInAllGroups(state.taskGroups, id);
      if (!taskInfo) return;

      const { task } = taskInfo;

      // Update the task properties
      task.assignees = assignees as ITaskAssignee[];
      task.names = names as InlineMember[];

      // Update cache
      state.taskCache[id] = task;
    },

    // Enhanced Kanban label update (for use in task drawer dropdown)
    updateEnhancedKanbanTaskLabels: (state, action: PayloadAction<ILabelsChangeResponse>) => {
      const label = action.payload;
      for (const group of state.taskGroups) {
        // Find the task or its subtask
        const task =
          group.tasks.find(task => task.id === label.id) ||
          group.tasks
            .flatMap(task => task.sub_tasks || [])
            .find(subtask => subtask.id === label.id);
        if (task) {
          task.labels = label.labels || [];
          task.all_labels = label.all_labels || [];
          // Update cache
          state.taskCache[label.id] = task;
          break;
        }
      }
    },

    // Enhanced Kanban progress update (for use in task drawer and socket events)
    updateEnhancedKanbanTaskProgress: (
      state,
      action: PayloadAction<{
        id: string;
        complete_ratio: number;
        completed_count: number;
        total_tasks_count: number;
        parent_task: string;
      }>
    ) => {
      const { id, complete_ratio, completed_count, total_tasks_count, parent_task } =
        action.payload;

      // Find the task in any group
      const taskInfo = findTaskInAllGroups(state.taskGroups, parent_task || id);

      // Check if taskInfo exists before destructuring
      if (!taskInfo) return;

      const { task } = taskInfo;

      // Update the task properties
      task.complete_ratio = +complete_ratio;
      task.completed_count = completed_count;
      task.total_tasks_count = total_tasks_count;

      // Update cache
      state.taskCache[parent_task || id] = task;
    },

    // Enhanced Kanban task name update (for use in task drawer header)
    updateEnhancedKanbanTaskName: (
      state,
      action: PayloadAction<{
        task: IProjectTask;
      }>
    ) => {
      const { task } = action.payload;

      // Find the task and update it
      const result = findTaskInAllGroups(state.taskGroups, task.id || '');
      if (result) {
        result.task.name = task.name;
        // Update cache
        state.taskCache[task.id!] = result.task;
      }
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
    resetState: state => {
      return { ...initialState, groupBy: state.groupBy };
    },

    // Synchronous reorder for tasks
    reorderTasks: (
      state,
      action: PayloadAction<{
        activeGroupId: string;
        overGroupId: string;
        fromIndex: number;
        toIndex: number;
        task: IProjectTask;
        updatedSourceTasks: IProjectTask[];
        updatedTargetTasks: IProjectTask[];
      }>
    ) => {
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
    reorderGroups: (
      state,
      action: PayloadAction<{
        fromIndex: number;
        toIndex: number;
        reorderedGroups: ITaskListGroup[];
      }>
    ) => {
      const { reorderedGroups } = action.payload;
      state.taskGroups = reorderedGroups;
      state.groupCache = reorderedGroups.reduce(
        (cache, group) => {
          cache[group.id] = group;
          return cache;
        },
        {} as Record<string, ITaskListGroup>
      );
      state.columnOrder = reorderedGroups.map(group => group.id);
    },

    addTaskToGroup: (state, action) => {
      const { sectionId, task } = action.payload;
      const group = state.taskGroups.find(g => g.id === sectionId);
      if (group) {
        group.tasks.push(task);
        // Update cache
        state.taskCache[task.id!] = task;
        state.groupCache[sectionId] = group;
      }
    },

    // Enhanced Kanban end date update (for use in task drawer and socket events)
    updateEnhancedKanbanTaskEndDate: (
      state,
      action: PayloadAction<{
        task: IProjectTask;
      }>
    ) => {
      const { task } = action.payload;

      // Find the task and update it
      const result = findTaskInAllGroups(state.taskGroups, task.id || '');
      if (result) {
        result.task.end_date = task.end_date;
        // Update cache
        state.taskCache[task.id!] = result.task;
      }
    },

    // Enhanced Kanban start date update (for use in task drawer and socket events)
    updateEnhancedKanbanTaskStartDate: (
      state,
      action: PayloadAction<{
        task: IProjectTask;
      }>
    ) => {
      const { task } = action.payload;

      // Find the task and update it
      const result = findTaskInAllGroups(state.taskGroups, task.id || '');
      if (result) {
        result.task.start_date = task.start_date;
        // Update cache
        state.taskCache[task.id!] = result.task;
      }
    },

    // Enhanced Kanban task expansion toggle (for subtask expand/collapse)
    toggleTaskExpansion: (state, action: PayloadAction<string>) => {
      const taskId = action.payload;
      const result = findTaskInAllGroups(state.taskGroups, taskId);

      if (result) {
        result.task.show_sub_tasks = !result.task.show_sub_tasks;
        // Update cache
        state.taskCache[taskId] = result.task;
      }
    },

    // Enhanced Kanban subtask update (for use in task drawer and socket events)
    updateEnhancedKanbanSubtask: (
      state,
      action: PayloadAction<{
        sectionId: string;
        subtask: IProjectTask;
        mode: 'add' | 'delete';
      }>
    ) => {
      const { sectionId, subtask, mode } = action.payload;
      const parentTaskId = subtask?.parent_task_id || null;

      if (!parentTaskId) return;

      // Function to update a task with a new subtask
      const updateTaskWithSubtask = (task: IProjectTask): boolean => {
        if (!task) return false;

        // Initialize sub_tasks array if it doesn't exist
        if (!task.sub_tasks) {
          task.sub_tasks = [];
        }

        if (mode === 'add') {
          // Increment subtask count
          task.sub_tasks_count = (task.sub_tasks_count || 0) + 1;

          // Add the subtask
          task.sub_tasks.push({ ...subtask });
        } else {
          // Remove the subtask
          task.sub_tasks = task.sub_tasks.filter(t => t.id !== subtask.id);
          task.sub_tasks_count = Math.max(0, (task.sub_tasks_count || 1) - 1);
        }

        // Update cache
        state.taskCache[task.id!] = task;
        return true;
      };

      // First try to find the task in the specified section
      if (sectionId) {
        const section = state.taskGroups.find(sec => sec.id === sectionId);
        if (section) {
          const task = section.tasks.find(task => task.id === parentTaskId);
          if (task && updateTaskWithSubtask(task)) {
            // Update group cache
            state.groupCache[sectionId] = section;
            return;
          }
        }
      }

      // If not found in the specified section, try all groups
      const result = findTaskInAllGroups(state.taskGroups, parentTaskId);
      if (result) {
        updateTaskWithSubtask(result.task);
        // Update group cache
        state.groupCache[result.groupId] = result.group;
      }
    },

    setEditableSection: (state, action: PayloadAction<string | null>) => {
      state.editableSectionId = action.payload;
    },

    deleteSection: (state, action: PayloadAction<{ sectionId: string }>) => {
      state.taskGroups = state.taskGroups.filter(
        section => section.id !== action.payload.sectionId
      );
      if (state.editableSectionId === action.payload.sectionId) {
        state.editableSectionId = null;
      }
    },
  },
  extraReducers: builder => {
    builder
      .addCase(fetchEnhancedKanbanGroups.pending, state => {
        state.loadingGroups = true;
        state.error = null;
      })
      .addCase(fetchEnhancedKanbanGroups.fulfilled, (state, action) => {
        state.loadingGroups = false;
        state.taskGroups = action.payload;

        // Update performance metrics
        state.performanceMetrics = calculatePerformanceMetrics(action.payload);

        // Update caches and initialize subtask properties
        action.payload.forEach(group => {
          state.groupCache[group.id] = group;
          group.tasks.forEach(task => {
            // Initialize subtask-related properties if they don't exist
            if (task.sub_tasks === undefined) {
              task.sub_tasks = [];
            }
            if (task.sub_tasks_loading === undefined) {
              task.sub_tasks_loading = false;
            }
            if (task.show_sub_tasks === undefined) {
              task.show_sub_tasks = false;
            }
            if (task.sub_tasks_count === undefined) {
              task.sub_tasks_count = 0;
            }

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
        const { activeGroupId, overGroupId, updatedSourceTasks, updatedTargetTasks } =
          action.payload;

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
        state.groupCache = reorderedGroups.reduce(
          (cache, group) => {
            cache[group.id] = group;
            return cache;
          },
          {} as Record<string, ITaskListGroup>
        );

        // Update column order
        state.columnOrder = reorderedGroups.map(group => group.id);
      })
      // Fetch Task Assignees
      .addCase(fetchEnhancedKanbanTaskAssignees.pending, state => {
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
      .addCase(fetchEnhancedKanbanLabels.pending, state => {
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
      })
      // Fetch Board Sub Tasks
      .addCase(fetchBoardSubTasks.pending, (state, action) => {
        state.error = null;
        // Find the task and set sub_tasks_loading to true
        const taskId = action.meta.arg.taskId;
        const result = findTaskInAllGroups(state.taskGroups, taskId);
        if (result) {
          result.task.sub_tasks_loading = true;
        }
      })
      .addCase(fetchBoardSubTasks.fulfilled, (state, action: PayloadAction<IProjectTask[]>) => {
        const taskId = (action as any).meta?.arg?.taskId;
        const result = findTaskInAllGroups(state.taskGroups, taskId);

        if (result) {
          result.task.sub_tasks_loading = false;
          result.task.sub_tasks = action.payload;
          result.task.show_sub_tasks = true;

          // Only update the count if we don't have a count yet or if the API returned a different count
          // This preserves the original count from the initial data load
          if (!result.task.sub_tasks_count || result.task.sub_tasks_count === 0) {
            result.task.sub_tasks_count = action.payload.length;
          }

          // Update cache
          state.taskCache[taskId] = result.task;
        }
      })
      .addCase(fetchBoardSubTasks.rejected, (state, action) => {
        state.error = action.error.message || 'Failed to fetch sub tasks';
        // Set loading to false on rejection
        const taskId = action.meta.arg.taskId;
        const result = findTaskInAllGroups(state.taskGroups, taskId);
        if (result) {
          result.task.sub_tasks_loading = false;
          // Update cache
          state.taskCache[taskId] = result.task;
        }
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
  updateEnhancedKanbanTaskStatus,
  updateEnhancedKanbanTaskPriority,
  updateEnhancedKanbanTaskAssignees,
  updateEnhancedKanbanTaskLabels,
  updateEnhancedKanbanTaskProgress,
  updateEnhancedKanbanTaskName,
  updateEnhancedKanbanTaskEndDate,
  updateEnhancedKanbanTaskStartDate,
  updateEnhancedKanbanSubtask,
  toggleTaskExpansion,
  setEditableSection,
  deleteSection,
} = enhancedKanbanSlice.actions;

export default enhancedKanbanSlice.reducer;
