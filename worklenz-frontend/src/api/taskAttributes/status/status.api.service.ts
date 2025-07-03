import { IServerResponse } from '@/types/common.types';
import apiClient from '@api/api-client';
import { API_BASE_URL } from '@/shared/constants';
import { ITaskStatus, ITaskStatusCategory } from '@/types/status.types';
import { ITaskStatusCreateRequest } from '@/types/tasks/task-status-create-request';
import { toQueryString } from '@/utils/toQueryString';
import { ITaskStatusUpdateModel } from '@/types/tasks/task-status-update-model.types';

const rootUrl = `${API_BASE_URL}/statuses`;

export const statusApiService = {
  getStatuses: async (projectId: string): Promise<IServerResponse<ITaskStatus[]>> => {
    const response = await apiClient.get<IServerResponse<ITaskStatus[]>>(
      `${rootUrl}?project=${projectId}`
    );
    return response.data;
  },

  getStatusCategories: async (): Promise<IServerResponse<ITaskStatusCategory[]>> => {
    const response = await apiClient.get<IServerResponse<ITaskStatusCategory[]>>(
      `${rootUrl}/categories`
    );
    return response.data;
  },

  createStatus: async (
    body: ITaskStatusCreateRequest,
    currentProjectId: string
  ): Promise<IServerResponse<ITaskStatus>> => {
    const q = toQueryString({ current_project_id: currentProjectId });
    const response = await apiClient.post<IServerResponse<ITaskStatus>>(`${rootUrl}${q}`, body);
    return response.data;
  },

  updateStatus: async (
    statusId: string,
    body: ITaskStatusUpdateModel,
    currentProjectId: string
  ): Promise<IServerResponse<ITaskStatus>> => {
    const q = toQueryString({ current_project_id: currentProjectId });

    const response = await apiClient.put<IServerResponse<ITaskStatus>>(
      `${rootUrl}/${statusId}${q}`,
      body
    );
    return response.data;
  },

  updateNameOfStatus: async (
    id: string,
    body: ITaskStatusUpdateModel,
    currentProjectId: string
  ): Promise<IServerResponse<ITaskStatus>> => {
    const q = toQueryString({ current_project_id: currentProjectId });

    const response = await apiClient.put<IServerResponse<ITaskStatus>>(
      `${rootUrl}/name/${id}${q}`,
      body
    );
    return response.data;
  },

  updateStatusOrder: async (
    body: ITaskStatusCreateRequest,
    currentProjectId: string
  ): Promise<IServerResponse<ITaskStatus>> => {
    const q = toQueryString({ current_project_id: currentProjectId });
    const response = await apiClient.put<IServerResponse<ITaskStatus>>(`${rootUrl}/order`, body);
    return response.data;
  },

  deleteStatus: async (
    statusId: string,
    projectId: string,
    replacingStatusId: string
  ): Promise<IServerResponse<void>> => {
    const q = toQueryString({
      project: projectId,
      current_project_id: projectId,
      replace: replacingStatusId || null,
    });
    const response = await apiClient.delete<IServerResponse<void>>(`${rootUrl}/${statusId}${q}`);
    return response.data;
  },
};
