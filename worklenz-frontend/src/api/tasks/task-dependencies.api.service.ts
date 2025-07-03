import { API_BASE_URL } from '@/shared/constants';
import apiClient from '../api-client';
import { ITaskDependency } from '@/types/tasks/task-dependency.types';
import { IServerResponse } from '@/types/common.types';

const rootUrl = `${API_BASE_URL}/task-dependencies`;

export const taskDependenciesApiService = {
  getTaskDependencies: async (taskId: string): Promise<IServerResponse<ITaskDependency[]>> => {
    const response = await apiClient.get(`${rootUrl}/${taskId}`);
    return response.data;
  },
  createTaskDependency: async (
    body: ITaskDependency
  ): Promise<IServerResponse<ITaskDependency>> => {
    const response = await apiClient.post(`${rootUrl}`, body);
    return response.data;
  },
  deleteTaskDependency: async (dependencyId: string): Promise<IServerResponse<void>> => {
    const response = await apiClient.delete(`${rootUrl}/${dependencyId}`);
    return response.data;
  },
};
