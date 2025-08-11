import apiClient from '../api-client';
import { API_BASE_URL } from '@/shared/constants';
import { IServerResponse } from '@/types/common.types';

export interface AccountDeletionRequest {
  userId: string;
  userEmail: string;
  userName: string;
}

const rootUrl = `${API_BASE_URL}/account`;

export const accountApiService = {
  requestDeletion: async (request: AccountDeletionRequest): Promise<IServerResponse<any>> => {
    const response = await apiClient.post<IServerResponse<any>>(`${rootUrl}/deletion-request`, request);
    return response.data;
  },

  cancelDeletion: async (): Promise<IServerResponse<any>> => {
    const response = await apiClient.post<IServerResponse<any>>(`${rootUrl}/cancel-deletion`);
    return response.data;
  },
};