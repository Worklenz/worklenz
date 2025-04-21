import { IServerResponse } from '@/types/common.types';
import { API_BASE_URL } from '@/shared/constants';
import { ITaskPrioritiesGetResponse, ITaskPriority } from '@/types/tasks/taskPriority.types';
import apiClient from '@api/api-client';

const rootUrl = `${API_BASE_URL}/task-priorities`;

export const priorityApiService = {
  getPriorities: async (): Promise<IServerResponse<ITaskPrioritiesGetResponse[]>> => {
    const response = await apiClient.get<IServerResponse<ITaskPrioritiesGetResponse[]>>(
      `${rootUrl}`
    );
    return response.data;
  },

  getPriorityById: async (priorityId: string): Promise<IServerResponse<ITaskPriority>> => {
    const response = await apiClient.get<IServerResponse<ITaskPriority>>(
      `${rootUrl}/${priorityId}`
    );
    return response.data;
  },
};
