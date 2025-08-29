import apiClient from '../api-client';
import { API_BASE_URL } from '@/shared/constants';
import { IServerResponse } from '@/types/common.types';

export interface ContactSupportRequest {
  subscription_type?: string;
  reason?: string;
}

const rootUrl = `${API_BASE_URL}/support`;

export const supportApiService = {
  contactSupport: async (request: ContactSupportRequest): Promise<IServerResponse<any>> => {
    const response = await apiClient.post<IServerResponse<any>>(`${rootUrl}/contact`, request);
    return response.data;
  },
};
