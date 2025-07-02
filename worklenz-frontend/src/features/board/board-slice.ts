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
import { IProjectTask, ITaskAssignee } from '@/types/project/projectTasksViewModel.types';
import { ITaskStatusViewModel } from '@/types/tasks/taskStatusGetResponse.types';
import { ITaskAssigneesUpdateResponse } from '@/types/tasks/task-assignee-update-response';
import { ITaskLabelFilter } from '@/types/tasks/taskLabel.types';
import { ITaskLabel } from '@/types/label.type';
import { ITeamMemberViewModel } from '../taskAttributes/taskMemberSlice';
import { InlineMember } from '@/types/teamMembers/inlineMember.types';
import { ITaskListStatusChangeResponse } from '@/types/tasks/task-list-status.types';
import { ITaskListPriorityChangeResponse } from '@/types/tasks/task-list-priority.types';

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

const LOCALSTORAGE_BOARD_GROUP_KEY = 'worklenz.board.group_by';

export const getCurrentGroupBoard = (): IGroupByOption => {
  const key = localStorage.getItem(LOCALSTORAGE_BOARD_GROUP_KEY);
  if (key) {
    const group = GROUP_BY_OPTIONS.find(option => option.value === key);
    if (group) return group;
  }
  setCurrentBoardGroup(GROUP_BY_STATUS_VALUE);
  return GROUP_BY_OPTIONS[0];
};

export const setCurrentBoardGroup = (groupBy: IGroupBy): void => {
  localStorage.setItem(LOCALSTORAGE_BOARD_GROUP_KEY, groupBy);
};

interface BoardState {
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
  editableSectionId: string | null;

  allTasks: IProjectTask[];
  grouping: string;
  totalTasks: number;
}

const initialState: BoardState = {
  search: null,
  archived: false,
  groupBy: getCurrentGroupBoard().value as IGroupBy,
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
  editableSectionId: null,
  allTasks: [],
  grouping: '',
  totalTasks: 0,
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

// Async thunk for fetching members data
export const fetchTaskData = createAsyncThunk('board/fetchTaskData', async (endpoint: string) => {
  const response = await fetch(endpoint);
  if (!response.ok) throw new Error(`Response error: ${response.status}`);
  return await response.json();
});

export const fetchBoardTaskGroups = createAsyncThunk(
  'board/fetchBoardTaskGroups',
  async (projectId: string, { rejectWithValue, getState }) => {
    try {
      const state = getState() as { boardReducer: BoardState };
      const { boardReducer } = state;

      const selectedMembers = boardReducer.taskAssignees
        .filter(member => member.selected)
        .map(member => member.id)
        .join(' ');

      const selectedLabels = boardReducer.labels
        .filter(label => label.selected)
        .map(label => label.id)
        .join(' ');

      const config: ITaskListConfigV2 = {
        id: projectId,
        archived: boardReducer.archived,
        group: boardReducer.groupBy,
        field: boardReducer.fields.map(field => `${field.key} ${field.sort_order}`).join(','),
        order: '',
        search: boardReducer.search || '',
        statuses: '',
        members: selectedMembers,
        projects: '',
        isSubtasksInclude: boardReducer.isSubtasksInclude,
        labels: selectedLabels,
        priorities: boardReducer.priorities.join(' '),
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

export const fetchBoardSubTasks = createAsyncThunk(
  'board/fetchBoardSubTasks',
  async (
    { taskId, projectId }: { taskId: string; projectId: string },
    { rejectWithValue, getState }
  ) => {
    try {
      const state = getState() as { boardReducer: BoardState };
      const { boardReducer } = state;

      // Check if the task is already expanded
      const task = boardReducer.taskGroups.flatMap(group => group.tasks).find(t => t.id === taskId);

      if (task?.show_sub_tasks) {
        // If already expanded, just return without fetching
        return [];
      }

      const selectedMembers = boardReducer.taskAssignees
        .filter(member => member.selected)
        .map(member => member.id)
        .join(' ');

      const selectedLabels = boardReducer.labels
        .filter(label => label.selected)
        .map(label => label.id)
        .join(' ');

      const config: ITaskListConfigV2 = {
        id: projectId,
        archived: boardReducer.archived,
        group: boardReducer.groupBy,
        field: boardReducer.fields.map(field => `${field.key} ${field.sort_order}`).join(','),
        order: '',
        search: boardReducer.search || '',
        statuses: '',
        members: selectedMembers,
        projects: '',
        isSubtasksInclude: false,
        labels: selectedLabels,
        priorities: boardReducer.priorities.join(' '),
        parent_task: taskId,
      };

      const response = await tasksApiService.getTaskList(config);
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

// Helper functions for common operations
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

const findParentTaskInAllGroups = (
  taskGroups: ITaskListGroup[],
  parentTaskId: string
): { task: IProjectTask; group: ITaskListGroup } | null => {
  for (const group of taskGroups) {
    const task = group.tasks.find(t => t.id === parentTaskId);
    if (task) return { task, group };
  }
  return null;
};

const getTaskListConfig = (
  state: BoardState,
  projectId: string,
  parentTaskId?: string
): ITaskListConfigV2 => {
  const selectedMembers = state.taskAssignees
    .filter(member => member.selected)
    .map(member => member.id)
    .join(' ');

  const selectedLabels = state.labels
    .filter(label => label.selected)
    .map(label => label.id)
    .join(' ');

  return {
    id: projectId,
    archived: state.archived,
    group: state.groupBy,
    field: state.fields.map(field => `${field.key} ${field.sort_order}`).join(','),
    order: '',
    search: state.search || '',
    statuses: '',
    members: selectedMembers,
    projects: '',
    isSubtasksInclude: state.isSubtasksInclude,
    labels: selectedLabels,
    priorities: state.priorities.join(' '),
    parent_task: parentTaskId,
  };
};

const boardSlice = createSlice({
  name: 'boardReducer',
  initialState,
  reducers: {
    setBoardGroupBy: (state, action: PayloadAction<BoardState['groupBy']>) => {
      state.groupBy = action.payload;
      setCurrentBoardGroup(action.payload);
    },

    addBoardSectionCard: (
      state,
      action: PayloadAction<{
        id: string;
        name: string;
        colorCode: string;
        colorCodeDark: string;
      }>
    ) => {
      const newSection = {
        id: action.payload.id,
        name: action.payload.name,
        color_code: action.payload.colorCode,
        color_code_dark: action.payload.colorCodeDark,
        progress: { todo: 0, doing: 0, done: 0 },
        tasks: [],
      };
      state.taskGroups.push(newSection as ITaskListGroup);
      state.editableSectionId = newSection.id;
    },

    setEditableSection: (state, action: PayloadAction<string | null>) => {
      state.editableSectionId = action.payload;
    },

    addTaskCardToTheTop: (
      state,
      action: PayloadAction<{ sectionId: string; task: IProjectTask }>
    ) => {
      const section = state.taskGroups.find(sec => sec.id === action.payload.sectionId);
      if (section) {
        section.tasks.unshift(action.payload.task);
      }
    },

    addTaskCardToTheBottom: (
      state,
      action: PayloadAction<{ sectionId: string; task: IProjectTask }>
    ) => {
      const section = state.taskGroups.find(sec => sec.id === action.payload.sectionId);
      if (section) {
        section.tasks.push(action.payload.task);
      }
    },

    addSubtask: (
      state,
      action: PayloadAction<{ sectionId: string; taskId: string; subtask: IProjectTask }>
    ) => {
      const section = state.taskGroups.find(sec => sec.id === action.payload.sectionId);
      if (section) {
        const task = section.tasks.find(task => task.id === action.payload.taskId);

        if (task) {
          if (!task.sub_tasks) {
            task.sub_tasks = [];
          }
          task.sub_tasks.push(action.payload.subtask);
          task.sub_tasks_count = task.sub_tasks.length;
        }
      }
    },

    deleteBoardTask: (state, action: PayloadAction<{ sectionId: string; taskId: string }>) => {
      const { sectionId, taskId } = action.payload;

      if (sectionId) {
        const section = state.taskGroups.find(sec => sec.id === sectionId);
        if (section) {
          // Check if task is in the main task list
          const taskIndex = section.tasks.findIndex(task => task.id === taskId);
          if (taskIndex !== -1) {
            section.tasks.splice(taskIndex, 1);
            return;
          }

          // Check if task is in subtasks
          for (const parentTask of section.tasks) {
            if (!parentTask.sub_tasks) continue;

            const subtaskIndex = parentTask.sub_tasks.findIndex(st => st.id === taskId);
            if (subtaskIndex !== -1) {
              parentTask.sub_tasks.splice(subtaskIndex, 1);
              parentTask.sub_tasks_count = Math.max(0, (parentTask.sub_tasks_count || 1) - 1);
              return;
            }
          }
        }
      }

      // If section not found or task not in section, search all groups
      for (const group of state.taskGroups) {
        // Check main tasks
        const taskIndex = group.tasks.findIndex(task => task.id === taskId);
        if (taskIndex !== -1) {
          group.tasks.splice(taskIndex, 1);
          return;
        }

        // Check subtasks
        for (const parentTask of group.tasks) {
          if (!parentTask.sub_tasks) continue;

          const subtaskIndex = parentTask.sub_tasks.findIndex(st => st.id === taskId);
          if (subtaskIndex !== -1) {
            parentTask.sub_tasks.splice(subtaskIndex, 1);
            parentTask.sub_tasks_count = Math.max(0, (parentTask.sub_tasks_count || 1) - 1);
            return;
          }
        }
      }
    },

    deleteSection: (state, action: PayloadAction<{ sectionId: string }>) => {
      state.taskGroups = state.taskGroups.filter(
        section => section.id !== action.payload.sectionId
      );

      if (state.editableSectionId === action.payload.sectionId) {
        state.editableSectionId = null;
      }
    },

    updateBoardTaskAssignee: (
      state,
      action: PayloadAction<{
        body: ITaskAssigneesUpdateResponse;
        sectionId: string;
        taskId: string;
      }>
    ) => {
      const { body, sectionId, taskId } = action.payload;
      const section = state.taskGroups.find(sec => sec.id === sectionId);
      if (section) {
        // First try to find the task in main tasks
        const mainTask = section.tasks.find(task => task.id === taskId);
        if (mainTask) {
          mainTask.assignees = body.assignees;
          mainTask.names = body.names;
          return;
        }

        // If not found in main tasks, look in subtasks
        for (const parentTask of section.tasks) {
          if (!parentTask.sub_tasks) continue;

          const subtask = parentTask.sub_tasks.find(st => st.id === taskId);
          if (subtask) {
            subtask.assignees = body.assignees;
            subtask.names = body.names;
            return;
          }
        }
      }
    },

    reorderTaskGroups: (state, action: PayloadAction<ITaskListGroup[]>) => {
      state.taskGroups = action.payload;
    },

    moveTaskBetweenGroups: (
      state,
      action: PayloadAction<{
        taskId: string;
        sourceGroupId: string;
        targetGroupId: string;
        targetIndex: number;
      }>
    ) => {
      const { taskId, sourceGroupId, targetGroupId, targetIndex } = action.payload;

      // Find source and target groups
      const sourceGroup = state.taskGroups.find(group => group.id === sourceGroupId);
      const targetGroup = state.taskGroups.find(group => group.id === targetGroupId);

      if (!sourceGroup || !targetGroup) return;

      // Find the task to move
      const taskIndex = sourceGroup.tasks.findIndex(task => task.id === taskId);
      if (taskIndex === -1) return;

      // Get the task and remove it from source
      const task = { ...sourceGroup.tasks[taskIndex], status_id: targetGroupId };
      sourceGroup.tasks.splice(taskIndex, 1);

      // Insert task at the target position
      if (targetIndex >= 0 && targetIndex <= targetGroup.tasks.length) {
        targetGroup.tasks.splice(targetIndex, 0, task);
      } else {
        // If target index is invalid, append to the end
        targetGroup.tasks.push(task);
      }
    },

    resetBoardData: state => {
      state.taskGroups = [];
      state.columns = [];
      state.loadingGroups = false;
      state.loadingColumns = false;
      state.error = null;
    },

    setBoardLabels: (state, action: PayloadAction<ITaskLabelFilter[]>) => {
      state.labels = action.payload;
    },

    setBoardMembers: (state, action: PayloadAction<ITaskListMemberFilter[]>) => {
      state.taskAssignees = action.payload;
    },

    setBoardPriorities: (state, action: PayloadAction<string[]>) => {
      state.priorities = action.payload;
    },

    setBoardStatuses: (state, action: PayloadAction<ITaskStatusViewModel[]>) => {
      state.statuses = action.payload;
    },

    setBoardSearch: (state, action: PayloadAction<string | null>) => {
      state.search = action.payload;
    },

    toggleSubtasksInclude: state => {
      state.isSubtasksInclude = !state.isSubtasksInclude;
    },

    setBoardGroupName: (
      state,
      action: PayloadAction<{
        groupId: string;
        name: string;
        colorCode: string;
        colorCodeDark: string;
        categoryId: string;
      }>
    ) => {
      const { groupId, name, colorCode, colorCodeDark, categoryId } = action.payload;
      const group = state.taskGroups.find(group => group.id === groupId);
      if (group) {
        group.name = name;
        group.color_code = colorCode;
        group.color_code_dark = colorCodeDark;
        group.category_id = categoryId;
      }
    },

    updateTaskAssignees: (
      state,
      action: PayloadAction<{
        groupId: string;
        taskId: string;
        assignees: ITeamMemberViewModel[];
        names: ITeamMemberViewModel[];
      }>
    ) => {
      const { groupId, taskId, assignees, names } = action.payload;

      // Find the task in the specified group
      const group = state.taskGroups.find(group => group.id === groupId);
      if (!group) return;

      // Try to find the task directly in the group
      const task = group.tasks.find(task => task.id === taskId);
      if (task) {
        task.assignees = assignees as ITaskAssignee[];
        task.names = names as InlineMember[];
        return;
      }

      // If not found, look in subtasks
      for (const parentTask of group.tasks) {
        if (!parentTask.sub_tasks) continue;

        const subtask = parentTask.sub_tasks.find(subtask => subtask.id === taskId);
        if (subtask) {
          subtask.assignees = assignees as ITaskAssignee[];
          subtask.names = names as InlineMember[];
          return;
        }
      }
    },

    updateTaskName: (
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
      }
    },

    updateTaskEndDate: (
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
      }
    },

    updateSubtask: (
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
        return true;
      };

      // First try to find the task in the specified section
      if (sectionId) {
        const section = state.taskGroups.find(sec => sec.id === sectionId);
        if (section) {
          const task = section.tasks.find(task => task.id === parentTaskId);
          if (task && updateTaskWithSubtask(task)) {
            return;
          }
        }
      }

      // If not found in the specified section, try all groups
      const result = findParentTaskInAllGroups(state.taskGroups, parentTaskId);
      if (result) {
        updateTaskWithSubtask(result.task);
      }
    },

    toggleTaskExpansion: (state, action: PayloadAction<string>) => {
      const taskId = action.payload;
      const result = findTaskInAllGroups(state.taskGroups, taskId);

      if (result) {
        result.task.show_sub_tasks = !result.task.show_sub_tasks;
      }
    },
    updateBoardTaskStatus: (state, action: PayloadAction<ITaskListStatusChangeResponse>) => {
      const { id, status_id, color_code, color_code_dark, complete_ratio, statusCategory } =
        action.payload;

      // Find the task in any group
      const taskInfo = findTaskInAllGroups(state.taskGroups, id);
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
    updateTaskPriority: (state, action: PayloadAction<ITaskListPriorityChangeResponse>) => {
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
    updateBoardTaskLabel: (state, action: PayloadAction<ILabelsChangeResponse>) => {
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
    updateTaskProgress: (
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
    },
  },
  extraReducers: builder => {
    builder
      .addCase(fetchBoardTaskGroups.pending, state => {
        state.loadingGroups = true;
        state.error = null;
      })
      .addCase(fetchBoardTaskGroups.fulfilled, (state, action) => {
        state.loadingGroups = false;
        state.taskGroups = action.payload && action.payload.groups ? action.payload.groups : [];
        state.allTasks = action.payload && action.payload.allTasks ? action.payload.allTasks : [];
        state.grouping = action.payload && action.payload.grouping ? action.payload.grouping : '';
        state.totalTasks =
          action.payload && action.payload.totalTasks ? action.payload.totalTasks : 0;
      })
      .addCase(fetchBoardTaskGroups.rejected, (state, action) => {
        state.loadingGroups = false;
        state.error = action.error.message || 'Failed to fetch task groups';
      })
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
        if (action.payload.length > 0) {
          const taskId = action.payload[0].parent_task_id;
          if (taskId) {
            const result = findTaskInAllGroups(state.taskGroups, taskId);
            if (result) {
              result.task.sub_tasks = action.payload;
              result.task.show_sub_tasks = true;
              result.task.sub_tasks_loading = false;
              result.task.sub_tasks_count = action.payload.length;
            }
          }
        } else {
          // If no subtasks were returned, we still need to set loading to false
          const taskId = (action as any).meta?.arg?.taskId;
          const result = findTaskInAllGroups(state.taskGroups, taskId);
          if (result) {
            result.task.sub_tasks_loading = false;
            result.task.sub_tasks = [];
            result.task.sub_tasks_count = 0;
          }
        }
      })
      .addCase(fetchBoardSubTasks.rejected, (state, action) => {
        state.error = action.error.message || 'Failed to fetch sub tasks';
        // Set loading to false on rejection
        const taskId = action.meta.arg.taskId;
        const result = findTaskInAllGroups(state.taskGroups, taskId);
        if (result) {
          result.task.sub_tasks_loading = false;
        }
      });
  },
});

export const {
  setBoardGroupBy,
  addBoardSectionCard,
  setEditableSection,
  addTaskCardToTheTop,
  addTaskCardToTheBottom,
  addSubtask,
  deleteSection,
  deleteBoardTask,
  updateBoardTaskAssignee,
  reorderTaskGroups,
  moveTaskBetweenGroups,
  resetBoardData,
  setBoardLabels,
  setBoardMembers,
  setBoardPriorities,
  setBoardStatuses,
  setBoardSearch,
  setBoardGroupName,
  updateTaskAssignees,
  updateTaskEndDate,
  updateTaskName,
  updateSubtask,
  toggleSubtasksInclude,
  toggleTaskExpansion,
  updateBoardTaskStatus,
  updateTaskPriority,
  updateBoardTaskLabel,
  updateTaskProgress,
} = boardSlice.actions;
export default boardSlice.reducer;
