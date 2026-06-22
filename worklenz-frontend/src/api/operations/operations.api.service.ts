import { API_BASE_URL } from '@/shared/constants';
import { IServerResponse } from '@/types/common.types';
import {
  IOperationalCasesResponse,
  OperationalCaseStatus,
  OperationalCaseType,
} from '@/types/operations/operations.types';
import apiClient from '../api-client';

const rootUrl = `${API_BASE_URL}/cases`;

export const operationsApiService = {
  getCases: async (params?: {
    case_type?: OperationalCaseType | 'all';
    status?: OperationalCaseStatus | 'all';
    search?: string;
  }): Promise<IServerResponse<IOperationalCasesResponse>> => {
    const searchParams = new URLSearchParams();

    if (params?.case_type && params.case_type !== 'all') {
      searchParams.set('case_type', params.case_type);
    }
    if (params?.status && params.status !== 'all') {
      searchParams.set('status', params.status);
    }
    if (params?.search) {
      searchParams.set('search', params.search);
    }

    const query = searchParams.toString();
    const response = await apiClient.get<IServerResponse<IOperationalCasesResponse>>(
      `${rootUrl}${query ? `?${query}` : ''}`
    );
    return response.data;
  },
};
