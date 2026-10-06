import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';

import { tasksApiService } from '@/api/tasks/tasks.api.service';
import { ITaskFormViewModel } from '@/types/tasks/task.types';
import { ITaskListStatusChangeResponse } from '@/types/tasks/task-list-status.types';
import { IProjectTask } from '@/types/project/projectTasksViewModel.types';
import { ITaskListPriorityChangeResponse } from '@/types/tasks/task-list-priority.types';
import { ILabelsChangeResponse } from '@/types/tasks/taskList.types';
import { InlineMember } from '@/types/teamMembers/inlineMember.types';
import { ITaskLogViewModel } from '@/types/tasks/task-log-view.types';
import { ITaskStatus } from '@/types/tasks/taskStatus.types';
import { decodeHtmlEntities } from '@/utils/html-entities';

import { Task } from '@/types/task-management.types';

const normalizeAssigneeNames = (
  assignees?: IProjectTask['assignees'] | string[] | null,
  names?: InlineMember[] | string[] | null
): InlineMember[] => {
  if (names?.length) {
    if (typeof names[0] === 'string') {
      return (names as string[]).map(name => ({
        team_member_id: '',
        name,
        avatar_url: '',
        email: '',
      }));
    }

    return names as InlineMember[];
  }

  if (assignees?.length) {
    return assignees.map(assignee => {
      if (typeof assignee === 'string') {
        return {
          team_member_id: assignee,
          name: '',
          avatar_url: '',
        };
      }
      const withExtra = assignee as {
        team_member_id?: string;
        name?: string;
        avatar_url?: string | null;
        email?: string;
      };
      return {
        team_member_id: withExtra.team_member_id || '',
        name: withExtra.name || '',
        avatar_url: withExtra.avatar_url || '',
        email: withExtra.email || '',
      };
    });
  }

  return [];
};

export type TaskDrawerTabKey = 'info' | 'timeLog' | 'activityLog';

interface ITaskDrawerState {
  selectedTaskId: string | null;
  showTaskDrawer: boolean;
  taskFormViewModel: ITaskFormViewModel | null;
  subscribers: InlineMember[];
  loadingTask: boolean;
  /** Set when /tasks/info returns assignee-scope 403 (TVR-11) */
  taskAccessDenied: boolean;
  /** Deep-link signal for notification/mention single-task exception (TVR-12) */
  taskAccessFrom: 'notification' | 'mention' | null;
  targetCommentId: string | null;
  /** When set, TaskDrawer opens on this tab then clears the value. */
  targetDrawerTab: TaskDrawerTabKey | null;
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
  taskAccessDenied: false,
  taskAccessFrom: null,
  targetCommentId: null,
  targetDrawerTab: null,
  timeLogEditing: {

    isEditing: false,
    logBeingEdited: null,
  },
  navigationContext: null,
};

export const TASK_ASSIGNEE_RESTRICTED_CODE = 'TASK_ASSIGNEE_RESTRICTED';

const isTaskAssigneeRestrictedError = (error: unknown): boolean => {
  const response = (error as { response?: { status?: number; data?: { body?: { code?: string }; message?: string } } })
    ?.response;
  if (response?.status !== 403) return false;
  if (response.data?.body?.code === TASK_ASSIGNEE_RESTRICTED_CODE) return true;
  const message = (response.data?.message || '').toLowerCase();
  return message.includes('permission to access this task');
};

export const fetchTask = createAsyncThunk(
  'tasks/fetchTask',
  async (
    {
      taskId,
      projectId,
      from,
    }: { taskId: string; projectId: string; from?: 'notification' | 'mention' | null },
    { rejectWithValue, getState }
  ) => {
    try {
      const state = getState() as { taskDrawerReducer: ITaskDrawerState };
      const accessFrom = from ?? state.taskDrawerReducer.taskAccessFrom;
      const response = await tasksApiService.getFormViewModel(taskId, projectId, {
        from: accessFrom,
      });
      if (!response.body) return rejectWithValue('No data');

      // The API may return a stale name if the user renamed the task locally
      // (inline edit or drawer) before the socket round-trip persisted to the DB.
      // Prefer the name already held in the task-management slice.
      const fullState = getState() as {
        taskManagement: { entities: Record<string, Task | undefined> };
      };
      const localTask = fullState.taskManagement.entities[taskId];
      const localName = decodeHtmlEntities(localTask?.title || localTask?.name);
      if (localName && response.body.task && response.body.task.name !== localName) {
        response.body.task.name = localName;
      } else if (response.body.task?.name) {
        response.body.task.name = decodeHtmlEntities(response.body.task.name);
      }

      if (response.body.task) {
        const currentTask = fullState.taskManagement.entities[taskId];
        const normalizedNames = normalizeAssigneeNames(
          response.body.task.assignees,
          response.body.task.assignee_names || response.body.task.names
        );

        if (normalizedNames.length) {
          response.body.task.assignee_names = normalizedNames;
          response.body.task.names = normalizedNames.map(m => m.name);
        }

        if (currentTask) {
          if (!response.body.task.assignees?.length && currentTask.assignees?.length) {
            response.body.task.assignees = currentTask.assignees;
          }

          if (!response.body.task.assignee_names?.length && currentTask.assignee_names?.length) {
            response.body.task.assignee_names = currentTask.assignee_names;
          }

          if (!response.body.task.names?.length && currentTask.assignee_names?.length) {
            response.body.task.names = currentTask.assignee_names.map(m => m.name);
          }
        }
      }

      return response.body;
    } catch (error) {
      if (isTaskAssigneeRestrictedError(error)) {
        return rejectWithValue({ code: TASK_ASSIGNEE_RESTRICTED_CODE });
      }
      throw error;
    }
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
      state.taskAccessDenied = false;
      // Reset deep-link exception; callers that need it re-set via setTaskAccessFrom
      state.taskAccessFrom = null;

      if (action.payload) {
        state.taskFormViewModel = state.taskFormViewModel?.task?.id === action.payload
          ? state.taskFormViewModel
          : {
              task: {
                id: action.payload,
                assignees: [],
                names: [],
                assignee_names: [],
              } as any,
            };
      }
    },
    setShowTaskDrawer: (state, action) => {
      state.showTaskDrawer = action.payload;
      if (!action.payload) {
        state.taskAccessDenied = false;
        state.taskAccessFrom = null;
      }
    },
    setTaskFormViewModel: (state, action) => {
      state.taskFormViewModel = action.payload;
    },
    setLoadingTask: (state, action) => {
      state.loadingTask = action.payload;
    },
    setTargetCommentId: (state, action: PayloadAction<string | null>) => {
      state.targetCommentId = action.payload;
    },
    setTargetDrawerTab: (state, action: PayloadAction<TaskDrawerTabKey | null>) => {
      state.targetDrawerTab = action.payload;
    },
    setTaskAccessFrom: (
      state,
      action: PayloadAction<'notification' | 'mention' | null>
    ) => {
      state.taskAccessFrom = action.payload;
    },
    clearTaskAccessDenied: state => {
      state.taskAccessDenied = false;
    },

    setTaskStatus: (state, action: PayloadAction<ITaskListStatusChangeResponse>) => {
      if (!action.payload) return;
      const { status_id, color_code, id: taskId, color_code_dark } = action.payload;
      if (state.taskFormViewModel?.task && state.taskFormViewModel.task.id === taskId) {
        state.taskFormViewModel.task.status_id = status_id ?? state.taskFormViewModel.task.status_id;
        state.taskFormViewModel.task.status_color = color_code ?? state.taskFormViewModel.task.status_color;
        state.taskFormViewModel.task.status_color_dark = color_code_dark ?? state.taskFormViewModel.task.status_color_dark;
      }
    },
    setStartDate: (state, action: PayloadAction<IProjectTask>) => {
      if (!action.payload) return;
      const { start_date, id: taskId } = action.payload;
      if (state.taskFormViewModel?.task && state.taskFormViewModel.task.id === taskId) {
        if (start_date !== undefined) state.taskFormViewModel.task.start_date = start_date;
      }
    },
    setTaskEndDate: (state, action: PayloadAction<IProjectTask>) => {
      if (!action.payload) return;
      const { end_date, id: taskId } = action.payload;
      if (state.taskFormViewModel?.task && state.taskFormViewModel.task.id === taskId) {
        if (end_date !== undefined) state.taskFormViewModel.task.end_date = end_date;
      }
    },
    setTaskDueTime: (state, action: PayloadAction<{ id: string; due_time: string | null }>) => {
      if (!action.payload) return;
      const { due_time, id: taskId } = action.payload;
      if (state.taskFormViewModel?.task && state.taskFormViewModel.task.id === taskId) {
        (state.taskFormViewModel.task as any).due_time = due_time;
      }
    },
    setTaskAssignee: (state, action: PayloadAction<IProjectTask>) => {
      if (!action.payload) return;
      const { assignees, id: taskId, names, assignee_names } = action.payload as IProjectTask & {
        assignee_names?: InlineMember[];
      };
      if (state.taskFormViewModel?.task && state.taskFormViewModel.task.id === taskId) {
        state.taskFormViewModel.task.assignees = (assignees || []).map(m => m.team_member_id);
        const assigneeNames = normalizeAssigneeNames(assignees, assignee_names || names);
        (state.taskFormViewModel.task as any).names = assigneeNames;
        (state.taskFormViewModel.task as any).assignee_names = assigneeNames;
      }
    },
    setTaskPriority: (state, action: PayloadAction<ITaskListPriorityChangeResponse>) => {
      if (!action.payload) return;
      const {
        priority_id,
        id: taskId,
        color_code,
        color_code_dark,
        priority_value,
      } = action.payload;
      if (state.taskFormViewModel?.task && state.taskFormViewModel.task.id === taskId) {
        (state.taskFormViewModel.task as any).priority_id = priority_id;
        // Update priority_value if available (for icon rendering)
        if (priority_value !== undefined) {
          (state.taskFormViewModel.task as any).priority_value = priority_value;
        }
      }
    },
    setTaskPhase: (state, action: PayloadAction<{ phase_id: string | null; id: string }>) => {
      const { phase_id, id: taskId } = action.payload;
      if (state.taskFormViewModel?.task && state.taskFormViewModel.task.id === taskId) {
        (state.taskFormViewModel.task as any).phase_id = phase_id;
      }
    },
    setTaskLabels: (state, action: PayloadAction<ILabelsChangeResponse>) => {
      if (!action.payload) return;
      const { all_labels, id: taskId } = action.payload;
      if (state.taskFormViewModel?.task && state.taskFormViewModel.task.id === taskId) {
        (state.taskFormViewModel.task as any).labels = all_labels || [];
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
    setTaskDescription: (
      state,
      action: PayloadAction<{ id: string; description: string | null }>
    ) => {
      if (!action.payload) return;
      const { id: taskId, description } = action.payload;
      if (state.taskFormViewModel?.task && state.taskFormViewModel.task.id === taskId) {
        state.taskFormViewModel.task.description = description ?? '';
      }
    },
    setTaskEstimation: (
      state,
      action: PayloadAction<{ id: string; total_hours: number; total_minutes: number }>
    ) => {
      if (!action.payload) return;
      const { id: taskId, total_hours, total_minutes } = action.payload;
      if (state.taskFormViewModel?.task && state.taskFormViewModel.task.id === taskId) {
        // The backend returns total_minutes as the combined value (hours * 60 + minutes).
        // Decompose it so the form fields show the correct hours and remainder minutes.
        const combinedMinutes = total_minutes || 0;
        state.taskFormViewModel.task.total_hours = total_hours || ~~(combinedMinutes / 60);
        state.taskFormViewModel.task.total_minutes = combinedMinutes % 60;
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
      if (
        state.taskFormViewModel?.task &&
        state.taskFormViewModel.task.id === id &&
        name !== undefined
      ) {
        state.taskFormViewModel.task.name = decodeHtmlEntities(name);
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
    setTaskDrawerStatuses: (state, action: PayloadAction<ITaskStatus[]>) => {
      if (state.taskFormViewModel) {
        state.taskFormViewModel.statuses = action.payload;
      }
    },
    resetTaskDrawer: state => {
      return initialState;
    },
  },
  extraReducers: builder => {
    (builder.addCase(fetchTask.pending, state => {
      state.loadingTask = true;
      state.taskAccessDenied = false;
    }),
      builder.addCase(fetchTask.fulfilled, (state, action) => {
        state.loadingTask = false;
        state.taskAccessDenied = false;
        if (!action.payload) return;

        const existingTask = state.taskFormViewModel?.task;
        const existingDueTime = existingTask?.due_time;
        const existingAssignees = existingTask?.assignees;
        const existingNames = existingTask?.assignee_names || (existingTask?.names as unknown as InlineMember[]);

        state.taskFormViewModel = action.payload;

        if (
          existingTask &&
          state.taskFormViewModel?.task &&
          state.taskFormViewModel.task.id === existingTask.id
        ) {
          if (
            existingDueTime &&
            !state.taskFormViewModel.task.due_time
          ) {
            state.taskFormViewModel.task.due_time = existingDueTime;
          }

          if (
            !state.taskFormViewModel.task?.assignees?.length &&
            existingAssignees?.length
          ) {
            state.taskFormViewModel.task.assignees = existingAssignees;
          }

          if (
            !state.taskFormViewModel.task?.assignee_names?.length &&
            existingNames?.length
          ) {
            state.taskFormViewModel.task.assignee_names = normalizeAssigneeNames(undefined, existingNames);
          }

          if (
            !state.taskFormViewModel.task?.names?.length &&
            existingNames?.length
          ) {
            (state.taskFormViewModel.task as any).names = normalizeAssigneeNames(undefined, existingNames);
          }
        }
      }),
      builder.addCase(fetchTask.rejected, (state, action) => {
        state.loadingTask = false;
        const payload = action.payload as { code?: string } | string | undefined;
        if (
          typeof payload === 'object' &&
          payload?.code === TASK_ASSIGNEE_RESTRICTED_CODE
        ) {
          state.taskAccessDenied = true;
          state.taskFormViewModel = null;
        }
      }));
  },
});

export const {
  setSelectedTaskId,
  setShowTaskDrawer,
  setTaskFormViewModel,
  setLoadingTask,
  setTargetCommentId,
  setTargetDrawerTab,
  setTaskAccessFrom,
  clearTaskAccessDenied,
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
  setTaskDescription,
  setTaskEstimation,
  updateSelectedTaskName,
  setNavigationContext,
  navigateToNextTask,
  navigateToPreviousTask,
  syncNavigationIndex,
  setTaskDrawerStatuses,
  resetTaskDrawer,
} = taskDrawerSlice.actions;
export default taskDrawerSlice.reducer;
