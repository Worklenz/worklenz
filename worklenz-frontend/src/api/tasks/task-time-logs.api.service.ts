import { API_BASE_URL } from '@/shared/constants';
import apiClient from '../api-client';
import { IServerResponse } from '@/types/common.types';
import { ITaskLogViewModel } from '@/types/tasks/task-log-view.types';
import { getUserSession } from '@/utils/session-helper';

const rootUrl = `${API_BASE_URL}/task-time-log`;

export interface IMyTaskTimeLog {
  id: string;
  time_spent: number;
  description: string | null;
  created_at: string;
  logged_by_timer: boolean;
}

export interface IMyTaskWithLogs {
  task_id: string;
  task_name: string;
  due_date: string | null;
  done: boolean;
  project_id: string;
  project_name: string;
  project_color: string;
  total_time_spent: number;
  time_logs: IMyTaskTimeLog[];
}

export interface IMyTasksResponse {
  tasks: IMyTaskWithLogs[];
  fallback_date: string | null;
  total: number;
}

export interface IMySummary {
  today_total: number;
  today_billable: number;
  today_non_billable: number;
  week_total: number;
  week_billable: number;
  week_non_billable: number;
}

export interface IWeeklyBreakdownDay {
  day: string;
  billable: number;
  non_billable: number;
}

export interface IRecentProject {
  id: string;
  name: string;
  color_code: string;
}

export interface ITaskInProject {
  id: string;
  name: string;
  due_date: string | null;
  task_no: number;
}

export interface IRunningTimer {
  task_id: string;
  start_time: string;
  task_name: string;
  project_id: string;
  project_name: string;
  parent_task_id?: string;
  parent_task_name?: string;
  total_time_logged?: number; // Total previously logged time in seconds
}

export interface IMyTimeLogEntriesResponse {
  logs: IRecentTimeLog[];
  total: number;
}

export interface IRecentTimeLog {
  id: string;
  task_id: string;
  task_name: string;
  billable?: boolean;
  project_id: string;
  project_name: string;
  project_color?: string;
  parent_task_id?: string;
  parent_task_name?: string;
  created_at: string;
  due_date?: string | null;
  time_spent?: number;
  status_name?: string;
  status_color?: string;
  status_color_dark?: string;
  is_done?: boolean;
  priority_name?: string;
  priority_color?: string;
  priority_color_dark?: string;
}

export interface ITaskTimeLogsResponse {
  logs: ITaskLogViewModel[];
  subtasks_total_time_spent: number;
}

export const taskTimeLogsApiService = {
  getByTask: async (id: string): Promise<IServerResponse<ITaskTimeLogsResponse>> => {
    const session = getUserSession();
    const timezone = session?.timezone_name || 'UTC';
    const response = await apiClient.get(`${rootUrl}/task/${id}`, {
      params: { time_zone_name: timezone },
    });
    return response.data;
  },

  delete: async (id: string, taskId: string): Promise<IServerResponse<void>> => {
    const response = await apiClient.delete(`${rootUrl}/${id}?task=${taskId}`);
    return response.data;
  },

  create: async (body: {}): Promise<IServerResponse<ITaskLogViewModel>> => {
    const response = await apiClient.post(`${rootUrl}`, body);
    return response.data;
  },

  update: async (id: string, body: {}): Promise<IServerResponse<ITaskLogViewModel>> => {
    const response = await apiClient.put(`${rootUrl}/${id}`, body);
    return response.data;
  },

  getRunningTimers: async (): Promise<IServerResponse<IRunningTimer[]>> => {
    const response = await apiClient.get(`${rootUrl}/running-timers`);
    return response.data;
  },

  getRecentTimeLogs: async (limit?: number): Promise<IServerResponse<IRecentTimeLog[]>> => {
    const response = await apiClient.get(`${rootUrl}/recent-logs`, { params: { limit } });
    return response.data;
  },

  getMyTimeLogEntries: async (params: {
    date_filter?: string;
    project_id?: string;
    search?: string;
    date_from?: string;
    date_to?: string;
    sort_field?: string;
    sort_order?: 'asc' | 'desc';
    page?: number;
    page_size?: number;
  }): Promise<IServerResponse<IMyTimeLogEntriesResponse>> => {
    const response = await apiClient.get(`${rootUrl}/my-time-log-entries`, { params });
    return response.data;
  },

  exportToExcel(taskId: string) {
    window.location.href = `${import.meta.env.VITE_API_URL}${API_BASE_URL}/task-time-log/export/${taskId}`;
  },

  getMyTasksWithLogs: async (params: {
    date_filter?: string;
    project_id?: string;
    search?: string;
    date_from?: string;
    date_to?: string;
    page?: number;
    page_size?: number;
  }): Promise<IServerResponse<IMyTasksResponse>> => {
    const response = await apiClient.get(`${rootUrl}/my-tasks`, { params });
    return response.data;
  },

  getMySummary: async (): Promise<IServerResponse<IMySummary>> => {
    const response = await apiClient.get(`${rootUrl}/my-summary`);
    return response.data;
  },

  getMyWeeklyBreakdown: async (): Promise<IServerResponse<IWeeklyBreakdownDay[]>> => {
    const response = await apiClient.get(`${rootUrl}/my-weekly-breakdown`);
    return response.data;
  },

  getMyRecentProjects: async (): Promise<IServerResponse<IRecentProject[]>> => {
    const response = await apiClient.get(`${rootUrl}/my-recent-projects`);
    return response.data;
  },

  getMyTasksInProject: async (
    projectId: string,
    search?: string,
  ): Promise<IServerResponse<ITaskInProject[]>> => {
    const response = await apiClient.get(`${rootUrl}/my-tasks-in-project`, {
      params: { project_id: projectId, search },
    });
    return response.data;
  },
};
