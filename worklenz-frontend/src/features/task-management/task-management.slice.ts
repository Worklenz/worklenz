import { createSlice, createEntityAdapter, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit';
import { Task, TaskManagementState } from '@/types/task-management.types';
import { RootState } from '@/app/store';
import { tasksApiService, ITaskListConfigV2, ITaskListV3Response } from '@/api/tasks/tasks.api.service';
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
  groups: [],
  grouping: null,
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
              case 0: priorityIdToNameMap[task.priority] = 'low'; break;
              case 1: priorityIdToNameMap[task.priority] = 'medium'; break;
              case 2: priorityIdToNameMap[task.priority] = 'high'; break;
              case 3: priorityIdToNameMap[task.priority] = 'critical'; break;
              default: priorityIdToNameMap[task.priority] = 'medium';
            }
          }
        });
      });

      // Transform the API response to our Task type
      const tasks: Task[] = response.body.flatMap((group: any) => 
        group.tasks.map((task: any) => ({
          id: task.id,
          task_key: task.task_key || '',
          title: task.name || '',
          description: task.description || '',
          status: statusIdToNameMap[task.status] || 'todo',
          priority: priorityIdToNameMap[task.priority] || 'medium',
          phase: task.phase_name || 'Development',
          progress: typeof task.complete_ratio === 'number' ? task.complete_ratio : 0,
          assignees: task.assignees?.map((a: any) => a.team_member_id) || [],
          assignee_names: task.assignee_names || task.names || [],
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

// New V3 fetch that minimizes frontend processing
export const fetchTasksV3 = createAsyncThunk(
  'taskManagement/fetchTasksV3',
  async (projectId: string, { rejectWithValue, getState }) => {
    try {
      const state = getState() as RootState;
      const currentGrouping = state.grouping.currentGrouping;
      
      // Get selected labels from taskReducer
      const selectedLabels = state.taskReducer.labels
        ? state.taskReducer.labels.filter(l => l.selected).map(l => l.id).join(' ')
        : '';
      
      // Get selected assignees from taskReducer
      const selectedAssignees = state.taskReducer.taskAssignees
        ? state.taskReducer.taskAssignees.filter(m => m.selected).map(m => m.id).join(' ')
        : '';
      
      // Get selected priorities from taskReducer (consistent with other slices)
      const selectedPriorities = state.taskReducer.priorities
        ? state.taskReducer.priorities.join(' ')
        : '';
      
      // Get search value from taskReducer
      const searchValue = state.taskReducer.search || '';
      
      console.log('fetchTasksV3 - selectedPriorities:', selectedPriorities);
      console.log('fetchTasksV3 - searchValue:', searchValue);
      
      const config: ITaskListConfigV2 = {
        id: projectId,
        archived: false,
        group: currentGrouping,
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
      
      // Minimal processing - tasks are already processed by backend
      return {
        tasks: response.body.allTasks,
        groups: response.body.groups,
        grouping: response.body.grouping,
        totalTasks: response.body.totalTasks
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
    

    addTaskToGroup: (state, action: PayloadAction<{ task: Task; groupId?: string }>) => {
      const { task, groupId } = action.payload;
      
      // Add to entity adapter
      tasksAdapter.addOne(state, task);
      
      // Add to groups array for V3 API compatibility
      if (state.groups && state.groups.length > 0) {
        console.log('🔍 Looking for group with ID:', groupId);
        console.log('📋 Available groups:', state.groups.map(g => ({ id: g.id, title: g.title })));
        
        // Find the target group using the provided UUID
        const targetGroup = state.groups.find(group => {
          // If a specific groupId (UUID) is provided, use it directly
          if (groupId && group.id === groupId) {
            return true;
          }
          
          return false;
        });
        
        if (targetGroup) {
          console.log('✅ Found target group:', targetGroup.title);
          // Add task ID to the end of the group's taskIds array (newest last)
          targetGroup.taskIds.push(task.id);
          console.log('✅ Task added to group. New taskIds count:', targetGroup.taskIds.length);
          
          // Also add to the tasks array if it exists (for backward compatibility)
          if ((targetGroup as any).tasks) {
            (targetGroup as any).tasks.push(task);
          }
        } else {
          console.warn('❌ No matching group found for groupId:', groupId);
        }
      }
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
    
    // Optimized drag and drop operations
    reorderTasks: (state, action: PayloadAction<{ taskIds: string[]; newOrder: number[] }>) => {
      const { taskIds, newOrder } = action.payload;
      
      // Batch update for better performance
      const updates = taskIds.map((id, index) => ({
        id,
        changes: { 
          order: newOrder[index],
          updatedAt: new Date().toISOString(),
        },
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
    
    // Optimistic update for drag operations - reduces perceived lag
    optimisticTaskMove: (state, action: PayloadAction<{ taskId: string; newGroupId: string; newIndex: number }>) => {
      const { taskId, newGroupId, newIndex } = action.payload;
      const task = state.entities[taskId];
      
      if (task) {
        // Parse group ID to determine new values
        const [groupType, ...groupValueParts] = newGroupId.split('-');
        const groupValue = groupValueParts.join('-');
        
        const changes: Partial<Task> = {
          order: newIndex,
          updatedAt: new Date().toISOString(),
        };
        
        // Update group-specific field
        if (groupType === 'status') {
          changes.status = groupValue as Task['status'];
        } else if (groupType === 'priority') {
          changes.priority = groupValue as Task['priority'];
        } else if (groupType === 'phase') {
          changes.phase = groupValue;
        }
        
        tasksAdapter.updateOne(state, { id: taskId, changes });
      }
    },
    
    // Loading states
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
      state.loading = false;
    },

    // Filter actions
    setSelectedPriorities: (state, action: PayloadAction<string[]>) => {
      state.selectedPriorities = action.payload;
    },

    // Search action
    setSearch: (state, action: PayloadAction<string>) => {
      state.search = action.payload;
    },

    // Reset action
    resetTaskManagement: (state) => {
      return tasksAdapter.getInitialState(initialState);
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
        state.error = action.payload as string || 'Failed to fetch tasks';
      })
      .addCase(fetchTasksV3.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchTasksV3.fulfilled, (state, action) => {
        state.loading = false;
        state.error = null;
        // Tasks are already processed by backend, minimal setup needed
        tasksAdapter.setAll(state, action.payload.tasks);
        state.groups = action.payload.groups;
        state.grouping = action.payload.grouping;
      })
      .addCase(fetchTasksV3.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string || 'Failed to fetch tasks';
      })
      .addCase(refreshTaskProgress.pending, (state) => {
        // Don't set loading to true for refresh to avoid UI blocking
        state.error = null;
      })
      .addCase(refreshTaskProgress.fulfilled, (state) => {
        state.error = null;
        // Progress refresh completed successfully
      })
      .addCase(refreshTaskProgress.rejected, (state, action) => {
        state.error = action.payload as string || 'Failed to refresh task progress';
      });
  },
});

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
  optimisticTaskMove,
  setLoading,
  setError,
  setSelectedPriorities,
  setSearch,
  resetTaskManagement,
} = taskManagementSlice.actions;

export default taskManagementSlice.reducer;

// Selectors
export const taskManagementSelectors = tasksAdapter.getSelectors<RootState>(
  (state) => state.taskManagement
);

// Enhanced selectors for better performance
export const selectTasksByStatus = (state: RootState, status: string) =>
  taskManagementSelectors.selectAll(state).filter(task => task.status === status);

export const selectTasksByPriority = (state: RootState, priority: string) =>
  taskManagementSelectors.selectAll(state).filter(task => task.priority === priority);

export const selectTasksByPhase = (state: RootState, phase: string) =>
  taskManagementSelectors.selectAll(state).filter(task => task.phase === phase);

export const selectTasksLoading = (state: RootState) => state.taskManagement.loading;
export const selectTasksError = (state: RootState) => state.taskManagement.error;

// V3 API selectors - no processing needed, data is pre-processed by backend
export const selectTaskGroupsV3 = (state: RootState) => state.taskManagement.groups;
export const selectCurrentGroupingV3 = (state: RootState) => state.taskManagement.grouping; 