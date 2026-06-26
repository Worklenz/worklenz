import { IServerResponse } from '@/types/common.types';
import apiClient from '../api-client';
import { API_BASE_URL } from '@/shared/constants';

const rootUrl = `${API_BASE_URL}/team-lead-reports`;

export interface TeamMember {
  managed_member_id: string;
  managed_member_user_id: string;
  managed_member_name: string;
  managed_member_email: string;
  managed_member_role_name: string;
  hierarchy_level: number;
}

export interface TimeLogsSummary {
  managed_member_id: string;
  managed_member_name: string;
  managed_member_user_id: string;
  total_logs: number;
  total_time_minutes: number;
  projects_worked_on: number;
  days_logged: number;
  last_log_date: string;
}

export interface DetailedTimeLog {
  time_log_id: string;
  time_spent: number;
  description: string;
  logged_by_timer: boolean;
  logged_at: string;
  task_id: string;
  task_name: string;
  project_id: string;
  project_name: string;
  managed_member_name: string;
}

export interface TimeLogsResponse {
  logs: DetailedTimeLog[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface PerformanceStats {
  managed_member_id: string;
  managed_member_name: string;
  managed_member_email: string;
  managed_member_role_name: string;
  hierarchy_level: number;
  assigned_tasks: number;
  completed_tasks: number;
  completion_percentage: number;
  total_time_minutes: number;
  overdue_tasks: number;
  active_projects: number;
  last_time_log: string;
}

export const teamLeadReportsApiService = {
  getMyTeamMembers: async (): Promise<IServerResponse<TeamMember[]>> => {
    const response = await apiClient.get<IServerResponse<TeamMember[]>>(
      `${rootUrl}/my-team-members`
    );
    return response.data;
  },

  getTeamTimeLogsSummary: async (
    startDate?: string,
    endDate?: string
  ): Promise<
    IServerResponse<{
      filteredRows: TimeLogsSummary[];
      totals: {
        total_time_logs: string;
        total_estimated_hours: string;
        total_utilization: string;
      };
    }>
  > => {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);

    const response = await apiClient.get<
      IServerResponse<{
        filteredRows: TimeLogsSummary[];
        totals: {
          total_time_logs: string;
          total_estimated_hours: string;
          total_utilization: string;
        };
      }>
    >(`${rootUrl}/team-time-logs-summary${params.toString() ? '?' + params.toString() : ''}`);
    return response.data;
  },

  getMemberDetailedTimeLogs: async (
    memberId: string,
    startDate?: string,
    endDate?: string,
    page: number = 1,
    limit: number = 50
  ): Promise<IServerResponse<TimeLogsResponse>> => {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);

    const response = await apiClient.get<IServerResponse<TimeLogsResponse>>(
      `${rootUrl}/member-time-logs/${memberId}?${params.toString()}`
    );
    return response.data;
  },

  getTeamPerformanceStats: async (
    startDate?: string,
    endDate?: string
  ): Promise<IServerResponse<PerformanceStats[]>> => {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);

    const response = await apiClient.get<IServerResponse<PerformanceStats[]>>(
      `${rootUrl}/team-performance${params.toString() ? '?' + params.toString() : ''}`
    );
    return response.data;
  },
};
