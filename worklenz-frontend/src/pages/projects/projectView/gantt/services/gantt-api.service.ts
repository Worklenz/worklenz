import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { API_BASE_URL } from '@/shared/constants';
import { IServerResponse } from '@/types/common.types';
import { getCsrfToken, refreshCsrfToken } from '@/api/api-client';
import config from '@/config/env';
import { GanttTask, GanttPhase } from '../types/gantt-types';

const rootUrl = '/gantt';

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
  phase_id: string | null;
  assignees: Array<{
    team_member_id: string;
    assignee_name: string;
    avatar_url?: string;
  }>;
  dependencies: Array<{
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
    phase_id: string | null;
  }>;
}

export interface ProjectPhaseResponse {
  id: string;
  name: string;
  color_code: string;
  start_date: string | null;
  end_date: string | null;
  sort_index: number;
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

export const ganttApi = createApi({
  reducerPath: 'ganttApi',
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
  tagTypes: ['GanttTasks', 'GanttPhases'],
  endpoints: builder => ({
    getRoadmapTasks: builder.query<
      IServerResponse<RoadmapTasksResponse[]>,
      { projectId: string }
    >({
      query: ({ projectId }) => {
        const params = new URLSearchParams({
          project_id: projectId,
        });
        return `${rootUrl}/roadmap-tasks?${params.toString()}`;
      },
      providesTags: (result, error, { projectId }) => [
        { type: 'GanttTasks', id: projectId },
        { type: 'GanttTasks', id: 'LIST' },
      ],
    }),

    getProjectPhases: builder.query<
      IServerResponse<ProjectPhaseResponse[]>,
      { projectId: string }
    >({
      query: ({ projectId }) => {
        const params = new URLSearchParams({
          project_id: projectId,
        });
        return `${rootUrl}/project-phases?${params.toString()}`;
      },
      providesTags: (result, error, { projectId }) => [
        { type: 'GanttPhases', id: projectId },
        { type: 'GanttPhases', id: 'LIST' },
      ],
    }),

    updateTaskDates: builder.mutation<
      IServerResponse<any>,
      UpdateTaskDatesRequest
    >({
      query: body => ({
        url: `${rootUrl}/update-task-dates`,
        method: 'POST',
        body,
      }),
      invalidatesTags: (result, error, { task_id }) => [
        { type: 'GanttTasks', id: 'LIST' },
      ],
    }),

    createPhase: builder.mutation<
      IServerResponse<ProjectPhaseResponse>,
      CreatePhaseRequest
    >({
      query: body => ({
        url: `${rootUrl}/create-phase`,
        method: 'POST',
        body,
      }),
      invalidatesTags: (result, error, { project_id }) => [
        { type: 'GanttPhases', id: project_id },
        { type: 'GanttPhases', id: 'LIST' },
        { type: 'GanttTasks', id: project_id },
        { type: 'GanttTasks', id: 'LIST' },
      ],
    }),

    createTask: builder.mutation<
      IServerResponse<RoadmapTasksResponse>,
      CreateTaskRequest
    >({
      query: body => ({
        url: `${rootUrl}/create-task`,
        method: 'POST',
        body,
      }),
      invalidatesTags: (result, error, { project_id }) => [
        { type: 'GanttTasks', id: project_id },
        { type: 'GanttTasks', id: 'LIST' },
      ],
    }),
  }),
});

export const {
  useGetRoadmapTasksQuery,
  useGetProjectPhasesQuery,
  useUpdateTaskDatesMutation,
  useCreatePhaseMutation,
  useCreateTaskMutation,
} = ganttApi;

/**
 * Transform API response to Gantt task format with phases as milestones
 */
export const transformToGanttTasks = (apiTasks: RoadmapTasksResponse[], apiPhases: ProjectPhaseResponse[]): GanttTask[] => {
  // Group tasks by phase
  const tasksByPhase = new Map<string, RoadmapTasksResponse[]>();
  const unassignedTasks: RoadmapTasksResponse[] = [];

  apiTasks.forEach(task => {
    if (task.phase_id) {
      if (!tasksByPhase.has(task.phase_id)) {
        tasksByPhase.set(task.phase_id, []);
      }
      tasksByPhase.get(task.phase_id)!.push(task);
    } else {
      unassignedTasks.push(task);
    }
  });

  const result: GanttTask[] = [];

  // Create phase milestones with their tasks (sorted by phase order)
  [...apiPhases]
    .sort((a, b) => a.sort_index - b.sort_index)
    .forEach(phase => {
      const phaseTasks = tasksByPhase.get(phase.id) || [];
      
      // Create phase milestone
      const phaseMilestone: GanttTask = {
        id: `phase-${phase.id}`,
        name: phase.name,
        start_date: phase.start_date ? new Date(phase.start_date) : null,
        end_date: phase.end_date ? new Date(phase.end_date) : null,
        progress: 0,
        level: 0,
        expanded: true,
        color: phase.color_code,
        type: 'milestone',
        is_milestone: true,
        phase_id: phase.id,
        children: phaseTasks.map(task => transformTask(task, 1))
      };

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
    color: '#9CA3AF', // Gray color for unmapped phase
    type: 'milestone',
    is_milestone: true,
    phase_id: null,
    children: unassignedTasks.map(task => transformTask(task, 1))
  };

  result.push(unmappedPhase);

  return result;
};

/**
 * Helper function to transform individual task
 */
const transformTask = (task: RoadmapTasksResponse, level: number = 0): GanttTask => ({
  id: task.id,
  name: task.name,
  start_date: task.start_date ? new Date(task.start_date) : null,
  end_date: task.end_date ? new Date(task.end_date) : null,
  progress: task.progress,
  dependencies: task.dependencies.map(dep => dep.related_task_id),
  dependencyType: task.dependencies[0]?.dependency_type as any || 'blocked_by',
  parent_id: task.parent_task_id,
  children: task.subtasks.map(subtask => ({
    id: subtask.id,
    name: subtask.name,
    start_date: subtask.start_date ? new Date(subtask.start_date) : null,
    end_date: subtask.end_date ? new Date(subtask.end_date) : null,
    progress: subtask.progress,
    parent_id: subtask.parent_task_id,
    level: level + 1,
    type: 'task',
    phase_id: subtask.phase_id
  })),
  level,
  expanded: true,
  color: task.status_color || task.priority_color,
  assignees: task.assignees.map(a => a.assignee_name),
  priority: task.priority_name,
  status: task.status_name,
  phase_id: task.phase_id,
  is_milestone: false,
  type: 'task'
});

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
    sort_index: phase.sort_index
  }));
};