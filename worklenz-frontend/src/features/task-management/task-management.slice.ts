import { createSlice, createEntityAdapter, PayloadAction } from '@reduxjs/toolkit';
import { Task, TaskManagementState } from '@/types/task-management.types';
import { RootState } from '@/app/store';

// Entity adapter for normalized state
const tasksAdapter = createEntityAdapter<Task>({
  selectId: (task) => task.id,
  sortComparer: (a, b) => a.order - b.order,
});

const initialState: TaskManagementState = {
  entities: {},
  ids: [],
  loading: false,
  error: null,
};

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