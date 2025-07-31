import { IServerResponse } from '@/types/common.types';
import apiClient from '../../api-client';
import { API_BASE_URL } from '@/shared/constants';
import { IProjectStatus } from '@/types/project/projectStatus.types';

const rootUrl = `${API_BASE_URL}/project-statuses`;

export const projectStatusesApiService = {
  getStatuses: async (): Promise<IServerResponse<IProjectStatus[]>> => {
    const response = await apiClient.get<IServerResponse<IProjectStatus[]>>(rootUrl);
    return response.data;
  },
};
