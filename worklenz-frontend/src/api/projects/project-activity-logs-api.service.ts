import { AxiosError } from 'axios';
import { IServerResponse } from '@/types/common.types';
import apiClient from '../api-client';
import { API_BASE_URL } from '@/shared/constants';

export interface IProjectActivityLog {
  id: string;
  task_id: string;
  task_name: string;
  task_no: number;
  task_key: string;
  attribute_type: string;
  log_type: string;
  old_value?: string;
  new_value?: string;
  prev_string?: string;
  next_string?: string;
  previous?: string;
  current?: string;
  created_at: string;
  log_text?: string;
  done_by?: {
    id: string;
    name: string;
    avatar_url?: string;
    email: string;
    color_code?: string;
  };
  assigned_user?: {
    id: string;
    name: string;
    avatar_url?: string;
    email: string;
    color_code?: string;
  };
  previous_status?: {
    name: string;
    color_code: string;
  };
  next_status?: {
    name: string;
    color_code: string;
  };
  previous_priority?: {
    name: string;
    color_code: string;
  };
  next_priority?: {
    name: string;
    color_code: string;
  };
}

export interface IProjectActivityLogsResponse {
  logs: IProjectActivityLog[];
  pagination: {
    current: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface IActivityLogFilter {
  label: string;
  value: string;
}

class ProjectActivityLogsApiService {
  /**
   * Fetch paginated activity logs for a project.
   */
  async getActivityLogsByProjectId(
    projectId: string,
    page: number = 1,
    size: number = 20,
    filter: string = 'all'
  ): Promise<IServerResponse<IProjectActivityLogsResponse>> {
    try {
      const endpoint = `${API_BASE_URL}/project-activity-logs/project/${projectId}`;
      const params: Record<string, any> = { page, size };

      // Only send a filter param when it's not "all"
      if (filter && filter !== 'all') {
        params.filter = filter;
      }

      console.log('Making request to:', endpoint, 'with params:', params);

      const response = await apiClient.get<
        IServerResponse<IProjectActivityLogsResponse>
      >(endpoint, { params });

      return response.data;
    } catch (err) {
      // Handle Axios errors explicitly
      if ((err as AxiosError).isAxiosError) {
        const axiosErr = err as AxiosError;
        console.group('📡 ProjectActivityLogs API Error');
        console.log('URL:', axiosErr.config?.url);
        console.log('Status:', axiosErr.response?.status);
        console.log('Response data:', axiosErr.response?.data);
        console.groupEnd();

        // Surface a clean message from the server or default
        const serverMsg =
          (axiosErr.response?.data as any)?.error ||
          `Request failed with status code ${axiosErr.response?.status}`;
        throw new Error(serverMsg);
      }

      // Non-Axios errors
      console.error('Unexpected error in getActivityLogsByProjectId:', err);
      throw err;
    }
  }

  /**
   * Return the filter dropdown options.
   */
  getFilterOptions(): IActivityLogFilter[] {
    return [
      { label: 'All Activities',      value: 'all' },
      { label: 'Task Name Changes',   value: 'name' },
      { label: 'Status Changes',      value: 'status' },
      { label: 'Priority Changes',    value: 'priority' },
      { label: 'Assignee Changes',    value: 'assignee' },
      { label: 'Due Date Changes',    value: 'end_date' },
      { label: 'Start Date Changes',  value: 'start_date' },
      { label: 'Estimation Changes',  value: 'estimation' },
      { label: 'Description Changes', value: 'description' },
      { label: 'Phase Changes',       value: 'phase' },
    ];
  }
}

export const projectActivityLogsApiService = new ProjectActivityLogsApiService();