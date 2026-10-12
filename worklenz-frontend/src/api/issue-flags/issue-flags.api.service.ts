import apiClient from '@api/api-client';
import { API_BASE_URL } from '@/shared/constants';
import { IServerResponse } from '@/types/common.types';

const rootUrl = `${API_BASE_URL}/issue-flags`;

export const issueFlagsApiService = {
  setBlocked: async (projectId: string, taskId: string, isBlocked: boolean) => {
    const response = await apiClient.put<IServerResponse<{ id: string; is_blocked: boolean }>>(
      `${rootUrl}/blocked/${taskId}`,
      { project_id: projectId, is_blocked: isBlocked }
    );
    return response.data;
  },
};
