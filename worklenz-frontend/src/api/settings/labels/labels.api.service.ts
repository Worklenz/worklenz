import apiClient from '@api/api-client';
import { API_BASE_URL } from '@/shared/constants';
import { IServerResponse } from '@/types/common.types';
import { ITaskLabel } from '@/types/label.type';
import { toQueryString } from '@/utils/toQueryString';

const rootUrl = `${API_BASE_URL}/labels`;

export const labelsApiService = {
  getLabels: async (projectId: string | null = null): Promise<IServerResponse<ITaskLabel>> => {
    const q = toQueryString({ project: projectId });
    const response = await apiClient.get<IServerResponse<ITaskLabel>>(`${rootUrl}${q}`);
    return response.data;
  },

  getLabelsByTaskId: async (taskId: string): Promise<IServerResponse<ITaskLabel>> => {
    const response = await apiClient.get<IServerResponse<ITaskLabel>>(`${rootUrl}/tasks/${taskId}`);
    return response.data;
  },

  getByProjectId: async (projectId: string): Promise<IServerResponse<ITaskLabel>> => {
    const response = await apiClient.get<IServerResponse<ITaskLabel>>(
      `${rootUrl}/project/${projectId}`
    );
    return response.data;
  },

  updateColor: async (id: string, color: string): Promise<IServerResponse<ITaskLabel>> => {
    const response = await apiClient.put<IServerResponse<ITaskLabel>>(`${rootUrl}/tasks/${id}`, {
      color,
    });
    return response.data;
  },

  deleteLabel: async (id: string): Promise<IServerResponse<void>> => {
    const response = await apiClient.delete<IServerResponse<void>>(`${rootUrl}/${id}`);
    return response.data;
  },
};
