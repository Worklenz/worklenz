import apiClient from '@api/api-client';
import { API_BASE_URL } from '@/shared/constants';
import { IServerResponse } from '@/types/common.types';
import { IWhatsNewRelease } from '@/types/whats-new/whats-new.types';

const rootUrl = `${API_BASE_URL}/whats-new`;

export const whatsNewApiService = {
  getCurrent: async (): Promise<IServerResponse<IWhatsNewRelease | null>> => {
    const response = await apiClient.get<IServerResponse<IWhatsNewRelease | null>>(
      `${rootUrl}/current`
    );
    return response.data;
  },

  dismiss: async (releaseId: string): Promise<IServerResponse<null>> => {
    const response = await apiClient.post<IServerResponse<null>>(`${rootUrl}/dismiss`, {
      release_id: releaseId,
    });
    return response.data;
  },

  getById: async (releaseId: string): Promise<IServerResponse<IWhatsNewRelease | null>> => {
    const response = await apiClient.get<IServerResponse<IWhatsNewRelease | null>>(
      `${rootUrl}/releases/${releaseId}`
    );
    return response.data;
  },
};
