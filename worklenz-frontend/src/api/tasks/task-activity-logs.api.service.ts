import { API_BASE_URL } from '@/shared/constants';
import apiClient from '../api-client';
import { IServerResponse } from '@/types/common.types';
import { IActivityLogsResponse } from '@/types/tasks/task-activity-logs-get-request';

const rootUrl = `${API_BASE_URL}/activity-logs`;

export const taskActivityLogsApiService = {
  getActivityLogsByTaskId: async (
    taskId: string
  ): Promise<IServerResponse<IActivityLogsResponse>> => {
    const response = await apiClient.get(`${rootUrl}/${taskId}`);
    return response.data;
  },
};
