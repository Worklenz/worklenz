import {
  createSlice,
  createEntityAdapter,
  PayloadAction,
  createAsyncThunk,
  EntityState,
  EntityId,
} from '@reduxjs/toolkit';
import { Task, TaskManagementState, TaskGroup, TaskGrouping } from '@/types/task-management.types';
import { RootState } from '@/app/store';
import {
  tasksApiService,
  ITaskListConfigV2,
  ITaskListV3Response,
} from '@/api/tasks/tasks.api.service';
import logger from '@/utils/errorLogger';
import { DEFAULT_TASK_NAME } from '@/shared/constants';

// Helper function to safely convert time values
const convertTimeValue = (value: any): number => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    return isNaN(parsed) ? 0 : parsed;
  }
  if (typeof value === 'object' && value !== null) {
    // Handle time objects like {hours: 2, minutes: 30}
    if ('hours' in value || 'minutes' in value) {
      const hours = Number(value.hours || 0);
      const minutes = Number(value.minutes || 0);
      return hours + minutes / 60;
    }
  }
  return 0;
};

export enum IGroupBy {
  STATUS = 'status',
  PRIORITY = 'priority',
  PHASE = 'phase',
  MEMBERS = 'members',
}

// Entity adapter for normalized state
const tasksAdapter = createEntityAdapter<Task>();

// Get the initial state from the adapter
const initialState: TaskManagementState = {
  ids: [],
  entities: {},
  loading: false,
  error: null,
  groups: [],
  grouping: undefined,
  selectedPriorities: [],
  search: '',
};

// Async thunk to fetch tasks from API
export const fetchTasks = createAsyncThunk(
  'taskManagement/fetchTasks',
  async (projectId: string, { rejectWithValue, getState }) => {
    try {
      const state = getState() as RootState;
      const currentGrouping = state.grouping.currentGrouping;

      const config: ITaskListConfigV2 = {
        id: projectId,
        archived: false,
        group: currentGrouping || '',
        field: '',
        order: '',
        search: '',
        statuses: '',
        members: '',
        projects: '',
        isSubtasksInclude: false,
        labels: '',
        priorities: '',
      };

      const response = await tasksApiService.getTaskList(config);

      // Helper function to safely convert time values
      const convertTimeValue = (value: any): number => {
        if (typeof value === 'number') return value;
        if (typeof value === 'string') {
          const parsed = parseFloat(value);
          return isNaN(parsed) ? 0 : parsed;
        }
        if (typeof value === 'object' && value !== null) {
          // Handle time objects like {hours: 2, minutes: 30}
          if ('hours' in value || 'minutes' in value) {
            const hours = Number(value.hours || 0);
            const minutes = Number(value.minutes || 0);
            return hours + minutes / 60;
          }
        }
        return 0;
      };

      // Create a mapping from status IDs to group names
      const statusIdToNameMap: Record<string, string> = {};
      const priorityIdToNameMap: Record<string, string> = {};

      response.body.forEach((group: any) => {
        statusIdToNameMap[group.id] = group.name.toLowerCase();
      });

      // For priority mapping, we need to get priority names from the tasks themselves
      // Since the API doesn't provide priority names in the group structure
      response.body.forEach((group: any) => {
        group.tasks.forEach((task: any) => {
          // Map priority value to name (this is an assumption based on common patterns)
          if (task.priority_value !== undefined) {
            switch (task.priority_value) {
              case 0:
                priorityIdToNameMap[task.priority] = 'low';
                break;
              case 1:
                priorityIdToNameMap[task.priority] = 'medium';
                break;
              case 2:
                priorityIdToNameMap[task.priority] = 'high';
                break;
              case 3:
                priorityIdToNameMap[task.priority] = 'critical';
                break;
              default:
                priorityIdToNameMap[task.priority] = 'medium';
            }
          }
        });
      });

      // Transform the API response to our Task type
      const tasks: Task[] = response.body.flatMap((group: any) =>
        group.tasks.map((task: any) => ({
          id: task.id,
          task_key: task.task_key || '',
          title: (task.title && task.title.trim()) ? task.title.trim() : DEFAULT_TASK_NAME,
          description: task.description || '',
          status: statusIdToNameMap[task.status] || 'todo',
          priority: priorityIdToNameMap[task.priority] || 'medium',
          phase: task.phase_name || 'Development',
          progress: typeof task.complete_ratio === 'number' ? task.complete_ratio : 0,
          assignees: task.assignees?.map((a: any) => a.team_member_id) || [],
          assignee_names: task.assignee_names || task.names || [],
          labels:
            task.labels?.map((l: any) => ({
              id: l.id || l.label_id,
              name: l.name,
              color: l.color_code || '#1890ff',
              end: l.end,
              names: l.names,
            })) || [],
          dueDate: task.end_date,
          timeTracking: {
            estimated: convertTimeValue(task.total_time),
            logged: convertTimeValue(task.time_spent),
          },
          customFields: {},
          createdAt: task.created_at || new Date().toISOString(),
          updatedAt: task.updated_at || new Date().toISOString(),
          order: typeof task.sort_order === 'number' ? task.sort_order : 0,
        }))
      );

      return tasks;
    } catch (error) {
      logger.error('Fetch Tasks', error);
      if (error instanceof Error) {
        return rejectWithValue(error.message);
      }
      return rejectWithValue('Failed to fetch tasks');
    }
  }
);

// New V3 fetch that minimizes frontend processing
export const fetchTasksV3 = createAsyncThunk(
  'taskManagement/fetchTasksV3',
  async (projectId: string, { rejectWithValue, getState }) => {
    try {
      const state = getState() as RootState;
      const currentGrouping = state.grouping.currentGrouping;

      // Get selected labels from taskReducer
      const selectedLabels = state.taskReducer.labels
        .filter((l: any) => l.selected && l.id)
        .map((l: any) => l.id)
        .join(' ');

      // Get selected assignees from taskReducer
      const selectedAssignees = state.taskReducer.taskAssignees
        .filter((m: any) => m.selected && m.id)
        .map((m: any) => m.id)
        .join(' ');

      // Get selected priorities from taskReducer
      const selectedPriorities = state.taskReducer.priorities.join(' ');

      // Get search value from taskReducer
      const searchValue = state.taskReducer.search || '';

      const config: ITaskListConfigV2 = {
        id: projectId,
        archived: false,
        group: currentGrouping || '',
        field: '',
        order: '',
        search: searchValue,
        statuses: '',
        members: selectedAssignees,
        projects: '',
        isSubtasksInclude: false,
        labels: selectedLabels,
        priorities: selectedPriorities,
      };

      const response = await tasksApiService.getTaskListV3(config);

      // Log raw response for debugging
      console.log('Raw API response:', response.body);
      console.log('Sample task from backend:', response.body.allTasks?.[0]);

      // Ensure tasks are properly normalized
      const tasks = response.body.allTasks.map((task: any) => {
        const now = new Date().toISOString();
        

        
        return {
          id: task.id,
          title: (task.title && task.title.trim()) ? task.title.trim() : DEFAULT_TASK_NAME,
          description: task.description || '',
          status: task.status || 'todo',
          priority: task.priority || 'medium',
          phase: task.phase || 'Development',
          progress: typeof task.complete_ratio === 'number' ? task.complete_ratio : 0,
          assignees: task.assignees?.map((a: { team_member_id: string }) => a.team_member_id) || [],
          assignee_names: task.assignee_names || task.names || [],
          labels: task.labels?.map((l: { id: string; label_id: string; name: string; color_code: string; end: boolean; names: string[] }) => ({
            id: l.id || l.label_id,
            name: l.name,
            color: l.color_code || '#1890ff',
            end: l.end,
            names: l.names,
          })) || [],
          due_date: task.end_date || '',
          timeTracking: {
            estimated: convertTimeValue(task.total_time),
            logged: convertTimeValue(task.time_spent),
          },
          created_at: task.created_at || now,
          updated_at: task.updated_at || now,
          order: typeof task.sort_order === 'number' ? task.sort_order : 0,
          sub_tasks: task.sub_tasks || [],
          sub_tasks_count: task.sub_tasks_count || 0,
          show_sub_tasks: task.show_sub_tasks || false,
          parent_task_id: task.parent_task_id || '',
          weight: task.weight || 0,
          color: task.color || '',
          statusColor: task.status_color || '',
          priorityColor: task.priority_color || '',
          comments_count: task.comments_count || 0,
          attachments_count: task.attachments_count || 0,
          has_dependencies: !!task.has_dependencies,
          schedule_id: task.schedule_id || null,
        } as Task;
      });

      // Map groups to match TaskGroup interface
      const mappedGroups = response.body.groups.map((group: any) => ({
        id: group.id,
        title: group.title,
        taskIds: group.taskIds || [],
        type: group.groupType as 'status' | 'priority' | 'phase' | 'members',
        color: group.color,
      }));

      // Log normalized data for debugging
      console.log('Normalized data:', {
        tasks,
        groups: mappedGroups,
        grouping: response.body.grouping,
        totalTasks: response.body.totalTasks,
      });

      // Verify task IDs match group taskIds
      const taskIds = new Set(tasks.map(t => t.id));
      const groupTaskIds = new Set(mappedGroups.flatMap(g => g.taskIds));
      console.log('Task ID verification:', {
        taskIds: Array.from(taskIds),
        groupTaskIds: Array.from(groupTaskIds),
        allTaskIdsInGroups: Array.from(groupTaskIds).every(id => taskIds.has(id)),
        allGroupTaskIdsInTasks: Array.from(taskIds).every(id => groupTaskIds.has(id)),
      });

      return {
        tasks: tasks,
        groups: mappedGroups,
        grouping: response.body.grouping,
        totalTasks: response.body.totalTasks,
      };
    } catch (error) {
      logger.error('Fetch Tasks V3', error);
      if (error instanceof Error) {
        return rejectWithValue(error.message);
      }
      return rejectWithValue('Failed to fetch tasks');
    }
  }
);

// Refresh task progress separately to avoid slowing down initial load
export const fetchSubTasks = createAsyncThunk(
  'taskManagement/fetchSubTasks',
  async (
    { taskId, projectId }: { taskId: string; projectId: string },
    { rejectWithValue, getState }
  ) => {
    try {
      const state = getState() as RootState;
      const currentGrouping = state.grouping.currentGrouping;

      const config: ITaskListConfigV2 = {
        id: projectId,
        archived: false,
        group: currentGrouping,
        field: '',
        order: '',
        search: '',
        statuses: '',
        members: '',
        projects: '',
        isSubtasksInclude: false,
        labels: '',
        priorities: '',
        parent_task: taskId,
      };

      const response = await tasksApiService.getTaskListV3(config);
      return { parentTaskId: taskId, subtasks: response.body.allTasks };
    } catch (error) {
      logger.error('Fetch Sub Tasks', error);
      if (error instanceof Error) {
        return rejectWithValue(error.message);
      }
      return rejectWithValue('Failed to fetch sub tasks');
    }
  }
);

export const refreshTaskProgress = createAsyncThunk(
  'taskManagement/refreshTaskProgress',
  async (projectId: string, { rejectWithValue }) => {
    try {
      const response = await tasksApiService.refreshTaskProgress(projectId);
      return response.body;
    } catch (error) {
      logger.error('Refresh Task Progress', error);
      if (error instanceof Error) {
        return rejectWithValue(error.message);
      }
      return rejectWithValue('Failed to refresh task progress');
    }
  }
);

// Async thunk to reorder tasks with API call
export const reorderTasksWithAPI = createAsyncThunk(
  'taskManagement/reorderTasksWithAPI',
  async (
    { taskIds, newOrder, projectId }: { taskIds: string[]; newOrder: number[]; projectId: string },
    { rejectWithValue }
  ) => {
    try {
      // Make API call to update task order
      const response = await tasksApiService.reorderTasks({
        taskIds,
        newOrder,
        projectId,
      });

      if (response.done) {
        return { taskIds, newOrder };
      } else {
        return rejectWithValue('Failed to reorder tasks');
      }
    } catch (error) {
      logger.error('Reorder Tasks API Error:', error);
      return rejectWithValue('Failed to reorder tasks');
    }
  }
);

// Async thunk to move task between groups with API call
export const moveTaskToGroupWithAPI = createAsyncThunk(
  'taskManagement/moveTaskToGroupWithAPI',
  async (
    {
      taskId,
      groupType,
      groupValue,
      projectId,
    }: {
      taskId: string;
      groupType: 'status' | 'priority' | 'phase';
      groupValue: string;
      projectId: string;
    },
    { rejectWithValue }
  ) => {
    try {
      // Make API call to update task group
      const response = await tasksApiService.updateTaskGroup({
        taskId,
        groupType,
        groupValue,
        projectId,
      });

      if (response.done) {
        return { taskId, groupType, groupValue };
      } else {
        return rejectWithValue('Failed to move task');
      }
    } catch (error) {
      logger.error('Move Task API Error:', error);
      return rejectWithValue('Failed to move task');
    }
  }
);

// Add action to update task with subtasks
export const updateTaskWithSubtasks = createAsyncThunk(
  'taskManagement/updateTaskWithSubtasks',
  async ({ taskId, subtasks }: { taskId: string; subtasks: any[] }, { getState }) => {
    return { taskId, subtasks };
  }
);

// Create the slice
const taskManagementSlice = createSlice({
  name: 'taskManagement',
  initialState,
  reducers: {
    setTasks: (state, action: PayloadAction<Task[]>) => {
      const tasks = action.payload;
      state.ids = tasks.map(task => task.id);
      state.entities = tasks.reduce((acc, task) => {
        acc[task.id] = task;
        return acc;
      }, {} as Record<string, Task>);
    },
    addTask: (state, action: PayloadAction<Task>) => {
      const task = action.payload;
      state.ids.push(task.id);
      state.entities[task.id] = task;
    },
    addTaskToGroup: (state, action: PayloadAction<{ task: Task; groupId: string }>) => {
      const { task, groupId } = action.payload;
      state.ids.push(task.id);
      state.entities[task.id] = task;
      const group = state.groups.find(g => g.id === groupId);
      if (group) {
        group.taskIds.push(task.id);
      }
    },
    updateTask: (state, action: PayloadAction<Task>) => {
      const task = action.payload;
      state.entities[task.id] = task;
    },
    deleteTask: (state, action: PayloadAction<string>) => {
      const taskId = action.payload;
      delete state.entities[taskId];
      state.ids = state.ids.filter(id => id !== taskId);
      state.groups = state.groups.map(group => ({
        ...group,
        taskIds: group.taskIds.filter(id => id !== taskId),
      }));
    },
    bulkUpdateTasks: (state, action: PayloadAction<Task[]>) => {
      action.payload.forEach(task => {
        state.entities[task.id] = task;
      });
    },
    bulkDeleteTasks: (state, action: PayloadAction<string[]>) => {
      const taskIds = action.payload;
      taskIds.forEach(taskId => {
        delete state.entities[taskId];
      });
      state.ids = state.ids.filter(id => !taskIds.includes(id));
      state.groups = state.groups.map(group => ({
        ...group,
        taskIds: group.taskIds.filter(id => !taskIds.includes(id)),
      }));
    },
    reorderTasks: (state, action: PayloadAction<{ taskIds: string[]; groupId: string }>) => {
      const { taskIds, groupId } = action.payload;
      const group = state.groups.find(g => g.id === groupId);
      if (group) {
        group.taskIds = taskIds;
      }
    },
    moveTaskToGroup: (state, action: PayloadAction<{ taskId: string; groupId: string }>) => {
      const { taskId, groupId } = action.payload;
      state.groups = state.groups.map(group => ({
        ...group,
        taskIds:
          group.id === groupId
            ? [...group.taskIds, taskId]
            : group.taskIds.filter(id => id !== taskId),
      }));
    },
    moveTaskBetweenGroups: (
      state,
      action: PayloadAction<{
        taskId: string;
        sourceGroupId: string;
        targetGroupId: string;
      }>
    ) => {
      const { taskId, sourceGroupId, targetGroupId } = action.payload;
      state.groups = state.groups.map(group => ({
        ...group,
        taskIds:
          group.id === targetGroupId
            ? [...group.taskIds, taskId]
            : group.id === sourceGroupId
            ? group.taskIds.filter(id => id !== taskId)
            : group.taskIds,
      }));
    },
    optimisticTaskMove: (
      state,
      action: PayloadAction<{
        taskId: string;
        sourceGroupId: string;
        targetGroupId: string;
      }>
    ) => {
      const { taskId, sourceGroupId, targetGroupId } = action.payload;
      state.groups = state.groups.map(group => ({
        ...group,
        taskIds:
          group.id === targetGroupId
            ? [...group.taskIds, taskId]
            : group.id === sourceGroupId
            ? group.taskIds.filter(id => id !== taskId)
            : group.taskIds,
      }));
    },
    reorderTasksInGroup: (
      state,
      action: PayloadAction<{ taskIds: string[]; groupId: string }>
    ) => {
      const { taskIds, groupId } = action.payload;
      const group = state.groups.find(g => g.id === groupId);
      if (group) {
        group.taskIds = taskIds;
      }
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
    setSelectedPriorities: (state, action: PayloadAction<string[]>) => {
      state.selectedPriorities = action.payload;
    },
    setSearch: (state, action: PayloadAction<string>) => {
      state.search = action.payload;
    },
    resetTaskManagement: state => {
      state.loading = false;
      state.error = null;
      state.groups = [];
      state.grouping = undefined;
      state.selectedPriorities = [];
      state.search = '';
      state.ids = [];
      state.entities = {};
    },
    toggleTaskExpansion: (state, action: PayloadAction<string>) => {
      const task = state.entities[action.payload];
      if (task) {
        task.show_sub_tasks = !task.show_sub_tasks;
      }
    },
    addSubtaskToParent: (
      state,
      action: PayloadAction<{ parentId: string; subtask: Task }>
    ) => {
      const { parentId, subtask } = action.payload;
      const parent = state.entities[parentId];
      if (parent) {
        state.ids.push(subtask.id);
        state.entities[subtask.id] = subtask;
        if (!parent.sub_tasks) {
          parent.sub_tasks = [];
        }
        parent.sub_tasks.push(subtask);
        parent.sub_tasks_count = (parent.sub_tasks_count || 0) + 1;
      }
    },
  },
  extraReducers: builder => {
    builder
      .addCase(fetchTasksV3.pending, state => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchTasksV3.fulfilled, (state, action) => {
        state.loading = false;
        state.error = null;

        // Ensure we have tasks before updating state
        if (action.payload.tasks && action.payload.tasks.length > 0) {
          // Update tasks
          const tasks = action.payload.tasks;
          state.ids = tasks.map(task => task.id);
          state.entities = tasks.reduce((acc, task) => {
            acc[task.id] = task;
            return acc;
          }, {} as Record<string, Task>);

          // Update groups
          state.groups = action.payload.groups;
          state.grouping = action.payload.grouping;

          // Verify task IDs match group taskIds
          const taskIds = new Set(Object.keys(state.entities));
          const groupTaskIds = new Set(state.groups.flatMap(g => g.taskIds));

          // Ensure all tasks have IDs and all group taskIds exist
          const validTaskIds = new Set(Object.keys(state.entities));
          state.groups = state.groups.map((group: TaskGroup) => ({
            ...group,
            taskIds: group.taskIds.filter((id: string) => validTaskIds.has(id)),
          }));
        } else {
          // Set empty state but don't show error
          state.ids = [];
          state.entities = {};
          state.groups = [];
        }
      })
      .addCase(fetchTasksV3.rejected, (state, action) => {
        state.loading = false;
        // Provide a more descriptive error message
        state.error = action.error.message || action.payload || 'An error occurred while fetching tasks. Please try again.';
        // Clear task data on error to prevent stale state
        state.ids = [];
        state.entities = {};
        state.groups = [];
      })
      .addCase(fetchSubTasks.pending, (state, action) => {
        // Don't set global loading state for subtasks
        state.error = null;
      })
      .addCase(fetchSubTasks.fulfilled, (state, action) => {
        const { parentTaskId, subtasks } = action.payload;
        const parentTask = state.entities[parentTaskId];
        if (parentTask) {
          parentTask.sub_tasks = subtasks;
          parentTask.sub_tasks_count = subtasks.length;
          parentTask.show_sub_tasks = true;
        }
      })
      .addCase(fetchSubTasks.rejected, (state, action) => {
        // Set error but don't clear task data
        state.error = action.error.message || action.payload || 'Failed to fetch subtasks. Please try again.';
      });
  },
});

// Export the slice reducer and actions
export const {
  setTasks,
  addTask,
  addTaskToGroup,
  updateTask,
  deleteTask,
  bulkUpdateTasks,
  bulkDeleteTasks,
  reorderTasks,
  moveTaskToGroup,
  moveTaskBetweenGroups,
  optimisticTaskMove,
  reorderTasksInGroup,
  setLoading,
  setError,
  setSelectedPriorities,
  setSearch,
  resetTaskManagement,
  toggleTaskExpansion,
  addSubtaskToParent,
} = taskManagementSlice.actions;

// Export the selectors
export const selectAllTasks = (state: RootState) => state.taskManagement.entities;
export const selectAllTasksArray = (state: RootState) => Object.values(state.taskManagement.entities);
export const selectTaskById = (state: RootState, taskId: string) => state.taskManagement.entities[taskId];
export const selectTaskIds = (state: RootState) => state.taskManagement.ids;
export const selectGroups = (state: RootState) => state.taskManagement.groups;
export const selectGrouping = (state: RootState) => state.taskManagement.grouping;
export const selectLoading = (state: RootState) => state.taskManagement.loading;
export const selectError = (state: RootState) => state.taskManagement.error;
export const selectSelectedPriorities = (state: RootState) => state.taskManagement.selectedPriorities;
export const selectSearch = (state: RootState) => state.taskManagement.search;

// Memoized selectors
export const selectTasksByStatus = (state: RootState, status: string) =>
  Object.values(state.taskManagement.entities).filter(task => task.status === status);

export const selectTasksByPriority = (state: RootState, priority: string) =>
  Object.values(state.taskManagement.entities).filter(task => task.priority === priority);

export const selectTasksByPhase = (state: RootState, phase: string) =>
  Object.values(state.taskManagement.entities).filter(task => task.phase === phase);

// Export the reducer as default
export default taskManagementSlice.reducer;

// V3 API selectors - no processing needed, data is pre-processed by backend
export const selectTaskGroupsV3 = (state: RootState) => state.taskManagement.groups;
export const selectCurrentGroupingV3 = (state: RootState) => state.taskManagement.grouping;
