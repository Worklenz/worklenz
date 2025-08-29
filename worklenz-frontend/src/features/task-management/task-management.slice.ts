import {
  createSlice,
  createEntityAdapter,
  PayloadAction,
  createAsyncThunk,
  EntityState,
  EntityId,
  createSelector,
} from '@reduxjs/toolkit';
import {
  Task,
  TaskManagementState,
  TaskGroup,
  TaskGrouping,
  getSortOrderField,
} from '@/types/task-management.types';
import { ITaskListColumn } from '@/types/tasks/taskList.types';
import { RootState } from '@/app/store';
import {
  tasksApiService,
  ITaskListConfigV2,
  ITaskListV3Response,
} from '@/api/tasks/tasks.api.service';
import { tasksCustomColumnsService } from '@/api/tasks/tasks-custom-columns.service';
import logger from '@/utils/errorLogger';
import { DEFAULT_TASK_NAME } from '@/shared/constants';
import { InlineMember } from '@/types/teamMembers/inlineMember.types';

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
  archived: false,
  loadingSubtasks: {},
  // Add column-related state
  loadingColumns: false,
  columns: [],
  customColumns: [],
  // Add sort-related state
  sortField: '',
  sortOrder: 'ASC',
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
          title: task.title && task.title.trim() ? task.title.trim() : DEFAULT_TASK_NAME,
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
              color: l.color || '#1890ff',
              end: l.end,
              names: l.names,
            })) || [],
          dueDate: task.dueDate,
          startDate: task.startDate,
          timeTracking: {
            estimated: convertTimeValue(task.total_time),
            logged: convertTimeValue(task.time_spent),
          },
          customFields: {},
          createdAt: task.createdAt || task.created_at || new Date().toISOString(),
          updatedAt: task.updatedAt || task.updated_at || new Date().toISOString(),
          created_at: task.createdAt || task.created_at || new Date().toISOString(),
          updated_at: task.updatedAt || task.updated_at || new Date().toISOString(),
          order: typeof task.sort_order === 'number' ? task.sort_order : 0,
          // Ensure all Task properties are mapped, even if undefined in API response
          sub_tasks: task.sub_tasks || [],
          sub_tasks_count: task.sub_tasks_count || 0,
          show_sub_tasks: task.show_sub_tasks || false,
          parent_task_id: task.parent_task_id || undefined,
          weight: task.weight || 0,
          color: task.color || undefined,
          statusColor: task.statusColor || undefined,
          priorityColor: task.priorityColor || undefined,
          comments_count: task.comments_count || 0,
          attachments_count: task.attachments_count || 0,
          has_dependencies: task.has_dependencies || false,
          schedule_id: task.schedule_id || null,
          reporter: task.reporter || undefined,
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

      // Get search value from taskManagement slice
      const searchValue = state.taskManagement.search || '';

      // Get archived state from task management slice
      const archivedState = state.taskManagement.archived;

      // Get sort state from task management slice
      const sortField = state.taskManagement.sortField;
      const sortOrder = state.taskManagement.sortOrder;

      const config: ITaskListConfigV2 = {
        id: projectId,
        archived: archivedState,
        group: currentGrouping || '',
        field: sortField,
        order: sortOrder,
        search: searchValue,
        statuses: '',
        members: selectedAssignees,
        projects: '',
        isSubtasksInclude: false,
        labels: selectedLabels,
        priorities: selectedPriorities,
        customColumns: true,
      };

      const response = await tasksApiService.getTaskListV3(config);

      // Ensure tasks are properly normalized
      const tasks: Task[] = response.body.allTasks.map((task: any) => {
        const now = new Date().toISOString();

        const transformedTask = {
          id: task.id,
          task_key: task.task_key || task.key || '',
          title: task.title && task.title.trim() ? task.title.trim() : DEFAULT_TASK_NAME,
          description: task.description || '',
          status: task.status || 'todo',
          priority: task.priority || 'medium',
          phase: task.phase || 'Development',
          progress: typeof task.complete_ratio === 'number' ? task.complete_ratio : 0,
          assignees: task.assignees?.map((a: { team_member_id: string }) => a.team_member_id) || [],
          assignee_names: task.assignee_names || task.names || [],
          labels:
            task.labels?.map(
              (l: {
                id: string;
                label_id: string;
                name: string;
                color: string;
                end: boolean;
                names: string[];
              }) => ({
                id: l.id || l.label_id,
                name: l.name,
                color: l.color || '#1890ff',
                end: l.end,
                names: l.names,
              })
            ) || [],
          all_labels:
            task.all_labels?.map(
              (l: { id: string; label_id: string; name: string; color_code: string }) => ({
                id: l.id || l.label_id,
                name: l.name,
                color_code: l.color_code || '#1890ff',
              })
            ) || [],
          dueDate: task.dueDate,
          startDate: task.startDate,
          timeTracking: {
            estimated: task.timeTracking?.estimated || 0,
            logged: task.timeTracking?.logged || 0,
          },
          customFields: {},
          custom_column_values: task.custom_column_values || {},
          createdAt: task.createdAt || task.created_at || now,
          updatedAt: task.updatedAt || task.updated_at || now,
          created_at: task.createdAt || task.created_at || now,
          updated_at: task.updatedAt || task.updated_at || now,
          order: typeof task.sort_order === 'number' ? task.sort_order : 0,
          sub_tasks: task.sub_tasks || [],
          sub_tasks_count: task.sub_tasks_count || 0,
          show_sub_tasks: task.show_sub_tasks || false,
          parent_task_id: task.parent_task_id || undefined,
          weight: task.weight || 0,
          color: task.color || undefined,
          statusColor: task.statusColor || undefined,
          priorityColor: task.priorityColor || undefined,
          comments_count: task.comments_count || 0,
          attachments_count: task.attachments_count || 0,
          has_dependencies: task.has_dependencies || false,
          schedule_id: task.schedule_id || null,
          reporter: task.reporter || undefined,
        };

        return transformedTask;
      });

      return {
        allTasks: tasks,
        groups: response.body.groups,
        grouping: response.body.grouping,
        totalTasks: response.body.totalTasks,
      };
    } catch (error) {
      logger.error('Fetch Tasks V3', error);
      if (error instanceof Error) {
        return rejectWithValue(error.message);
      }
      return rejectWithValue('Failed to fetch tasks V3');
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

// Add async thunk to fetch task list columns
export const fetchTaskListColumns = createAsyncThunk(
  'taskManagement/fetchTaskListColumns',
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

// Add async thunk to fetch custom columns
export const fetchCustomColumns = createAsyncThunk(
  'taskManagement/fetchCustomColumns',
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

// Add async thunk to update column visibility
export const updateColumnVisibility = createAsyncThunk(
  'taskManagement/updateColumnVisibility',
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

// Create the slice
const taskManagementSlice = createSlice({
  name: 'taskManagement',
  initialState,
  reducers: {
    setTasks: (state, action: PayloadAction<Task[]>) => {
      const tasks = action.payload;
      state.ids = tasks.map(task => task.id);
      state.entities = tasks.reduce(
        (acc, task) => {
          acc[task.id] = task;
          return acc;
        },
        {} as Record<string, Task>
      );
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
      let group = state.groups.find(g => g.id === groupId);

      // If group doesn't exist and it's "Unmapped", create it dynamically
      if (!group && groupId === 'Unmapped') {
        const unmappedGroup = {
          id: 'Unmapped',
          title: 'Unmapped',
          taskIds: [],
          type: 'phase' as const,
          color: '#fbc84c69',
          groupValue: 'Unmapped',
        };
        state.groups.push(unmappedGroup);
        group = unmappedGroup;
      }

      if (group) {
        group.taskIds.push(task.id);
      }
    },
    updateTask: (state, action: PayloadAction<Task>) => {
      tasksAdapter.upsertOne(state as EntityState<Task, string>, action.payload);
      // Additionally, update the task within its group if necessary (e.g., if status changed)
      const updatedTask = action.payload;
      const oldTask = state.entities[updatedTask.id];

      if (
        oldTask &&
        state.grouping?.id === IGroupBy.STATUS &&
        oldTask.status !== updatedTask.status
      ) {
        // Remove from old status group
        const oldGroup = state.groups.find(group => group.id === oldTask.status);
        if (oldGroup) {
          oldGroup.taskIds = oldGroup.taskIds.filter(id => id !== updatedTask.id);
        }

        // Add to new status group
        const newGroup = state.groups.find(group => group.id === updatedTask.status);
        if (newGroup) {
          newGroup.taskIds.push(updatedTask.id);
        }
      }
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
      action: PayloadAction<{
        sourceTaskId: string;
        destinationTaskId: string;
        sourceGroupId: string;
        destinationGroupId: string;
      }>
    ) => {
      const { sourceTaskId, destinationTaskId, sourceGroupId, destinationGroupId } = action.payload;

      // Get a mutable copy of entities for updates
      const newEntities = { ...state.entities };

      const sourceTask = newEntities[sourceTaskId];
      const destinationTask = newEntities[destinationTaskId];

      if (!sourceTask || !destinationTask) return;

      if (sourceGroupId === destinationGroupId) {
        // Reordering within the same group
        const group = state.groups.find(g => g.id === sourceGroupId);
        if (group) {
          const newTasks = Array.from(group.taskIds);
          const sourceIndex = newTasks.indexOf(sourceTaskId);
          const destinationIndex = newTasks.indexOf(destinationTaskId);

          // Remove the task from its current position
          const [removed] = newTasks.splice(sourceIndex, 1);

          // Calculate the insertion index
          let insertIndex = destinationIndex;
          if (sourceIndex < destinationIndex) {
            // When dragging down, we need to insert after the destination
            insertIndex = destinationIndex;
          } else {
            // When dragging up, we insert before the destination
            insertIndex = destinationIndex;
          }

          newTasks.splice(insertIndex, 0, removed);
          group.taskIds = newTasks;

          // Update order for affected tasks using the appropriate sort field
          const sortField = getSortOrderField(state.grouping?.id);
          newTasks.forEach((id, index) => {
            if (newEntities[id]) {
              newEntities[id] = { ...newEntities[id], [sortField]: index };
            }
          });
        }
      } else {
        // Moving between different groups
        const sourceGroup = state.groups.find(g => g.id === sourceGroupId);
        const destinationGroup = state.groups.find(g => g.id === destinationGroupId);

        if (sourceGroup && destinationGroup) {
          // Remove from source group
          sourceGroup.taskIds = sourceGroup.taskIds.filter(id => id !== sourceTaskId);

          // Add to destination group at the correct position relative to destinationTask
          const destinationIndex = destinationGroup.taskIds.indexOf(destinationTaskId);
          if (destinationIndex !== -1) {
            destinationGroup.taskIds.splice(destinationIndex, 0, sourceTaskId);
          } else {
            destinationGroup.taskIds.push(sourceTaskId); // Add to end if destination task not found
          }

          // Do NOT update the task's grouping field (priority, phase, status) here.
          // This will be handled by the socket event handler after backend confirmation.

          // Update order for affected tasks in both groups using the appropriate sort field
          const sortField = getSortOrderField(state.grouping?.id);
          sourceGroup.taskIds.forEach((id, index) => {
            if (newEntities[id]) newEntities[id] = { ...newEntities[id], [sortField]: index };
          });
          destinationGroup.taskIds.forEach((id, index) => {
            if (newEntities[id]) newEntities[id] = { ...newEntities[id], [sortField]: index };
          });
        }
      }

      // Update the state's entities after all modifications
      state.entities = newEntities;
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
    setArchived: (state, action: PayloadAction<boolean>) => {
      state.archived = action.payload;
    },
    toggleArchived: state => {
      state.archived = !state.archived;
    },
    setSortField: (state, action: PayloadAction<string>) => {
      state.sortField = action.payload;
    },
    setSortOrder: (state, action: PayloadAction<'ASC' | 'DESC'>) => {
      state.sortOrder = action.payload;
    },
    setSort: (state, action: PayloadAction<{ field: string; order: 'ASC' | 'DESC' }>) => {
      state.sortField = action.payload.field;
      state.sortOrder = action.payload.order;
    },
    resetTaskManagement: state => {
      state.loading = false;
      state.error = null;
      state.groups = [];
      state.grouping = undefined;
      state.selectedPriorities = [];
      state.search = '';
      state.archived = false;
      state.sortField = '';
      state.sortOrder = 'ASC';
      state.ids = [];
      state.entities = {};
    },
    toggleTaskExpansion: (state, action: PayloadAction<string>) => {
      const task = state.entities[action.payload];
      if (task) {
        task.show_sub_tasks = !task.show_sub_tasks;
      }
    },
    addSubtaskToParent: (state, action: PayloadAction<{ parentId: string; subtask: Task }>) => {
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
    createSubtask: (
      state,
      action: PayloadAction<{ parentTaskId: string; name: string; projectId: string }>
    ) => {
      const { parentTaskId, name, projectId } = action.payload;
      const parent = state.entities[parentTaskId];
      if (parent) {
        // Create a temporary subtask - the real one will come from the socket
        const tempId = `temp-${Date.now()}`;
        const tempSubtask: Task = {
          id: tempId,
          task_key: '',
          title: name,
          name: name,
          description: '',
          status: 'todo',
          priority: 'low',
          phase: 'Development',
          progress: 0,
          assignees: [],
          assignee_names: [],
          labels: [],
          dueDate: undefined,
          due_date: undefined,
          startDate: undefined,
          timeTracking: {
            estimated: 0,
            logged: 0,
          },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          order: 0,
          parent_task_id: parentTaskId,
          is_sub_task: true,
          sub_tasks_count: 0,
          show_sub_tasks: false,
          isTemporary: true, // Mark as temporary
        };

        // Add temporary subtask for immediate UI feedback
        if (!parent.sub_tasks) {
          parent.sub_tasks = [];
        }
        parent.sub_tasks.push(tempSubtask);
        parent.sub_tasks_count = (parent.sub_tasks_count || 0) + 1;
        state.entities[tempId] = tempSubtask;
        state.ids.push(tempId);
      }
    },
    removeTemporarySubtask: (
      state,
      action: PayloadAction<{ parentTaskId: string; tempId: string }>
    ) => {
      const { parentTaskId, tempId } = action.payload;
      const parent = state.entities[parentTaskId];
      if (parent && parent.sub_tasks) {
        parent.sub_tasks = parent.sub_tasks.filter(subtask => subtask.id !== tempId);
        parent.sub_tasks_count = Math.max((parent.sub_tasks_count || 0) - 1, 0);
        delete state.entities[tempId];
        state.ids = state.ids.filter(id => id !== tempId);
      }
    },
    updateTaskAssignees: (
      state,
      action: PayloadAction<{
        taskId: string;
        assigneeIds: string[];
        assigneeNames: InlineMember[];
      }>
    ) => {
      const { taskId, assigneeIds, assigneeNames } = action.payload;
      const existingTask = state.entities[taskId];

      if (existingTask) {
        state.entities[taskId] = {
          ...existingTask,
          assignees: assigneeIds,
          assignee_names: assigneeNames,
        };
      }
    },
    // Add column-related reducers
    toggleColumnVisibility: (state, action: PayloadAction<string>) => {
      const column = state.columns.find(col => col.key === action.payload);
      if (column) {
        column.pinned = !column.pinned;
      }
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
    // Add action to sync backend columns with local fields
    syncColumnsWithFields: (state, action: PayloadAction<{ projectId: string; fields: any[] }>) => {
      const { fields } = action.payload;
      // Update columns based on local fields
      state.columns = state.columns.map(column => {
        const field = fields.find(f => f.key === column.key);
        if (field) {
          return {
            ...column,
            pinned: field.visible,
          };
        }
        return column;
      });
    },
    // Add action to update task counts (comments, attachments, etc.)
    updateTaskCounts: (
      state,
      action: PayloadAction<{
        taskId: string;
        counts: {
          comments_count?: number;
          attachments_count?: number;
          has_subscribers?: boolean;
          has_dependencies?: boolean;
          schedule_id?: string | null; // Add schedule_id for recurring tasks
        };
      }>
    ) => {
      const { taskId, counts } = action.payload;
      const task = state.entities[taskId];
      if (task) {
        // Update only the provided count fields
        if (counts.comments_count !== undefined) {
          task.comments_count = counts.comments_count;
        }
        if (counts.attachments_count !== undefined) {
          task.attachments_count = counts.attachments_count;
        }
        if (counts.has_subscribers !== undefined) {
          task.has_subscribers = counts.has_subscribers;
        }
        if (counts.has_dependencies !== undefined) {
          task.has_dependencies = counts.has_dependencies;
        }
        if (counts.schedule_id !== undefined) {
          task.schedule_id = counts.schedule_id;
        }
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
        const { allTasks, groups, grouping } = action.payload;

        // Preserve existing timer state from old tasks before replacing
        const oldTasks = state.entities;
        const tasksWithTimers = (allTasks || []).map(task => {
          const oldTask = oldTasks[task.id];
          if (oldTask?.timeTracking?.activeTimer) {
            // Preserve the timer state from the old task
            return {
              ...task,
              timeTracking: {
                ...task.timeTracking,
                activeTimer: oldTask.timeTracking.activeTimer,
              },
            };
          }
          return task;
        });

        tasksAdapter.setAll(state as EntityState<Task, string>, tasksWithTimers); // Ensure allTasks is an array
        state.ids = tasksWithTimers.map(task => task.id); // Also update ids
        state.groups = groups;
        state.grouping = grouping;
      })
      .addCase(fetchTasksV3.rejected, (state, action) => {
        state.loading = false;
        state.error =
          action.error?.message || (action.payload as string) || 'Failed to load tasks (V3)';
        state.ids = [];
        state.entities = {};
        state.groups = [];
      })
      .addCase(fetchSubTasks.pending, (state, action) => {
        // Set loading state for specific task
        const { taskId } = action.meta.arg;
        state.loadingSubtasks[taskId] = true;
        state.error = null;
      })
      .addCase(fetchSubTasks.fulfilled, (state, action) => {
        const { parentTaskId, subtasks } = action.payload;
        const parentTask = state.entities[parentTaskId];
        // Clear loading state
        state.loadingSubtasks[parentTaskId] = false;
        if (parentTask && subtasks) {
          // Convert subtasks to the proper format
          const convertedSubtasks = subtasks.map(subtask => ({
            id: subtask.id || '',
            task_key: subtask.task_key || '',
            title: subtask.name || subtask.title || '',
            name: subtask.name || subtask.title || '',
            description: subtask.description || '',
            status: subtask.status || 'todo',
            priority: subtask.priority || 'low',
            phase: subtask.phase_name || subtask.phase || 'Development',
            progress: subtask.complete_ratio || subtask.progress || 0,
            assignees: subtask.assignees || [],
            assignee_names: subtask.assignee_names || subtask.names || [],
            labels: subtask.labels || [],
            dueDate: subtask.end_date || subtask.dueDate,
            due_date: subtask.end_date || subtask.due_date,
            startDate: subtask.start_date || subtask.startDate,
            timeTracking: subtask.timeTracking || {
              estimated: 0,
              logged: 0,
            },
            createdAt: subtask.created_at || subtask.createdAt || new Date().toISOString(),
            created_at: subtask.created_at || subtask.createdAt || new Date().toISOString(),
            updatedAt: subtask.updated_at || subtask.updatedAt || new Date().toISOString(),
            updated_at: subtask.updated_at || subtask.updatedAt || new Date().toISOString(),
            order: subtask.sort_order || subtask.order || 0,
            parent_task_id: parentTaskId,
            is_sub_task: true,
            sub_tasks_count: subtask.sub_tasks_count || 0, // Use actual count from backend
            show_sub_tasks: false,
          }));

          // Update parent task with subtasks
          parentTask.sub_tasks = convertedSubtasks;
          parentTask.sub_tasks_count = convertedSubtasks.length;

          // Add subtasks to entities so they can be accessed by ID
          convertedSubtasks.forEach(subtask => {
            state.entities[subtask.id] = subtask;
            if (!state.ids.includes(subtask.id)) {
              state.ids.push(subtask.id);
            }
          });
        }
      })
      .addCase(fetchSubTasks.rejected, (state, action) => {
        // Clear loading state and set error
        const { taskId } = action.meta.arg;
        state.loadingSubtasks[taskId] = false;
        state.error =
          action.error.message || action.payload || 'Failed to fetch subtasks. Please try again.';
      })
      .addCase(fetchTasks.pending, state => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchTasks.fulfilled, (state, action) => {
        state.loading = false;
        tasksAdapter.setAll(state as EntityState<Task, string>, action.payload || []); // Ensure payload is an array
        state.ids = (action.payload || []).map(task => task.id); // Also update ids
        state.groups = []; // Assuming no groups when using old fetchTasks
        state.grouping = undefined; // Assuming no grouping when using old fetchTasks
      })
      .addCase(fetchTasks.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error?.message || (action.payload as string) || 'Failed to load tasks';
        state.ids = [];
        state.entities = {};
        state.groups = [];
      })
      // Add column-related extraReducers
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
      })
      .addCase(updateColumnVisibility.fulfilled, (state, action) => {
        const column = state.columns.find(col => col.key === action.payload.key);
        if (column) {
          column.pinned = action.payload.pinned;
        }
      })
      .addCase(updateColumnVisibility.rejected, (state, action) => {
        state.error = action.payload as string;
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
  setArchived,
  toggleArchived,
  setSortField,
  setSortOrder,
  setSort,
  resetTaskManagement,
  toggleTaskExpansion,
  addSubtaskToParent,
  updateTaskAssignees,
  createSubtask,
  removeTemporarySubtask,
  // Add column-related actions
  toggleColumnVisibility,
  addCustomColumn,
  updateCustomColumn,
  deleteCustomColumn,
  syncColumnsWithFields,
  updateTaskCounts,
} = taskManagementSlice.actions;

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

// Export the reducer as default
export default taskManagementSlice.reducer;

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
  const fields = state.taskManagementFields || [];

  if (columns.length === 0 || fields.length === 0) return true;

  return !fields.some(field => {
    const backendColumn = columns.find(c => c.key === field.key);
    if (backendColumn) {
      return (backendColumn.pinned ?? false) !== field.visible;
    }
    return false;
  });
};
