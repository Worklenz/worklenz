import { IServerResponse } from '@/types/common.types';
import apiClient from '../api-client';
import { API_BASE_URL } from '@/shared/constants';
import { IProjectTask } from '@/types/project/projectTasksViewModel.types';

const rootUrl = `${API_BASE_URL}/reporting`;

export interface IAllTasksReportRequest {
  index: number;
  size: number;
  sortField: string;
  sortOrder: 'asc' | 'desc';
  search?: string;
  teams?: string[];
  projects?: string[];
  statuses?: string[];
  priorities?: string[];
  assignees?: string[];
  labels?: string[];
  phases?: string[];
  clients?: string[];
  dateField?: 'due_date' | 'start_date' | 'created_at' | 'completed_at';
  dateFrom?: string | null;
  dateTo?: string | null;
  includeArchived?: boolean;
  includeSubtasks?: boolean;
  completionStatus?: 'all' | 'completed' | 'incomplete' | 'overdue';
  billable?: 'all' | 'billable' | 'non-billable';
  groupBy?: string;
}

export interface IAllTasksStats {
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  overdueTasks: number;
  unassignedTasks: number;
  dueThisWeek: number;
}

export interface IAllTasksGroup {
  id: string;
  name: string;
  color: string;
  tasks: IProjectTask[];
}

export interface IAllTasksReportResponse {
  data: IProjectTask[];
  total: number;
  page: number;
  pageSize: number;
  stats: IAllTasksStats;
  groups?: IAllTasksGroup[];
}

export interface IPhase {
  id: string;
  name: string;
}

export const allTasksReportsApiService = {
  getAllTasks: async (
    body: IAllTasksReportRequest
  ): Promise<IServerResponse<IAllTasksReportResponse>> => {
    const url = `${rootUrl}/all-tasks`;
    const response = await apiClient.post<IServerResponse<IAllTasksReportResponse>>(url, body);
    return response.data;
  },

  getAllPhases: async (teams: string[], projects: string[]): Promise<IServerResponse<IPhase[]>> => {
    const url = `${rootUrl}/all-tasks/phases`;
    const response = await apiClient.post<IServerResponse<IPhase[]>>(url, { teams, projects });
    return response.data;
  },

  exportAllTasksToCsv: async (body: IAllTasksReportRequest): Promise<Blob> => {
    const url = `${rootUrl}/all-tasks/export/csv`;
    const response = await apiClient.post(url, body, {
      responseType: 'blob',
    });
    return response.data;
  },

  exportAllTasksToExcel: async (body: IAllTasksReportRequest): Promise<Blob> => {
    const url = `${rootUrl}/all-tasks/export/excel`;
    const response = await apiClient.post(url, body, {
      responseType: 'blob',
    });
    return response.data;
  },
};
