import { IServerResponse } from '@/types/common.types';
import {
  IGetProjectsRequestBody,
  IRPTOverviewProjectInfo,
  IRPTOverviewProjectMember,
  IRPTProjectsViewModel,
} from '@/types/reporting/reporting.types';
import apiClient from '../api-client';
import { API_BASE_URL } from '@/shared/constants';
import { toQueryString } from '@/utils/toQueryString';
import { ITaskListGroup } from '@/types/tasks/taskList.types';

const rootUrl = `${API_BASE_URL}/reporting/projects`;

export const reportingProjectsApiService = {
  getProjects: async (
    body: IGetProjectsRequestBody
  ): Promise<IServerResponse<IRPTProjectsViewModel>> => {
    const q = toQueryString(body);
    const url = `${rootUrl}${q}`;
    const response = await apiClient.get<IServerResponse<IRPTProjectsViewModel>>(url);
    return response.data;
  },

  getProjectOverview: async (
    projectId: string
  ): Promise<IServerResponse<IRPTOverviewProjectInfo>> => {
    const url = `${API_BASE_URL}/reporting/overview/project/info/${projectId}`;
    const response = await apiClient.get<IServerResponse<IRPTOverviewProjectInfo>>(url);
    return response.data;
  },

  getProjectMembers: async (
    projectId: string
  ): Promise<IServerResponse<IRPTOverviewProjectMember[]>> => {
    const url = `${API_BASE_URL}/reporting/overview/project/members/${projectId}`;
    const response = await apiClient.get<IServerResponse<IRPTOverviewProjectMember[]>>(url);
    return response.data;
  },

  getTasks: async (
    projectId: string,
    groupBy: string
  ): Promise<IServerResponse<ITaskListGroup[]>> => {
    const q = toQueryString({ group: groupBy });

    const url = `${API_BASE_URL}/reporting/overview/project/tasks/${projectId}${q}`;
    const response = await apiClient.get<IServerResponse<ITaskListGroup[]>>(url);
    return response.data;
  },

  getTasksPaginated: async (
    projectId: string,
    params: {
      page?: number;
      pageSize?: number;
      search?: string;
      status?: string;
      priority?: string;
      assignee?: string;
      sortField?: string;
      sortOrder?: string;
    }
  ): Promise<
    IServerResponse<{
      data: any[];
      total: number;
      page: number;
      pageSize: number;
      stats: {
        total: number;
        completed: number;
        inProgress: number;
        overdue: number;
      };
      members: {
        team_member_id: string;
        name: string;
        avatar_url: string;
      }[];
    }>
  > => {
    const q = toQueryString(params);
    const url = `${API_BASE_URL}/reporting/overview/project/tasks-paginated/${projectId}${q}`;
    const response = await apiClient.get(url);
    return response.data;
  },

  getProjectsGrouped: async (params: {
    group_by?: string;
    search?: string;
    field?: string;
    order?: string;
    statuses?: string;
    healths?: string;
    categories?: string;
    project_managers?: string;
    teams?: string;
    archived?: boolean;
    index?: number;
    size?: number;
  }): Promise<
    IServerResponse<{
      groups: Array<{
        group_id: string;
        group_name: string;
        group_color: string;
        project_count: number;
        total_tasks: number;
        done_tasks: number;
        doing_tasks: number;
        todo_tasks: number;
        projects: any[];
      }>;
      total_groups: number;
    }>
  > => {
    const q = toQueryString(params);
    const url = `${rootUrl}/grouped${q}`;
    const response = await apiClient.get(url);
    return response.data;
  },

  getMemberTasks: async (
    teamMemberId: string,
    projectId?: string,
    params?: {
      archived?: boolean;
      search?: string;
      duration?: string;
      date_range?: string;
      only_single_member?: string;
    }
  ): Promise<IServerResponse<any[]>> => {
    const queryParams: Record<string, any> = {};
    
    if (projectId) {
      queryParams.project = projectId;
    }
    
    if (params?.archived !== undefined) {
      queryParams.archived = params.archived;
    }
    
    if (params?.search) {
      queryParams.search = params.search;
    }
    
    if (params?.duration) {
      queryParams.duration = params.duration;
    }
    
    if (params?.date_range) {
      queryParams.date_range = params.date_range;
    }
    
    if (params?.only_single_member) {
      queryParams.only_single_member = params.only_single_member;
    }

    const q = toQueryString(queryParams);
    const url = `${API_BASE_URL}/reporting/overview/member/tasks/${teamMemberId}${q}`;
    const response = await apiClient.get<IServerResponse<any[]>>(url);
    return response.data;
  },
};
