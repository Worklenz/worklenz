import { IServerResponse } from '@/types/common.types';
import { API_BASE_URL } from '@/shared/constants';
import { IProjectHealth } from '@/types/project/projectHealth.types';
import apiClient from '@api/api-client';

const rootUrl = `${API_BASE_URL}/project-healths`;

export const projectHealthApiService = {
  getHealthOptions: async (): Promise<IServerResponse<IProjectHealth[]>> => {
    const response = await apiClient.get<IServerResponse<IProjectHealth[]>>(rootUrl);
    return response.data;
  },
};
