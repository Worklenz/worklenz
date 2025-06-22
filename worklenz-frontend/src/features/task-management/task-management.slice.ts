import { createSlice, createEntityAdapter, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit';
import { Task, TaskManagementState } from '@/types/task-management.types';
import { RootState } from '@/app/store';
import { tasksApiService, ITaskListConfigV2 } from '@/api/tasks/tasks.api.service';
import logger from '@/utils/errorLogger';

// Entity adapter for normalized state
const tasksAdapter = createEntityAdapter<Task>({
  sortComparer: (a, b) => a.order - b.order,
});

const initialState: TaskManagementState = {
  entities: {},
  ids: [],
  loading: false,
  error: null,
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
            return hours + (minutes / 60);
          }
        }
        return 0;
      };

      // Transform the API response to our Task type
      const tasks: Task[] = response.body.flatMap((group: any) => 
        group.tasks.map((task: any) => ({
          id: task.id,
          task_key: task.task_key || '',
          title: task.name || '',
          description: task.description || '',
          status: task.status_name?.toLowerCase() || 'todo',
          priority: task.priority_name?.toLowerCase() || 'medium',
          phase: task.phase_name || 'Development',
          progress: typeof task.complete_ratio === 'number' ? task.complete_ratio : 0,
          assignees: task.assignees?.map((a: any) => a.team_member_id) || [],
          labels: task.labels?.map((l: any) => ({
            id: l.id || l.label_id,
            name: l.name,
            color: l.color_code || '#1890ff',
            end: l.end,
            names: l.names
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

const taskManagementSlice = createSlice({
  name: 'taskManagement',
  initialState: tasksAdapter.getInitialState(initialState),
  reducers: {
    // Basic CRUD operations
    setTasks: (state, action: PayloadAction<Task[]>) => {
      tasksAdapter.setAll(state, action.payload);
      state.loading = false;
      state.error = null;
    },
    
    addTask: (state, action: PayloadAction<Task>) => {
      tasksAdapter.addOne(state, action.payload);
    },
    
    updateTask: (state, action: PayloadAction<{ id: string; changes: Partial<Task> }>) => {
      tasksAdapter.updateOne(state, {
        id: action.payload.id,
        changes: {
          ...action.payload.changes,
          updatedAt: new Date().toISOString(),
        },
      });
    },
    
    deleteTask: (state, action: PayloadAction<string>) => {
      tasksAdapter.removeOne(state, action.payload);
    },
    
    // Bulk operations
    bulkUpdateTasks: (state, action: PayloadAction<{ ids: string[]; changes: Partial<Task> }>) => {
      const { ids, changes } = action.payload;
      const updates = ids.map(id => ({
        id,
        changes: {
          ...changes,
          updatedAt: new Date().toISOString(),
        },
      }));
      tasksAdapter.updateMany(state, updates);
    },
    
    bulkDeleteTasks: (state, action: PayloadAction<string[]>) => {
      tasksAdapter.removeMany(state, action.payload);
    },
    
    // Drag and drop operations
    reorderTasks: (state, action: PayloadAction<{ taskIds: string[]; newOrder: number[] }>) => {
      const { taskIds, newOrder } = action.payload;
      const updates = taskIds.map((id, index) => ({
        id,
        changes: { order: newOrder[index] },
      }));
      tasksAdapter.updateMany(state, updates);
    },
    
    moveTaskToGroup: (state, action: PayloadAction<{ taskId: string; groupType: 'status' | 'priority' | 'phase'; groupValue: string }>) => {
      const { taskId, groupType, groupValue } = action.payload;
      const changes: Partial<Task> = {
        updatedAt: new Date().toISOString(),
      };
      
      // Update the appropriate field based on group type
      if (groupType === 'status') {
        changes.status = groupValue as Task['status'];
      } else if (groupType === 'priority') {
        changes.priority = groupValue as Task['priority'];
      } else if (groupType === 'phase') {
        changes.phase = groupValue;
      }
      
      tasksAdapter.updateOne(state, { id: taskId, changes });
    },
    
    // Loading states
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
      state.loading = false;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchTasks.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchTasks.fulfilled, (state, action) => {
        state.loading = false;
        state.error = null;
        tasksAdapter.setAll(state, action.payload);
      })
      .addCase(fetchTasks.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export const {
  setTasks,
  addTask,
  updateTask,
  deleteTask,
  bulkUpdateTasks,
  bulkDeleteTasks,
  reorderTasks,
  moveTaskToGroup,
  setLoading,
  setError,
} = taskManagementSlice.actions;

// Selectors
export const taskManagementSelectors = tasksAdapter.getSelectors<RootState>(
  (state) => state.taskManagement
);

// Additional selectors
export const selectTasksByStatus = (state: RootState, status: string) =>
  taskManagementSelectors.selectAll(state).filter(task => task.status === status);

export const selectTasksByPriority = (state: RootState, priority: string) =>
  taskManagementSelectors.selectAll(state).filter(task => task.priority === priority);

export const selectTasksByPhase = (state: RootState, phase: string) =>
  taskManagementSelectors.selectAll(state).filter(task => task.phase === phase);

export const selectTasksLoading = (state: RootState) => state.taskManagement.loading;
export const selectTasksError = (state: RootState) => state.taskManagement.error;

export default taskManagementSlice.reducer; 