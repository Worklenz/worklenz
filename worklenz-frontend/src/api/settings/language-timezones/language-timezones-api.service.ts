import { API_BASE_URL } from '@/shared/constants';
import { IServerResponse } from '@/types/common.types';
import { ITimezone } from '@/types/settings/timezone.types';
import apiClient from '@api/api-client';

const rootUrl = `${API_BASE_URL}/timezones`;

export const timezonesApiService = {
  update: async <T>(body: any): Promise<IServerResponse<ITimezone[]>> => {
    const response = await apiClient.put<IServerResponse<ITimezone[]>>(rootUrl, body);
    return response.data;
  },

  get: async <T>(): Promise<IServerResponse<ITimezone[]>> => {
    const response = await apiClient.get<IServerResponse<ITimezone[]>>(rootUrl);
    return response.data;
  },
};
