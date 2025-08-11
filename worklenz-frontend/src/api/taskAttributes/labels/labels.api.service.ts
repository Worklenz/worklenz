import { IServerResponse } from '@/types/common.types';
import { API_BASE_URL } from '@/shared/constants';
import apiClient from '@api/api-client';
import { ITaskLabel } from '@/types/tasks/taskLabel.types';

const rootUrl = `${API_BASE_URL}/labels`;

export const labelsApiService = {
  getLabels: async (): Promise<IServerResponse<ITaskLabel[]>> => {
    const response = await apiClient.get<IServerResponse<ITaskLabel[]>>(`${rootUrl}`);
    return response.data;
  },

  getPriorityByTask: async (taskId: string): Promise<IServerResponse<ITaskLabel[]>> => {
    const response = await apiClient.get<IServerResponse<ITaskLabel[]>>(
      `${rootUrl}/tasks/${taskId}`
    );
    return response.data;
  },

  getPriorityByProject: async (projectId: string): Promise<IServerResponse<ITaskLabel[]>> => {
    const response = await apiClient.get<IServerResponse<ITaskLabel[]>>(
      `${rootUrl}/project/${projectId}`
    );
    return response.data;
  },

  updateColor: async (labelId: string, color: string): Promise<IServerResponse<ITaskLabel>> => {
    const response = await apiClient.put<IServerResponse<ITaskLabel>>(
      `${rootUrl}/tasks/${labelId}`,
      { color }
    );
    return response.data;
  },

  updateLabel: async (labelId: string, data: { name?: string; color?: string }): Promise<IServerResponse<ITaskLabel>> => {
    const response = await apiClient.put<IServerResponse<ITaskLabel>>(`${rootUrl}/team/${labelId}`, data);
    return response.data;
  },

  deleteById: async (labelId: string): Promise<IServerResponse<void>> => {
    const response = await apiClient.delete<IServerResponse<void>>(`${rootUrl}/team/${labelId}`);
    return response.data;
  },
};
