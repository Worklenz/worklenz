import apiClient from '@api/api-client';
import { API_BASE_URL } from '@/shared/constants';
import { IServerResponse } from '@/types/common.types';
import { IOrgConfig } from '@/features/org-config/org-config.slice';

const rootUrl = `${API_BASE_URL}/settings`;

export const orgConfigurationApiService = {
  getOrgConfiguration: async (): Promise<IServerResponse<IOrgConfig>> => {
    const response = await apiClient.get<IServerResponse<IOrgConfig>>(
      `${rootUrl}/configuration`
    );
    return response.data;
  },

  updateOrgConfiguration: async (
    body: Partial<IOrgConfig>
  ): Promise<IServerResponse<IOrgConfig>> => {
    const response = await apiClient.put<IServerResponse<IOrgConfig>>(
      `${rootUrl}/configuration`,
      body
    );
    return response.data;
  },
};
