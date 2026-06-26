import { IServerResponse } from '@/types/common.types';
import { API_BASE_URL } from '@/shared/constants';
import {
  IProjectPriority,
  IProjectPrioritiesGetResponse,
} from '@/types/project/projectPriority.types';
import apiClient from '@api/api-client';

const rootUrl = `${API_BASE_URL}/project-priorities`;

export const projectPrioritiesApiService = {
  getPriorities: async (): Promise<IServerResponse<IProjectPrioritiesGetResponse[]>> => {
    const response = await apiClient.get<IServerResponse<IProjectPrioritiesGetResponse[]>>(
      `${rootUrl}`
    );
    return response.data;
  },

  getPriorityById: async (priorityId: string): Promise<IServerResponse<IProjectPriority>> => {
    const response = await apiClient.get<IServerResponse<IProjectPriority>>(
      `${rootUrl}/${priorityId}`
    );
    return response.data;
  },
};
