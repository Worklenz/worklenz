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
};
