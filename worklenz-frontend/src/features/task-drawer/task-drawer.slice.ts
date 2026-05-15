import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';

import { tasksApiService } from '@/api/tasks/tasks.api.service';
import { ITaskFormViewModel } from '@/types/tasks/task.types';
import { ITaskListStatusChangeResponse } from '@/types/tasks/task-list-status.types';
import { IProjectTask } from '@/types/project/projectTasksViewModel.types';
import { ITaskListPriorityChangeResponse } from '@/types/tasks/task-list-priority.types';
import { ILabelsChangeResponse } from '@/types/tasks/taskList.types';
import { InlineMember } from '@/types/teamMembers/inlineMember.types';
import { ITaskLogViewModel } from '@/types/tasks/task-log-view.types';

interface ITaskDrawerState {
  selectedTaskId: string | null;
  showTaskDrawer: boolean;
  taskFormViewModel: ITaskFormViewModel | null;
  subscribers: InlineMember[];
  loadingTask: boolean;
  timeLogEditing: {
    isEditing: boolean;
    logBeingEdited: ITaskLogViewModel | null;
  };
  navigationContext: {
    taskIds: string[];
    currentIndex: number;
    sourceView: 'task-list' | 'kanban' | 'board' | 'home' | 'gantt' | 'workload';
    projectId: string | null;
  } | null;
}

const initialState: ITaskDrawerState = {
  selectedTaskId: null,
  showTaskDrawer: false,
  taskFormViewModel: null,
  subscribers: [],
  loadingTask: false,
  timeLogEditing: {
    isEditing: false,
    logBeingEdited: null,
  },
  navigationContext: null,
};

export const fetchTask = createAsyncThunk(
  'tasks/fetchTask',
  async ({ taskId, projectId }: { taskId: string; projectId: string }, { rejectWithValue }) => {
    const response = await tasksApiService.getFormViewModel(taskId, projectId);
    return response.body;
  }
);

const resetTimeLogEditing = {
  isEditing: false,
  logBeingEdited: null,
};

const taskDrawerSlice = createSlice({
  name: 'taskDrawer',
  initialState,
  reducers: {
    setSelectedTaskId: (state, action) => {
      state.selectedTaskId = action.payload;
      state.timeLogEditing = resetTimeLogEditing; // ← reset when switching tasks
    },
    setShowTaskDrawer: (state, action) => {
      state.showTaskDrawer = action.payload;
    },
    setTaskFormViewModel: (state, action) => {
      state.taskFormViewModel = action.payload;
    },
    setLoadingTask: (state, action) => {
      state.loadingTask = action.payload;
    },
    setTaskStatus: (state, action: PayloadAction<ITaskListStatusChangeResponse>) => {
      if (!action.payload) return;
      const { status_id, color_code, id: taskId, color_code_dark } = action.payload;
      if (state.taskFormViewModel?.task && state.taskFormViewModel.task.id === taskId) {
        state.taskFormViewModel.task.status_id = status_id;
        state.taskFormViewModel.task.status_color = color_code;
        state.taskFormViewModel.task.status_color_dark = color_code_dark;
      }
    },
    setStartDate: (state, action: PayloadAction<IProjectTask>) => {
      if (!action.payload) return;
      const { start_date, id: taskId } = action.payload;
      if (state.taskFormViewModel?.task && state.taskFormViewModel.task.id === taskId) {
        state.taskFormViewModel.task.start_date = start_date;
      }
    },
    setTaskEndDate: (state, action: PayloadAction<IProjectTask>) => {
      if (!action.payload) return;
      const { end_date, id: taskId } = action.payload;
      if (state.taskFormViewModel?.task && state.taskFormViewModel.task.id === taskId) {
        state.taskFormViewModel.task.end_date = end_date;
      }
    },
    setTaskDueTime: (state, action: PayloadAction<{ id: string; due_time: string | null }>) => {
      if (!action.payload) return;
      const { due_time, id: taskId } = action.payload;
      if (state.taskFormViewModel?.task && state.taskFormViewModel.task.id === taskId) {
        state.taskFormViewModel.task.due_time = due_time;
      }
    },
    setTaskAssignee: (state, action: PayloadAction<IProjectTask>) => {
      if (!action.payload) return;
      const { assignees, id: taskId, names } = action.payload;
      if (state.taskFormViewModel?.task && state.taskFormViewModel.task.id === taskId) {
        state.taskFormViewModel.task.assignees = (assignees || []).map(m => m.team_member_id);
        state.taskFormViewModel.task.names = names;
      }
    },
    setTaskPriority: (state, action: PayloadAction<ITaskListPriorityChangeResponse>) => {
      if (!action.payload) return;
      const { priority_id, id: taskId, color_code, color_code_dark, priority_value } = action.payload;
      if (state.taskFormViewModel?.task && state.taskFormViewModel.task.id === taskId) {
        state.taskFormViewModel.task.priority_id = priority_id;
        // Update priority_value if available (for icon rendering)
        if (priority_value !== undefined && state.taskFormViewModel.task.priority_value !== undefined) {
          (state.taskFormViewModel.task as any).priority_value = priority_value;
        }
      }
    },
    setTaskPhase: (state, action: PayloadAction<{ phase_id: string | null; id: string }>) => {
      const { phase_id, id: taskId } = action.payload;
      if (state.taskFormViewModel?.task && state.taskFormViewModel.task.id === taskId) {
        state.taskFormViewModel.task.phase_id = phase_id;
      }
    },
    setTaskLabels: (state, action: PayloadAction<ILabelsChangeResponse>) => {
      if (!action.payload) return;
      const { all_labels, id: taskId } = action.payload;
      if (state.taskFormViewModel?.task && state.taskFormViewModel.task.id === taskId) {
        state.taskFormViewModel.task.labels = all_labels || [];
      }
    },
    setTaskSubscribers: (state, action: PayloadAction<InlineMember[]>) => {
      state.subscribers = action.payload;
    },
    setTimeLogEditing: (
      state,
      action: PayloadAction<{
        isEditing: boolean;
        logBeingEdited: ITaskLogViewModel | null;
      }>
    ) => {
      state.timeLogEditing = action.payload;
    },
    setTaskRecurringSchedule: (
      state,
      action: PayloadAction<{
        schedule_id: string;
        task_id: string;
      }>
    ) => {
      if (!action.payload) return;
      const { schedule_id, task_id } = action.payload;
      if (state.taskFormViewModel?.task && state.taskFormViewModel.task.id === task_id) {
        state.taskFormViewModel.task.schedule_id = schedule_id;
      }
    },
    setTaskBillable: (
      state,
      action: PayloadAction<{
        id: string;
        billable: boolean;
      }>
    ) => {
      if (!action.payload) return;
      const { id, billable } = action.payload;
      if (state.taskFormViewModel?.task && state.taskFormViewModel.task.id === id) {
        state.taskFormViewModel.task.billable = billable;
      }
    },
    setTaskCustomColumnValue: (
      state,
      action: PayloadAction<{
        taskId: string;
        columnKey: string;
        value: string | number | boolean | string[] | null;
      }>
    ) => {
      const { taskId, columnKey, value } = action.payload;
      if (state.taskFormViewModel?.task && state.taskFormViewModel.task.id === taskId) {
        if (!state.taskFormViewModel.task.custom_column_values) {
          state.taskFormViewModel.task.custom_column_values = {};
        }

        state.taskFormViewModel.task.custom_column_values[columnKey] = value;
      }
    },
    updateSelectedTaskName: (
      state,
      action: PayloadAction<{
        id: string;
        name: string;
      }>
    ) => {
      const { id, name } = action.payload;
      // Only update if name is provided and not undefined
      if (state.taskFormViewModel?.task && state.taskFormViewModel.task.id === id && name !== undefined) {
        state.taskFormViewModel.task.name = name;
      }
    },
    setNavigationContext: (
      state,
      action: PayloadAction<{
        taskIds: string[];
        currentIndex: number;
        sourceView: 'task-list' | 'kanban' | 'board' | 'home' | 'gantt' | 'workload';
        projectId: string | null;
      } | null>
    ) => {
      state.navigationContext = action.payload;
    },
    navigateToNextTask: state => {
      if (!state.navigationContext) return;
      const { taskIds, currentIndex } = state.navigationContext;
      if (currentIndex < taskIds.length - 1) {
        const nextIndex = currentIndex + 1;
        state.selectedTaskId = taskIds[nextIndex];
        state.navigationContext.currentIndex = nextIndex;
        state.timeLogEditing = resetTimeLogEditing; // ← reset when switching tasks
      }
    },
    navigateToPreviousTask: state => {
      if (!state.navigationContext) return;
      const { taskIds, currentIndex } = state.navigationContext;
      if (currentIndex > 0) {
        const prevIndex = currentIndex - 1;
        state.selectedTaskId = taskIds[prevIndex];
        state.navigationContext.currentIndex = prevIndex;
        state.timeLogEditing = resetTimeLogEditing; // ← reset when switching tasks
      }
    },
    syncNavigationIndex: state => {
      if (!state.navigationContext || !state.selectedTaskId) return;
      const { taskIds } = state.navigationContext;
      const actualIndex = taskIds.indexOf(state.selectedTaskId);
      if (actualIndex !== -1 && actualIndex !== state.navigationContext.currentIndex) {
        state.navigationContext.currentIndex = actualIndex;
      }
    },
    resetTaskDrawer: state => {
      return initialState;
    },
  },
  extraReducers: builder => {
    (builder.addCase(fetchTask.pending, state => {
      state.loadingTask = true;
    }),
      builder.addCase(fetchTask.fulfilled, (state, action) => {
        state.loadingTask = false;
        state.taskFormViewModel = action.payload;
      }),
      builder.addCase(fetchTask.rejected, (state, action) => {
        state.loadingTask = false;
      }));
  },
});

export const {
  setSelectedTaskId,
  setShowTaskDrawer,
  setTaskFormViewModel,
  setLoadingTask,
  setTaskStatus,
  setStartDate,
  setTaskEndDate,
  setTaskDueTime,
  setTaskAssignee,
  setTaskPriority,
  setTaskPhase,
  setTaskLabels,
  setTaskSubscribers,
  setTimeLogEditing,
  setTaskRecurringSchedule,
  setTaskBillable,
  setTaskCustomColumnValue,
  updateSelectedTaskName,
  setNavigationContext,
  navigateToNextTask,
  navigateToPreviousTask,
  syncNavigationIndex,
  resetTaskDrawer,
} = taskDrawerSlice.actions;
export default taskDrawerSlice.reducer;
