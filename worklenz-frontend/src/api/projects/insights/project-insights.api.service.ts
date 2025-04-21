import { IServerResponse } from '@/types/common.types';
import apiClient from '@/api/api-client';
import { API_BASE_URL } from '@/shared/constants';
import { toQueryString } from '@/utils/toQueryString';
import { IProjectViewModel } from '@/types/project/projectViewModel.types';
import { IDeadlineTaskStats } from '@/types/project/projectInsights.types';
import {
  IInsightTasks,
  IProjectInsightsGetRequest,
  IProjectLogs,
  IProjectMemberStats,
} from '@/types/project/projectInsights.types';
import { ITaskStatusCounts } from '@/types/project/project-insights.types';

const rootUrl = `${API_BASE_URL}/project-insights`;

export const projectInsightsApiService = {
  getProjectInsights: async (id: string): Promise<IServerResponse<IProjectViewModel>> => {
    const url = `${rootUrl}/${id}/insights`;
    const response = await apiClient.get<IServerResponse<IProjectViewModel>>(`${url}`);
    return response.data;
  },

  getProjectOverviewData: async (
    id: string,
    include_archived: boolean
  ): Promise<IServerResponse<IProjectInsightsGetRequest>> => {
    const url = `${rootUrl}/${id}?archived=${include_archived}`;
    const response = await apiClient.get<IServerResponse<IProjectInsightsGetRequest>>(url);
    return response.data;
  },

  getLastUpdatedTasks: async (
    id: string,
    include_archived: boolean
  ): Promise<IServerResponse<IInsightTasks[]>> => {
    const url = `${rootUrl}/last-updated/${id}?archived=${include_archived}`;
    const response = await apiClient.get<IServerResponse<IInsightTasks[]>>(url);
    return response.data;
  },

  getProjectLogs: async (id: string): Promise<IServerResponse<IProjectLogs[]>> => {
    const url = `${rootUrl}/logs/${id}`;
    const response = await apiClient.get<IServerResponse<IProjectLogs[]>>(url);
    return response.data;
  },

  getTaskStatusCounts: async (
    id: string,
    include_archived: boolean
  ): Promise<IServerResponse<ITaskStatusCounts[]>> => {
    const url = `${rootUrl}/status-overview/${id}?archived=${include_archived}`;
    const response = await apiClient.get<IServerResponse<ITaskStatusCounts[]>>(url);
    return response.data;
  },

  getPriorityOverview: async (
    id: string,
    include_archived: boolean
  ): Promise<IServerResponse<ITaskStatusCounts[]>> => {
    const url = `${rootUrl}/priority-overview/${id}?archived=${include_archived}`;
    const response = await apiClient.get<IServerResponse<ITaskStatusCounts[]>>(url);
    return response.data;
  },

  getOverdueTasks: async (
    id: string,
    include_archived: boolean
  ): Promise<IServerResponse<IInsightTasks[]>> => {
    const url = `${rootUrl}/overdue-tasks/${id}?archived=${include_archived}`;
    const response = await apiClient.get<IServerResponse<IInsightTasks[]>>(url);
    return response.data;
  },

  getTasksCompletedEarly: async (
    id: string,
    include_archived: boolean
  ): Promise<IServerResponse<IInsightTasks[]>> => {
    const url = `${rootUrl}/early-tasks/${id}?archived=${include_archived}`;
    const response = await apiClient.get<IServerResponse<IInsightTasks[]>>(url);
    return response.data;
  },

  getTasksCompletedLate: async (
    id: string,
    include_archived: boolean
  ): Promise<IServerResponse<IInsightTasks[]>> => {
    const url = `${rootUrl}/late-tasks/${id}?archived=${include_archived}`;
    const response = await apiClient.get<IServerResponse<IInsightTasks[]>>(url);
    return response.data;
  },

  getMemberInsightAStats: async (
    id: string,
    include_archived: boolean
  ): Promise<IServerResponse<IProjectMemberStats>> => {
    const url = `${rootUrl}/members/stats/${id}?archived=${include_archived}`;
    const response = await apiClient.get<IServerResponse<IProjectMemberStats>>(url);
    return response.data;
  },

  getMemberTasks: async (body: any): Promise<IServerResponse<IInsightTasks[]>> => {
    const url = `${rootUrl}/members/tasks`;
    const response = await apiClient.post<IServerResponse<IInsightTasks[]>>(url, body);
    return response.data;
  },

  getProjectDeadlineStats: async (
    id: string,
    include_archived: boolean
  ): Promise<IServerResponse<IDeadlineTaskStats>> => {
    const url = `${rootUrl}/deadline/${id}?archived=${include_archived}`;
    const response = await apiClient.get<IServerResponse<IDeadlineTaskStats>>(url);
    return response.data;
  },

  getOverloggedTasks: async (
    id: string,
    include_archived: boolean
  ): Promise<IServerResponse<IInsightTasks[]>> => {
    const url = `${rootUrl}/overlogged-tasks/${id}?archived=${include_archived}`;
    const response = await apiClient.get<IServerResponse<IInsightTasks[]>>(url);
    return response.data;
  },
};
