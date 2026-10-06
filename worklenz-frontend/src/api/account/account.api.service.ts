import apiClient from '../api-client';
import { API_BASE_URL } from '@/shared/constants';
import { IServerResponse } from '@/types/common.types';

export interface AccountDeletionRequest {
  userId: string;
  userEmail?: string;
  userName?: string;
}

const rootUrl = `${API_BASE_URL}/account`;

export const accountApiService = {
  requestDeletion: async (request: AccountDeletionRequest): Promise<IServerResponse<unknown>> => {
    const response = await apiClient.post<IServerResponse<unknown>>(
      `${rootUrl}/deletion-request`,
      request
    );
    return response.data;
  },

  cancelDeletion: async (): Promise<IServerResponse<unknown>> => {
    const response = await apiClient.post<IServerResponse<unknown>>(`${rootUrl}/cancel-deletion`);
    return response.data;
  },
};
