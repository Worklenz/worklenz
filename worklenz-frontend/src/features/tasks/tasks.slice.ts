import { createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit';
import {
  IGroupByOption,
  ILabelsChangeResponse,
  ITaskListColumn,
  ITaskListConfigV2,
  ITaskListGroup,
  ITaskListSortableColumn,
} from '@/types/tasks/taskList.types';
import { tasksApiService } from '@/api/tasks/tasks.api.service';
import logger from '@/utils/errorLogger';
import { ITaskListMemberFilter } from '@/types/tasks/taskListFilters.types';
import { ITaskAssignee, ITaskFormViewModel } from '@/types/tasks/task.types';
import { ITeamMemberViewModel } from '@/types/teamMembers/teamMembersGetResponse.types';
import { IProjectTask } from '@/types/project/projectTasksViewModel.types';
import { ITaskStatusViewModel } from '@/types/tasks/taskStatusGetResponse.types';
import { ITaskListStatusChangeResponse } from '@/types/tasks/task-list-status.types';
import { ITaskListPriorityChangeResponse } from '@/types/tasks/task-list-priority.types';
import { labelsApiService } from '@/api/taskAttributes/labels/labels.api.service';
import { ITaskLabel, ITaskLabelFilter } from '@/types/tasks/taskLabel.types';
import { ITaskPhaseChangeResponse } from '@/types/tasks/task-phase-change-response';
import { produce } from 'immer';
import { tasksCustomColumnsService } from '@/api/tasks/tasks-custom-columns.service';
import { SocketEvents } from '@/shared/socket-events';
import { ITaskRecurringScheduleData } from '@/types/tasks/task-recurring-schedule';

export enum IGroupBy {
  STATUS = 'status',
  PRIORITY = 'priority',
  PHASE = 'phase',
  MEMBERS = 'members',
}

export const GROUP_BY_STATUS_VALUE = IGroupBy.STATUS;
export const GROUP_BY_PRIORITY_VALUE = IGroupBy.PRIORITY;
export const GROUP_BY_PHASE_VALUE = IGroupBy.PHASE;

export const GROUP_BY_OPTIONS: IGroupByOption[] = [
  { label: 'Status', value: GROUP_BY_STATUS_VALUE },
  { label: 'Priority', value: GROUP_BY_PRIORITY_VALUE },
  { label: 'Phase', value: GROUP_BY_PHASE_VALUE },
];

const LOCALSTORAGE_GROUP_KEY = 'worklenz.tasklist.group_by';

export const getCurrentGroup = (): IGroupByOption => {
  const key = localStorage.getItem(LOCALSTORAGE_GROUP_KEY);
  if (key) {
    const group = GROUP_BY_OPTIONS.find(option => option.value === key);
    if (group) return group;
  }
  setCurrentGroup(GROUP_BY_STATUS_VALUE);
  return GROUP_BY_OPTIONS[0];
};

export const setCurrentGroup = (groupBy: IGroupBy): void => {
  localStorage.setItem(LOCALSTORAGE_GROUP_KEY, groupBy);
};

interface ITaskState {
  search: string | null;
  archived: boolean;
  groupBy: IGroupBy;
  isSubtasksInclude: boolean;
  fields: ITaskListSortableColumn[];
  tasks: IProjectTask[];
  taskGroups: ITaskListGroup[];
  loadingColumns: boolean;
  columns: ITaskListColumn[];
  loadingGroups: boolean;
  error: string | null;
  taskAssignees: ITaskListMemberFilter[];
  loadingAssignees: boolean;
  statuses: ITaskStatusViewModel[];
  loadingLabels: boolean;
  labels: ITaskLabelFilter[];
  priorities: string[];
  members: string[];
  activeTimers: Record<string, number | null>;
  convertToSubtaskDrawerOpen: boolean;
  customColumns: ITaskListColumn[];
  customColumnValues: Record<string, Record<string, any>>;
  allTasks: IProjectTask[];
  grouping: string;
  totalTasks: number;
}

const initialState: ITaskState = {
  search: null,
  archived: false,
  groupBy: getCurrentGroup().value as IGroupBy,
  isSubtasksInclude: false,
  fields: [],
  tasks: [],
  loadingColumns: false,
  columns: [],
  taskGroups: [],
  loadingGroups: false,
  error: null,
  taskAssignees: [],
  loadingAssignees: false,
  statuses: [],
  labels: [],
  loadingLabels: false,
  priorities: [],
  members: [],
  activeTimers: {},
  convertToSubtaskDrawerOpen: false,
  customColumns: [],
  customColumnValues: {},
  allTasks: [],
  grouping: '',
  totalTasks: 0,
};

export const COLUMN_KEYS = {
  KEY: 'KEY',
  NAME: 'NAME',
  DESCRIPTION: 'DESCRIPTION',
  PROGRESS: 'PROGRESS',
  ASSIGNEES: 'ASSIGNEES',
  LABELS: 'LABELS',
  STATUS: 'STATUS',
  PRIORITY: 'PRIORITY',
  TIME_TRACKING: 'TIME_TRACKING',
  ESTIMATION: 'ESTIMATION',
  START_DATE: 'START_DATE',
  DUE_DATE: 'DUE_DATE',
  DUE_TIME: 'DUE_TIME',
  COMPLETED_DATE: 'COMPLETED_DATE',
  CREATED_DATE: 'CREATED_DATE',
  LAST_UPDATED: 'LAST_UPDATED',
  REPORTER: 'REPORTER',
  PHASE: 'PHASE',
} as const;

export const COLUMN_KEYS_LIST = Object.values(COLUMN_KEYS).map(key => ({
  key,
  show: true,
}));

export const fetchTaskGroups = createAsyncThunk(
  'tasks/fetchTaskGroups',
  async (projectId: string, { rejectWithValue, getState }) => {
    try {
      const state = getState() as { taskReducer: ITaskState };
      const { taskReducer } = state;

      const selectedMembers = taskReducer.taskAssignees
        .filter(member => member.selected)
        .map(member => member.id)
        .join(' ');

      const selectedLabels = taskReducer.labels
        .filter(label => label.selected)
        .map(label => label.id)
        .join(' ');

      const config: ITaskListConfigV2 = {
        id: projectId,
        archived: taskReducer.archived,
        group: taskReducer.groupBy,
        field: taskReducer.fields.map(field => `${field.key} ${field.sort_order}`).join(','),
        order: '',
        search: taskReducer.search || '',
        statuses: '',
        members: selectedMembers,
        projects: '',
        isSubtasksInclude: false,
        labels: selectedLabels,
        priorities: taskReducer.priorities.join(' '),
      };

      const response = await tasksApiService.getTaskListV3(config);
      return response.body;
    } catch (error) {
      logger.error('Fetch Task Groups', error);
      if (error instanceof Error) {
        return rejectWithValue(error.message);
      }
      return rejectWithValue('Failed to fetch task groups');
    }
  }
);

export const fetchSubTasks = createAsyncThunk(
  'tasks/fetchSubTasks',
  async (
    { taskId, projectId }: { taskId: string; projectId: string },
    { rejectWithValue, getState, dispatch }
  ) => {
    const state = getState() as { taskReducer: ITaskState };
    const { taskReducer } = state;

    // Check if the task is already expanded
    const task = taskReducer.taskGroups.flatMap(group => group.tasks).find(t => t.id === taskId);

    if (task?.show_sub_tasks) {
      // If already expanded, just return without fetching
      return [];
    }

    // Request subtask progress data when expanding the task
    // This will trigger the socket to emit TASK_PROGRESS_UPDATED events for all subtasks
    try {
      // Get access to the socket from the state
      const socket = (getState() as any).socketReducer?.socket;
      if (socket?.connected) {
        // Request subtask count and progress information
        socket.emit(SocketEvents.GET_TASK_SUBTASKS_COUNT.toString(), taskId);
      }
    } catch (error) {
      console.error('Error requesting subtask progress:', error);
      // Non-critical error, continue with fetching subtasks
    }

    const selectedMembers = taskReducer.taskAssignees
      .filter(member => member.selected)
      .map(member => member.id)
      .join(' ');

    const selectedLabels = taskReducer.labels
      .filter(label => label.selected)
      .map(label => label.id)
      .join(' ');

    const config: ITaskListConfigV2 = {
      id: projectId,
      archived: taskReducer.archived,
      group: taskReducer.groupBy,
      field: taskReducer.fields.map(field => `${field.key} ${field.sort_order}`).join(','),
      order: '',
      search: taskReducer.search || '',
      statuses: '',
      members: selectedMembers,
      projects: '',
      isSubtasksInclude: false,
      labels: selectedLabels,
      priorities: taskReducer.priorities.join(' '),
      parent_task: taskId,
    };
    try {
      const response = await tasksApiService.getTaskListV3(config);
      // Only expand if we actually fetched subtasks
      if (response.body && response.body.groups && response.body.groups.length > 0) {
        dispatch(toggleTaskRowExpansion(taskId));
      }
      return response.body;
    } catch (error) {
      logger.error('Fetch Sub Tasks', error);
      if (error instanceof Error) {
        return rejectWithValue(error.message);
      }
      return rejectWithValue('Failed to fetch sub tasks');
    }
  }
);

export const fetchTaskListColumns = createAsyncThunk(
  'tasks/fetTaskListColumns',
  async (projectId: string, { dispatch }) => {
    const [standardColumns, customColumns] = await Promise.all([
      tasksApiService.fetchTaskListColumns(projectId),
      dispatch(fetchCustomColumns(projectId)),
    ]);

    return {
      standard: standardColumns.body,
      custom: customColumns.payload,
    };
  }
);

export const fetchTaskAssignees = createAsyncThunk(
  'tasks/fetchTaskAssignees',
  async (projectId: string, { rejectWithValue }) => {
    try {
      const response = await tasksApiService.fetchTaskAssignees(projectId);
      return response.body;
    } catch (error) {
      logger.error('Fetch Task Assignees', error);
      if (error instanceof Error) {
        return rejectWithValue(error.message);
      }
      return rejectWithValue('Failed to fetch task assignees');
    }
  }
);

export const fetchLabelsByProject = createAsyncThunk(
  'taskLabel/fetchLabelsByProject',
  async (projectId: string, { rejectWithValue }) => {
    try {
      const response = await labelsApiService.getPriorityByProject(projectId);
      return response.body;
    } catch (error) {
      logger.error('Fetch Labels By Project', error);
      if (error instanceof Error) {
        return rejectWithValue(error.message);
      }
      return rejectWithValue('Failed to fetch project labels');
    }
  }
);

export const fetchTask = createAsyncThunk(
  'tasks/fetchTask',
  async ({ taskId, projectId }: { taskId: string; projectId: string }, { rejectWithValue }) => {
    try {
      const response = await tasksApiService.getFormViewModel(taskId, projectId);
      return response.body;
    } catch (error) {
      logger.error('Fetch Task', error);
      if (error instanceof Error) {
        return rejectWithValue(error.message);
      }
      return rejectWithValue('Failed to fetch task');
    }
  }
);

export const updateColumnVisibility = createAsyncThunk(
  'tasks/updateColumnVisibility',
  async (
    { projectId, item }: { projectId: string; item: ITaskListColumn },
    { rejectWithValue }
  ) => {
    try {
      const response = await tasksApiService.toggleColumnVisibility(projectId, item);
      return response.body;
    } catch (error) {
      logger.error('Update Column Visibility', error);
      if (error instanceof Error) {
        return rejectWithValue(error.message);
      }
      return rejectWithValue('Failed to update column visibility');
    }
  }
);

const getGroupIdByGroupedColumn = (task: IProjectTask): string | null => {
  const groupBy = getCurrentGroup().value;
  switch (groupBy) {
    case GROUP_BY_STATUS_VALUE:
      return task.status as string;
    case GROUP_BY_PRIORITY_VALUE:
      return task.priority as string;
    case GROUP_BY_PHASE_VALUE:
      return task.phase_id as string;
    default:
      return null;
  }
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

const addTaskToGroup = (
  taskGroups: ITaskListGroup[],
  task: IProjectTask,
  groupId: string,
  insert = false
): void => {
  const group = taskGroups.find(g => g.id === groupId);
  if (!group || !task.id) return;

  if (task.parent_task_id) {
    const parentTask = group.tasks.find(t => t.id === task.parent_task_id);
    if (parentTask) {
      parentTask.sub_tasks_count = (parentTask.sub_tasks_count || 0) + 1;
      if (!parentTask.sub_tasks) parentTask.sub_tasks = [];
      parentTask.sub_tasks.push({ ...task });
    }
  } else {
    insert ? group.tasks.push(task) : group.tasks.unshift(task);
  }
};

const updateTaskGroup = (taskGroups: ITaskListGroup[], task: IProjectTask, insert = true): void => {
  if (!task.id) return;

  const groupId = getGroupIdByGroupedColumn(task);
  if (groupId) {
    deleteTaskFromGroup(taskGroups, task, groupId);
    addTaskToGroup(taskGroups, { ...task }, groupId, insert);
  }
};

const findTaskInGroups = (
  taskGroups: ITaskListGroup[],
  taskId: string
): { task: IProjectTask; groupId: string; index: number } | null => {
  for (const group of taskGroups) {
    // Check main tasks
    const taskIndex = group.tasks.findIndex(t => t.id === taskId);
    if (taskIndex !== -1) {
      return { task: group.tasks[taskIndex], groupId: group.id, index: taskIndex };
    }

    // Check subtasks
    for (const task of group.tasks) {
      if (task.sub_tasks) {
        const subTaskIndex = task.sub_tasks.findIndex(subtask => subtask.id === taskId);
        if (subTaskIndex !== -1) {
          return { task: task.sub_tasks[subTaskIndex], groupId: group.id, index: subTaskIndex };
        }
      }
    }
  }
  return null;
};

export const fetchCustomColumns = createAsyncThunk(
  'tasks/fetchCustomColumns',
  async (projectId: string, { rejectWithValue }) => {
    try {
      const response = await tasksCustomColumnsService.getCustomColumns(projectId);
      return response.body;
    } catch (error) {
      logger.error('Fetch Custom Columns', error);
      if (error instanceof Error) {
        return rejectWithValue(error.message);
      }
      return rejectWithValue('Failed to fetch custom columns');
    }
  }
);

const taskSlice = createSlice({
  name: 'taskReducer',
  initialState,
  reducers: {
    toggleArchived: state => {
      state.archived = !state.archived;
    },

    setGroup: (state, action: PayloadAction<IGroupBy>) => {
      state.groupBy = action.payload;
      setCurrentGroup(action.payload);
    },

    setLabels: (state, action: PayloadAction<ITaskLabel[]>) => {
      state.labels = action.payload;
    },

    setMembers: (state, action: PayloadAction<ITaskListMemberFilter[]>) => {
      state.taskAssignees = action.payload;
    },

    setPriorities: (state, action: PayloadAction<string[]>) => {
      state.priorities = action.payload;
    },

    setStatuses: (state, action: PayloadAction<ITaskStatusViewModel[]>) => {
      state.statuses = action.payload;
    },

    setFields: (state, action: PayloadAction<ITaskListSortableColumn[]>) => {
      state.fields = action.payload;
    },

    setSearch: (state, action: PayloadAction<string>) => {
      state.search = action.payload;
    },

    setConvertToSubtaskDrawerOpen: (state, action: PayloadAction<boolean>) => {
      state.convertToSubtaskDrawerOpen = action.payload;
    },

    addTask: (
      state,
      action: PayloadAction<{
        task: IProjectTask;
        groupId: string;
        insert?: boolean;
      }>
    ) => {
      const { task, groupId, insert = false } = action.payload;
      const group = state.taskGroups.find(g => g.id === groupId);
      if (!group || !task.id) return;

      // Handle subtask addition
      if (task.parent_task_id) {
        const parentTask = group.tasks.find(t => t.id === task.parent_task_id);
        // if (parentTask) {
        // if (!parentTask.sub_tasks) parentTask.sub_tasks = [];
        // parentTask.sub_tasks.push({ ...task });
        // parentTask.sub_tasks_count = parentTask.sub_tasks.length; // Update the sub_tasks_count based on the actual length
        // Ensure sub-tasks are visible when adding a new one
        // parentTask.show_sub_tasks = true;
        // }
      } else {
        // Handle main task addition
        if (insert) {
          group.tasks.push(task);
        } else {
          group.tasks.unshift(task);
        }
      }
    },

    deleteTask: (
      state,
      action: PayloadAction<{
        taskId: string;
        index?: number | null;
      }>
    ) => {
      const { taskId, index } = action.payload;

      for (const group of state.taskGroups) {
        // Try to find task in subtasks first
        let found = false;
        for (const parentTask of group.tasks) {
          if (parentTask.sub_tasks) {
            const subTaskIndex = parentTask.sub_tasks.findIndex(st => st.id === taskId);
            if (subTaskIndex !== -1) {
              parentTask.sub_tasks.splice(subTaskIndex, 1);
              parentTask.sub_tasks_count = Math.max((parentTask.sub_tasks_count || 0) - 1, 0);
              found = true;
              break;
            }
          }
        }
        if (found) break;

        // If not found in subtasks, try main tasks
        const taskIndex = index ?? group.tasks.findIndex(t => t.id === taskId);
        if (taskIndex !== -1) {
          group.tasks.splice(taskIndex, 1);
          break;
        }
      }
    },

    updateTaskName: (
      state,
      action: PayloadAction<{ id: string; parent_task: string; name: string }>
    ) => {
      const { id, name } = action.payload;

      for (const group of state.taskGroups) {
        // Check main tasks
        const task = group.tasks.find(task => task.id === id);
        if (task) {
          task.name = name;
          break;
        }

        // Check subtasks
        for (const task of group.tasks) {
          if (task.sub_tasks) {
            const subTask = task.sub_tasks.find(subtask => subtask.id === id);
            if (subTask) {
              subTask.name = name;
              break;
            }
          }
        }
      }
    },

    updateTaskProgress: (
      state,
      action: PayloadAction<{
        taskId: string;
        progress: number;
        totalTasksCount: number;
        completedCount: number;
      }>
    ) => {
      const { taskId, progress, totalTasksCount, completedCount } = action.payload;

      // Helper function to find and update a task at any nesting level
      const findAndUpdateTask = (tasks: IProjectTask[]) => {
        for (const task of tasks) {
          if (task.id === taskId) {
            task.complete_ratio = progress;
            task.progress_value = progress;
            task.total_tasks_count = totalTasksCount;
            task.completed_count = completedCount;
            return true;
          }

          // Check subtasks if they exist
          if (task.sub_tasks && task.sub_tasks.length > 0) {
            const found = findAndUpdateTask(task.sub_tasks);
            if (found) return true;
          }
        }
        return false;
      };

      // Try to find and update the task in any task group
      for (const group of state.taskGroups) {
        const found = findAndUpdateTask(group.tasks);
        if (found) break;
      }
    },

    updateTaskAssignees: (
      state,
      action: PayloadAction<{
        groupId: string;
        taskId: string;
        assignees: ITeamMemberViewModel[];
      }>
    ) => {
      const { groupId, taskId, assignees } = action.payload;
      const group = state.taskGroups.find(group => group.id === groupId);
      if (!group) return;

      // Try to find the task in main tasks first
      const mainTask = group.tasks.find(task => task.id === taskId);
      if (mainTask) {
        mainTask.assignees = assignees as ITaskAssignee[];
        return;
      }

      // If not found in main tasks, look for it in subtasks
      for (const parentTask of group.tasks) {
        if (parentTask.sub_tasks) {
          const subTask = parentTask.sub_tasks.find(st => st.id === taskId);
          if (subTask) {
            subTask.assignees = assignees as ITaskAssignee[];
            return;
          }
        }
      }
    },

    updateTaskLabel: (state, action: PayloadAction<ILabelsChangeResponse>) => {
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
          break;
        }
      }
    },

    updateTaskStatus: (state, action: PayloadAction<ITaskListStatusChangeResponse>) => {
      const { id, status_id, color_code, color_code_dark, complete_ratio, statusCategory } =
        action.payload;

      // Find the task in any group
      const taskInfo = findTaskInGroups(state.taskGroups, id);
      if (!taskInfo || !status_id) return;

      const { task, groupId } = taskInfo;

      // Update the task properties
      task.status_color = color_code;
      task.status_color_dark = color_code_dark;
      task.complete_ratio = +complete_ratio;
      task.status = status_id;
      task.status_category = statusCategory;

      // If grouped by status and not a subtask, move the task to the new status group
      if (state.groupBy === GROUP_BY_STATUS_VALUE && !task.is_sub_task && groupId !== status_id) {
        // Remove from current group
        deleteTaskFromGroup(state.taskGroups, task, groupId);

        // Add to new status group
        addTaskToGroup(state.taskGroups, task, status_id, false);
      }
    },

    updateTaskEndDate: (
      state,
      action: PayloadAction<{
        task: IProjectTask;
      }>
    ) => {
      const { task } = action.payload;

      for (const group of state.taskGroups) {
        const existingTask =
          group.tasks.find(t => t.id === task.id) ||
          group.tasks.flatMap(t => t.sub_tasks || []).find(subtask => subtask.id === task.id);
        if (existingTask) {
          existingTask.end_date = task.end_date;
          break;
        }
      }
    },

    updateTaskStartDate: (
      state,
      action: PayloadAction<{
        task: IProjectTask;
      }>
    ) => {
      const { task } = action.payload;

      for (const group of state.taskGroups) {
        const existingTask =
          group.tasks.find(t => t.id === task.id) ||
          group.tasks.flatMap(t => t.sub_tasks || []).find(subtask => subtask.id === task.id);
        if (existingTask) {
          existingTask.start_date = task.start_date;
          break;
        }
      }
    },

    updateTaskEstimation: (
      state,
      action: PayloadAction<{
        task: IProjectTask;
      }>
    ) => {
      const { task } = action.payload;

      for (const group of state.taskGroups) {
        const existingTask =
          group.tasks.find(t => t.id === task.id) ||
          group.tasks.flatMap(t => t.sub_tasks || []).find(subtask => subtask.id === task.id);
        if (existingTask) {
          existingTask.total_time_string = task.total_time_string;
          break;
        }
      }
    },

    updateTaskPhase: (state, action: PayloadAction<ITaskPhaseChangeResponse>) => {
      const { id: phase_id, task_id, color_code } = action.payload;

      if (!task_id || !phase_id) return;

      const taskInfo = findTaskInGroups(state.taskGroups, task_id);
      if (!taskInfo) return;

      const { task, groupId } = taskInfo;

      task.phase_id = phase_id;
      task.phase_color = color_code;

      if (state.groupBy === GROUP_BY_PHASE_VALUE && !task.is_sub_task && groupId !== phase_id) {
        deleteTaskFromGroup(state.taskGroups, task, groupId);
        addTaskToGroup(state.taskGroups, task, phase_id, false);
      }
    },

    updateTaskGroupColor: (
      state,
      action: PayloadAction<{ groupId: string; colorCode: string }>
    ) => {
      const { colorCode, groupId } = action.payload;

      if (groupId) {
        const group = state.taskGroups.find(g => g.id === groupId);

        if (group) {
          group.color_code = colorCode;
        }
      }
    },

    updateTaskStatusColor: (state, action: PayloadAction<{ taskId: string; color: string }>) => {
      const { taskId, color } = action.payload;
      const task =
        state.tasks.find(t => t.id === taskId) ||
        state.tasks.flatMap(t => t.sub_tasks || []).find(subtask => subtask.id === taskId);
      if (task) {
        task.status_color = color;
      }
    },

    toggleColumnVisibility: (state, action: PayloadAction<string>) => {
      const column = state.columns.find(col => col.key === action.payload);
      if (column) {
        column.pinned = !column.pinned;
      }
    },

    updateTaskTimeTracking: (
      state,
      action: PayloadAction<{
        taskId: string;
        timeTracking: number | null;
      }>
    ) => {
      const { taskId, timeTracking } = action.payload;
      state.activeTimers[taskId] = timeTracking;
    },

    updateTaskPriority: (state, action: PayloadAction<ITaskListPriorityChangeResponse>) => {
      const { id, priority_id, color_code, color_code_dark } = action.payload;

      // Find the task in any group
      const taskInfo = findTaskInGroups(state.taskGroups, id);
      if (!taskInfo || !priority_id) return;

      const { task, groupId } = taskInfo;

      // Update the task properties
      task.priority = priority_id;
      task.priority_color = color_code;
      task.priority_color_dark = color_code_dark;

      // If grouped by priority and not a subtask, move the task to the new priority group
      if (
        state.groupBy === GROUP_BY_PRIORITY_VALUE &&
        !task.is_sub_task &&
        groupId !== priority_id
      ) {
        // Remove from current group
        deleteTaskFromGroup(state.taskGroups, task, groupId);

        // Add to new priority group
        addTaskToGroup(state.taskGroups, task, priority_id, false);
      }
    },

    updateTaskDescription: (
      state,
      action: PayloadAction<{
        id: string;
        parent_task: string;
        description: string;
      }>
    ) => {
      const { id: taskId, description, parent_task } = action.payload;
      for (const group of state.taskGroups) {
        const existingTask =
          group.tasks.find(t => t.id === taskId) ||
          group.tasks.flatMap(t => t.sub_tasks || []).find(subtask => subtask.id === taskId);
        if (existingTask) {
          existingTask.description = description;
          break;
        }
      }
    },

    toggleTaskRowExpansion: (state, action: PayloadAction<string>) => {
      const taskId = action.payload;
      for (const group of state.taskGroups) {
        const task = group.tasks.find(t => t.id === taskId);
        if (task) {
          task.show_sub_tasks = !task.show_sub_tasks;
          break;
        }
      }
    },

    resetTaskListData: state => {
      return {
        ...initialState,
        groupBy: state.groupBy, // Preserve the current grouping
      };
    },

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
      return produce(state, draft => {
        const { activeGroupId, overGroupId, updatedSourceTasks, updatedTargetTasks } =
          action.payload;

        const sourceGroup = draft.taskGroups.find(g => g.id === activeGroupId);
        const targetGroup = draft.taskGroups.find(g => g.id === overGroupId);

        if (!sourceGroup || !targetGroup) return;

        // Simply replace the arrays with the updated ones
        sourceGroup.tasks = updatedSourceTasks;

        // Only update target if it's different from source
        if (activeGroupId !== overGroupId) {
          targetGroup.tasks = updatedTargetTasks;
        }
      });
    },

    addCustomColumn: (state, action: PayloadAction<ITaskListColumn>) => {
      state.customColumns.push(action.payload);
      // Also add to columns array to maintain visibility
      state.columns.push({
        ...action.payload,
        pinned: true, // New columns are visible by default
      });
    },

    updateCustomColumn: (
      state,
      action: PayloadAction<{ key: string; column: ITaskListColumn }>
    ) => {
      const { key, column } = action.payload;
      const index = state.customColumns.findIndex(col => col.key === key);
      if (index !== -1) {
        state.customColumns[index] = column;
        // Update in columns array as well
        const colIndex = state.columns.findIndex(col => col.key === key);
        if (colIndex !== -1) {
          state.columns[colIndex] = { ...column, pinned: state.columns[colIndex].pinned };
        }
      }
    },

    deleteCustomColumn: (state, action: PayloadAction<string>) => {
      const key = action.payload;
      state.customColumns = state.customColumns.filter(col => col.key !== key);
      // Remove from columns array as well
      state.columns = state.columns.filter(col => col.key !== key);
    },

    updateSubTasks: (state, action: PayloadAction<IProjectTask>) => {
      const { parent_task_id } = action.payload;
      for (const group of state.taskGroups) {
        const parentTask = group.tasks.find(t => t.id === parent_task_id);
        if (parentTask) {
          if (!parentTask.sub_tasks) {
            parentTask.sub_tasks = [];
          }
          parentTask.sub_tasks.push({ ...action.payload });
          // Always update sub_tasks_count based on actual subtasks array length
          parentTask.sub_tasks_count = (parentTask.sub_tasks_count || 0) + 1;
          break;
        }
      }
    },

    updateCustomColumnValue: (
      state,
      action: PayloadAction<{
        taskId: string;
        columnKey: string;
        value: string;
      }>
    ) => {
      const { taskId, columnKey, value } = action.payload;

      // Update in task groups
      for (const group of state.taskGroups) {
        // Check in main tasks
        const taskIndex = group.tasks.findIndex(t => t.id === taskId);
        if (taskIndex !== -1) {
          if (!group.tasks[taskIndex].custom_column_values) {
            group.tasks[taskIndex].custom_column_values = {};
          }
          group.tasks[taskIndex].custom_column_values[columnKey] = value;
          break;
        }

        // Check in subtasks
        for (const parentTask of group.tasks) {
          if (parentTask.sub_tasks) {
            const subtaskIndex = parentTask.sub_tasks.findIndex(st => st.id === taskId);
            if (subtaskIndex !== -1) {
              if (!parentTask.sub_tasks[subtaskIndex].custom_column_values) {
                parentTask.sub_tasks[subtaskIndex].custom_column_values = {};
              }
              parentTask.sub_tasks[subtaskIndex].custom_column_values[columnKey] = value;
              break;
            }
          }
        }
      }

      // Also update in the customColumnValues state if needed
      if (!state.customColumnValues[taskId]) {
        state.customColumnValues[taskId] = {};
      }
      state.customColumnValues[taskId][columnKey] = value;
    },

    updateCustomColumnPinned: (
      state,
      action: PayloadAction<{ columnId: string; isVisible: boolean }>
    ) => {
      const { columnId, isVisible } = action.payload;
      const customColumn = state.customColumns.find(col => col.id === columnId);
      const column = state.columns.find(col => col.id === columnId);

      if (customColumn) {
        customColumn.pinned = isVisible;
      }

      if (column) {
        column.pinned = isVisible;
      }
    },

    updateRecurringChange: (state, action: PayloadAction<ITaskRecurringScheduleData>) => {
      const { id, schedule_type, task_id } = action.payload;
      const taskInfo = findTaskInGroups(state.taskGroups, task_id as string);
      if (!taskInfo) return;

      const { task } = taskInfo;
      task.schedule_id = id;
    },
  },

  extraReducers: builder => {
    builder
      .addCase(fetchTaskGroups.pending, state => {
        state.loadingGroups = true;
        state.error = null;
      })
      .addCase(fetchTaskGroups.fulfilled, (state, action) => {
        state.loadingGroups = false;
        state.taskGroups = action.payload && action.payload.groups ? action.payload.groups : [];
        state.allTasks = action.payload && action.payload.allTasks ? action.payload.allTasks : [];
        state.grouping = action.payload && action.payload.grouping ? action.payload.grouping : '';
        state.totalTasks =
          action.payload && action.payload.totalTasks ? action.payload.totalTasks : 0;
      })
      .addCase(fetchTaskGroups.rejected, (state, action) => {
        state.loadingGroups = false;
        state.error = action.error.message || 'Failed to fetch task groups';
      })
      .addCase(fetchSubTasks.pending, state => {
        state.error = null;
      })
      .addCase(fetchSubTasks.fulfilled, (state, action) => {
        if (action.payload && action.payload.groups && action.payload.groups.length > 0) {
          // Assuming subtasks are in the first group for this context
          const subtasks = action.payload.groups[0].tasks;
          const taskId = subtasks.length > 0 ? subtasks[0].parent_task_id : null;
          if (taskId) {
            for (const group of state.taskGroups) {
              const task = group.tasks.find(t => t.id === taskId);
              if (task) {
                task.sub_tasks = subtasks;
                task.show_sub_tasks = true;
                break;
              }
            }
          }
        }
      })
      .addCase(fetchSubTasks.rejected, (state, action) => {
        state.error = action.error.message || 'Failed to fetch sub tasks';
      })
      .addCase(fetchTaskAssignees.pending, state => {
        state.loadingAssignees = true;
        state.error = null;
      })
      .addCase(fetchTaskAssignees.fulfilled, (state, action) => {
        state.loadingAssignees = false;
        state.taskAssignees = action.payload;
      })
      .addCase(fetchTaskAssignees.rejected, (state, action) => {
        state.loadingAssignees = false;
        state.error = action.error.message || 'Failed to fetch task assignees';
      })
      .addCase(fetchTaskListColumns.pending, state => {
        state.loadingColumns = true;
        state.error = null;
      })
      .addCase(fetchTaskListColumns.fulfilled, (state, action) => {
        state.loadingColumns = false;

        // Process standard columns
        const standardColumns = action.payload.standard;
        standardColumns.splice(1, 0, {
          key: 'TASK',
          name: 'Task',
          index: 1,
          pinned: true,
        });
        // Process custom columns
        const customColumns = (action.payload as { custom: any[] }).custom.map((col: any) => ({
          ...col,
          isCustom: true,
        }));

        // Merge columns
        state.columns = [...standardColumns, ...customColumns];
        state.customColumns = customColumns;
      })
      .addCase(fetchTaskListColumns.rejected, (state, action) => {
        state.loadingColumns = false;
        state.error = action.error.message || 'Failed to fetch task list columns';
      })
      // Fetch Labels By Project
      .addCase(fetchLabelsByProject.pending, state => {
        state.loadingLabels = true;
        state.error = null;
      })
      .addCase(fetchLabelsByProject.fulfilled, (state, action: PayloadAction<ITaskLabel[]>) => {
        const newLabels = action.payload.map(label => ({ ...label, selected: false }));
        state.labels = newLabels;
        state.loadingLabels = false;
      })
      .addCase(fetchLabelsByProject.rejected, (state, action) => {
        state.loadingLabels = false;
        state.error = action.payload as string;
      })
      .addCase(updateColumnVisibility.fulfilled, (state, action) => {
        const column = state.columns.find(col => col.key === action.payload.key);
        if (column) {
          column.pinned = action.payload.pinned;
        }
      })
      .addCase(updateColumnVisibility.rejected, (state, action) => {
        state.error = action.payload as string;
      })
      .addCase(updateColumnVisibility.pending, state => {
        state.loadingColumns = true;
        state.error = null;
      })
      .addCase(fetchCustomColumns.pending, state => {
        state.loadingColumns = true;
        state.error = null;
      })
      .addCase(fetchCustomColumns.fulfilled, (state, action) => {
        state.loadingColumns = false;
        state.customColumns = action.payload;
        // Add custom columns to the columns array
        const customColumnsForVisibility = action.payload;
        state.columns = [...state.columns, ...customColumnsForVisibility];
      })
      .addCase(fetchCustomColumns.rejected, (state, action) => {
        state.loadingColumns = false;
        state.error = action.error.message || 'Failed to fetch custom columns';
      });
  },
});

export const {
  setGroup,
  addTask,
  deleteTask,
  updateTaskName,
  updateTaskProgress,
  updateTaskAssignees,
  updateTaskLabel,
  toggleArchived,
  setMembers,
  setLabels,
  setPriorities,
  setStatuses,
  setFields,
  setSearch,
  toggleColumnVisibility,
  updateTaskStatus,
  updateTaskPhase,
  updateTaskPriority,
  updateTaskEndDate,
  updateTaskStartDate,
  updateTaskEstimation,
  updateTaskTimeTracking,
  toggleTaskRowExpansion,
  resetTaskListData,
  updateTaskStatusColor,
  updateTaskGroupColor,
  setConvertToSubtaskDrawerOpen,
  reorderTasks,
  updateTaskDescription,
  addCustomColumn,
  updateCustomColumn,
  deleteCustomColumn,
  updateSubTasks,
  updateCustomColumnValue,
  updateCustomColumnPinned,
  updateRecurringChange,
} = taskSlice.actions;

export default taskSlice.reducer;
