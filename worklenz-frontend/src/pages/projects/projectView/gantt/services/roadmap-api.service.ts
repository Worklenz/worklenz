import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { API_BASE_URL } from '@/shared/constants';
import { IServerResponse } from '@/types/common.types';
import { getCsrfToken, refreshCsrfToken } from '@/api/api-client';
import config from '@/config/env';
import { GanttTask, GanttPhase, GanttGroupingMode } from '../types/gantt-types';

const rootUrl = '/roadmap';

export interface RoadmapTasksResponse {
  id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  done: boolean;
  progress: number;
  roadmap_sort_order: number;
  parent_task_id: string | null;
  status_name: string;
  status_color: string;
  priority_name: string;
  priority_value: number;
  priority_color: string;
  phases: Array<{
    phase_id: string;
    phase_name: string;
    phase_color: string;
  }>;
  assignees: Array<{
    team_member_id: string;
    assignee_name: string;
    avatar_url?: string;
  }>;
  dependencies: Array<{
    id: string;
    related_task_id: string;
    dependency_type: string;
    related_task_name: string;
  }>;
  subtasks: Array<{
    id: string;
    name: string;
    start_date: string | null;
    end_date: string | null;
    done: boolean;
    progress: number;
    roadmap_sort_order: number;
    parent_task_id: string;
    phase_id?: string | null; // Keep this for subtasks compatibility
  }>;
}

export interface ProjectPhaseResponse {
  id: string;
  name: string;
  color_code: string;
  start_date: string | null;
  end_date: string | null;
  sort_index: number;
  todo_progress: number;
  doing_progress: number;
  done_progress: number;
  total_tasks: number;
}

export interface UpdateTaskDatesRequest {
  task_id: string;
  start_date: string;
  end_date: string;
}

export interface CreatePhaseRequest {
  project_id: string;
  name: string;
  color_code?: string;
  start_date?: string;
  end_date?: string;
}

export interface CreateTaskRequest {
  project_id: string;
  name: string;
  phase_id?: string;
  start_date?: string;
  end_date?: string;
  priority_id?: string;
  status_id?: string;
}

export interface UpdatePhaseRequest {
  phase_id: string;
  project_id: string;
  name?: string;
  color_code?: string;
  start_date?: string;
  end_date?: string;
}

export interface ReorderPhasesRequest {
  project_id: string;
  phase_orders: Array<{
    phase_id: string;
    sort_index: number;
  }>;
}

export const roadmapApi = createApi({
  reducerPath: 'roadmapApi',
  baseQuery: fetchBaseQuery({
    baseUrl: `${config.apiUrl}${API_BASE_URL}`,
    prepareHeaders: async headers => {
      // Get CSRF token, refresh if needed
      let token = getCsrfToken();
      if (!token) {
        token = await refreshCsrfToken();
      }

      if (token) {
        headers.set('X-CSRF-Token', token);
      }
      headers.set('Content-Type', 'application/json');
      return headers;
    },
    credentials: 'include',
  }),
  // No tagTypes: cache invalidation is driven by explicit refetch() calls
  // (mutations, socket events) in ProjectViewGantt rather than RTK Query tags.
  endpoints: builder => ({
    getRoadmapTasks: builder.query<
      IServerResponse<RoadmapTasksResponse[]>,
      { projectId: string; groupBy?: GanttGroupingMode }
    >({
      query: ({ projectId, groupBy }) => {
        const params = new URLSearchParams({
          project_id: projectId,
          group_by: groupBy || 'phase',
        });
        return `${rootUrl}/roadmap-tasks?${params.toString()}`;
      },
      // Data is kept for a short window so switching tabs and back (or a
      // focus event) doesn't force a full refetch; mutations/socket events
      // already trigger explicit refetch() calls from ProjectViewGantt.
      keepUnusedDataFor: 60,
    }),

    getProjectPhases: builder.query<IServerResponse<ProjectPhaseResponse[]>, { projectId: string }>(
      {
        query: ({ projectId }) => {
          const params = new URLSearchParams({
            project_id: projectId,
          });
          return `${rootUrl}/project-phases?${params.toString()}`;
        },
        // See getRoadmapTasks above — short cache window, explicit refetch()
        // on mutations/socket events instead of forced refetch-on-focus/mount.
        keepUnusedDataFor: 60,
      }
    ),

    updateTaskDates: builder.mutation<IServerResponse<any>, UpdateTaskDatesRequest>({
      query: body => ({
        url: `${rootUrl}/update-task-dates`,
        method: 'POST',
        body,
      }),
      // No cache invalidation needed since we're not caching
    }),

    createPhase: builder.mutation<IServerResponse<ProjectPhaseResponse>, CreatePhaseRequest>({
      query: body => ({
        url: `${rootUrl}/create-phase`,
        method: 'POST',
        body,
      }),
      // No cache invalidation needed since we're not caching
    }),

    createTask: builder.mutation<IServerResponse<RoadmapTasksResponse>, CreateTaskRequest>({
      query: body => ({
        url: `${rootUrl}/create-task`,
        method: 'POST',
        body,
      }),
      // No cache invalidation needed since we're not caching
    }),

    updatePhase: builder.mutation<IServerResponse<ProjectPhaseResponse>, UpdatePhaseRequest>({
      query: body => ({
        url: `${rootUrl}/update-phase`,
        method: 'PUT',
        body,
      }),
      // No cache invalidation needed since we're not caching
    }),

    reorderPhases: builder.mutation<IServerResponse<any>, ReorderPhasesRequest>({
      query: body => ({
        url: `${rootUrl}/reorder-phases`,
        method: 'POST',
        body,
      }),
      // No cache invalidation needed since we're not caching
    }),
  }),
});

export const {
  useGetRoadmapTasksQuery,
  useGetProjectPhasesQuery,
  useUpdateTaskDatesMutation,
  useCreatePhaseMutation,
  useCreateTaskMutation,
  useUpdatePhaseMutation,
  useReorderPhasesMutation,
} = roadmapApi;

/**
 * Transform API response to Gantt task format with phases as milestones
 */
export const transformToGanttTasks = (
  apiTasks: RoadmapTasksResponse[],
  apiPhases: ProjectPhaseResponse[],
  projectColor?: string
): GanttTask[] => {
  // Group tasks by phase
  const tasksByPhase = new Map<string, RoadmapTasksResponse[]>();
  const unassignedTasks: RoadmapTasksResponse[] = [];

  apiTasks.forEach(task => {
    // Tasks now have phases array instead of direct phase_id
    const taskPhaseId = task.phases.length > 0 ? task.phases[0].phase_id : null;

    if (taskPhaseId) {
      if (!tasksByPhase.has(taskPhaseId)) {
        tasksByPhase.set(taskPhaseId, []);
      }
      tasksByPhase.get(taskPhaseId)!.push(task);
    } else {
      unassignedTasks.push(task);
    }
  });

  const result: GanttTask[] = [];

  // Create phase milestones with their tasks (already sorted from backend)
  apiPhases.forEach(phase => {
    const phaseTasks = tasksByPhase.get(phase.id) || [];

    // Use phase dates if provided, they are independent of child task dates
    let phaseStartDate = phase.start_date ? new Date(phase.start_date) : null;
    let phaseEndDate = phase.end_date ? new Date(phase.end_date) : null;

    // Only calculate from child tasks if phase has no dates AND we want to show something
    // This is optional - phases without dates can remain without dates
    if (!phaseStartDate && !phaseEndDate && phaseTasks.length > 0) {
      // Optional: Calculate from child tasks as a visual helper
      const taskDates = phaseTasks
        .filter(task => task.start_date && task.end_date)
        .map(task => ({
          start: new Date(task.start_date!),
          end: new Date(task.end_date!),
        }));

      console.log(`Phase ${phase.name} has no dates, optionally calculating from child tasks:`, {
        taskCount: phaseTasks.length,
        tasksWithDates: taskDates.length,
        taskDates,
      });

      // Only set calculated dates if we have tasks with dates
      // This is optional behavior - can be disabled if phases should only show their own dates
      if (taskDates.length > 0) {
        phaseStartDate = new Date(Math.min(...taskDates.map(d => d.start.getTime())));
        phaseEndDate = new Date(Math.max(...taskDates.map(d => d.end.getTime())));
        console.log(`Optional calculated dates - start: ${phaseStartDate}, end: ${phaseEndDate}`);
      }
    } else if (phase.start_date || phase.end_date) {
      console.log(`Phase ${phase.name} using its own dates:`, {
        start_date: phaseStartDate,
        end_date: phaseEndDate,
      });
    }

    // Create phase milestone
    const phaseMilestone: GanttTask = {
      id: `phase-${phase.id}`,
      name: phase.name,
      start_date: phaseStartDate,
      end_date: phaseEndDate,
      progress: 0,
      level: 0,
      expanded: true,
      // Header title color matches this phase's own assigned color (the same swatch
      // shown in the Phase Options list), same treatment as Status/Priority headers.
      color: phase.color_code || undefined,
      type: 'milestone',
      is_milestone: true,
      phase_id: phase.id,
      // Pass through phase progress data from backend
      todo_progress: phase.todo_progress,
      doing_progress: phase.doing_progress,
      done_progress: phase.done_progress,
      total_tasks: phase.total_tasks,
      // No-date tasks are kept here (not filtered out) so they still show up under
      // their phase — the timeline bar handles the missing-dates case on its own.
      children: phaseTasks.map(task => transformTask(task, 1, projectColor)),
    };

    console.log(`Final phase milestone:`, {
      name: phaseMilestone.name,
      start_date: phaseMilestone.start_date,
      end_date: phaseMilestone.end_date,
      childrenCount: phaseMilestone.children?.length || 0,
    });

    result.push(phaseMilestone);
  });

  // Always create unmapped phase at the bottom (even if empty)
  const unmappedPhase: GanttTask = {
    id: 'phase-unmapped',
    name: 'Unmapped',
    start_date: null,
    end_date: null,
    progress: 0,
    level: 0,
    expanded: true,
    color: undefined,
    type: 'milestone',
    is_milestone: true,
    phase_id: null,
    // No-date tasks are kept here (not filtered out) so they still show up under
    // the unmapped phase — the timeline bar handles the missing-dates case on its own.
    children: unassignedTasks.map(task => transformTask(task, 1, projectColor)),
  };

  result.push(unmappedPhase);

  return result;
};

/**
/**
 * Transform API response to Gantt tasks grouped by status category (Todo, Doing, Done)
 */
export const transformToGanttTasksByStatus = (
  apiTasks: RoadmapTasksResponse[],
  statusCategories: Array<{ id: string; name: string; color_code?: string }>,
  statuses?: Array<any>,
  projectColor?: string,
  themeMode: 'light' | 'dark' = 'light'
): GanttTask[] => {
  const projectStatuses = Array.isArray(statuses) ? statuses.filter(Boolean) : [];

  const statusEntries = projectStatuses.length > 0
    ? projectStatuses.map(status => ({
        id: status.id || status.name,
        name: status.name || 'Untitled status',
        // Dark variant matches the same color_code/color_code_dark pairing the Task List
        // view's status labels already use, so the header text stays legible in dark mode
        // instead of falling back to the (often too-dark-for-dark-bg) light value.
        color_code:
          (themeMode === 'dark' ? status.color_code_dark : undefined) ||
          status.color_code ||
          status.color ||
          undefined,
        category_id: status.category_id,
      }))
    : statusCategories.map(category => ({
        id: category.id,
        name: category.name,
        color_code: category.color_code,
        category_id: category.id,
      }));

  const tasksByStatus = new Map<string, RoadmapTasksResponse[]>();
  statusEntries.forEach(status => {
    tasksByStatus.set(String(status.id), []);
  });

  apiTasks.forEach(task => {
    const statusName = task.status_name?.trim().toLowerCase() || '';
    const matchedStatus = projectStatuses.find(status => {
      const candidateName = status.name?.trim().toLowerCase() || '';
      return candidateName && candidateName === statusName;
    });

    const targetKey = matchedStatus?.id ? String(matchedStatus.id) : null;
    if (targetKey && tasksByStatus.has(targetKey)) {
      tasksByStatus.get(targetKey)!.push(task);
      return;
    }

    if (!projectStatuses.length) {
      const fallbackStatus = statusCategories.find(category => category.name?.trim().toLowerCase() === statusName);
      if (fallbackStatus) {
        const fallbackKey = String(fallbackStatus.id);
        if (!tasksByStatus.has(fallbackKey)) {
          tasksByStatus.set(fallbackKey, []);
        }
        tasksByStatus.get(fallbackKey)!.push(task);
      }
    }
  });

  const result: GanttTask[] = [];

  statusEntries.forEach(status => {
    const statusTasks = tasksByStatus.get(String(status.id)) || [];

    let startDate: Date | null = null;
    let endDate: Date | null = null;

    if (statusTasks.length > 0) {
      const taskDates = statusTasks
        .filter(task => task.start_date && task.end_date)
        .map(task => ({
          start: new Date(task.start_date!),
          end: new Date(task.end_date!),
        }));

      if (taskDates.length > 0) {
        startDate = new Date(Math.min(...taskDates.map(d => d.start.getTime())));
        endDate = new Date(Math.max(...taskDates.map(d => d.end.getTime())));
      }
    }

    const statusGroup: GanttTask = {
      id: `status-${status.id}`,
      name: status.name,
      start_date: startDate,
      end_date: endDate,
      progress: 0,
      level: 0,
      expanded: true,
      color: status.color_code || undefined,
      type: 'milestone',
      is_milestone: true,
      status: String(status.id),
      // No-date tasks are kept here (not filtered out) so they still show up under
      // their status — the timeline bar handles the missing-dates case on its own.
      children: statusTasks.map(task => transformTask(task, 1, projectColor)),
    };

    result.push(statusGroup);
  });

  return result;
};

/**
 * Transform API response to Gantt tasks grouped by priority
 */
export const transformToGanttTasksByPriority = (
  apiTasks: RoadmapTasksResponse[],
  projectColor?: string,
  priorities?: Array<any>,
  themeMode: 'light' | 'dark' = 'light'
): GanttTask[] => {
  // Fixed priority order: Critical, High, Medium, Low
  const priorityOrder = [
    { value: 3, name: 'Critical' },
    { value: 2, name: 'High' },
    { value: 1, name: 'Medium' },
    { value: 0, name: 'Low' },
  ];

  // Group tasks by priority value
  const tasksByPriority = new Map<number, RoadmapTasksResponse[]>();

  apiTasks.forEach(task => {
    const priorityValue = task.priority_value ?? 0;
    if (!tasksByPriority.has(priorityValue)) {
      tasksByPriority.set(priorityValue, []);
    }
    tasksByPriority.get(priorityValue)!.push(task);
  });

  const result: GanttTask[] = [];

  // Create priority groups in fixed order
  priorityOrder.forEach(priority => {
    const priorityTasks = tasksByPriority.get(priority.value) || [];

    // Calculate date range from tasks
    let startDate: Date | null = null;
    let endDate: Date | null = null;

    if (priorityTasks.length > 0) {
      const taskDates = priorityTasks
        .filter(task => task.start_date && task.end_date)
        .map(task => ({
          start: new Date(task.start_date!),
          end: new Date(task.end_date!),
        }));

      if (taskDates.length > 0) {
        startDate = new Date(Math.min(...taskDates.map(d => d.start.getTime())));
        endDate = new Date(Math.max(...taskDates.map(d => d.end.getTime())));
      }
    }

    // Section header title color matches the same priority label color used in the Task
    // List view (Critical/High/Medium/Low), picking the dark variant in dark mode so it
    // stays legible instead of defaulting to plain text.
    const matchedPriority = (priorities || []).find(
      (p: any) => p?.name?.toLowerCase() === priority.name.toLowerCase()
    );
    const priorityColor =
      (themeMode === 'dark' ? matchedPriority?.color_code_dark : undefined) ||
      matchedPriority?.color_code ||
      undefined;

    // Create priority group
    const priorityGroup: GanttTask = {
      id: `priority-${priority.value}`,
      name: priority.name,
      start_date: startDate,
      end_date: endDate,
      progress: 0,
      level: 0,
      expanded: true,
      color: priorityColor,
      type: 'milestone',
      is_milestone: true,
      priority: priority.name,
      // No-date tasks are kept here (not filtered out) so they still show up under
      // their priority — the timeline bar handles the missing-dates case on its own.
      children: priorityTasks.map(task => transformTask(task, 1, projectColor)),
    };

    result.push(priorityGroup);
  });

  return result;
};

/**
 * Helper function to transform individual task
 */
const transformTask = (task: RoadmapTasksResponse, level: number = 0, projectColor?: string): GanttTask => {
  const taskPhaseId = task.phases.length > 0 ? task.phases[0].phase_id : null;

  return {
    id: task.id,
    name: task.name,
    start_date: task.start_date ? new Date(task.start_date) : null,
    end_date: task.end_date ? new Date(task.end_date) : null,
    // Normalize completion: if backend marks task as done, force 100% progress
    progress: task.done ? 100 : task.progress,
    dependencies: task.dependencies.map(dep => dep.related_task_id),
    dependencyType: (task.dependencies[0]?.dependency_type as any) || 'blocked_by',
    parent_id: task.parent_task_id,
    children: task.subtasks.map(subtask => ({
      id: subtask.id,
      name: subtask.name,
      start_date: subtask.start_date ? new Date(subtask.start_date) : null,
      end_date: subtask.end_date ? new Date(subtask.end_date) : null,
      // Normalize completion for subtasks as well
      progress: subtask.done ? 100 : subtask.progress,
      parent_id: subtask.parent_task_id,
      level: level + 1,
      type: 'task',
      phase_id: subtask.phase_id, // Subtasks might still use direct phase_id
    })),
    level,
    expanded: true,
    color: projectColor || task.status_color || task.priority_color,
    assignees: task.assignees.map(a => a.assignee_name),
    priority: task.priority_name,
    status: task.status_name,
    phase_id: taskPhaseId,
    is_milestone: false,
    type: 'task',
  };
};

/**
 * Transform API response to Gantt phases format
 */
export const transformToGanttPhases = (apiPhases: ProjectPhaseResponse[]): GanttPhase[] => {
  return apiPhases.map(phase => ({
    id: phase.id,
    name: phase.name,
    color_code: phase.color_code,
    start_date: phase.start_date ? new Date(phase.start_date) : null,
    end_date: phase.end_date ? new Date(phase.end_date) : null,
    sort_index: phase.sort_index,
    todo_progress: phase.todo_progress,
    doing_progress: phase.doing_progress,
    done_progress: phase.done_progress,
    total_tasks: phase.total_tasks,
  }));
};
