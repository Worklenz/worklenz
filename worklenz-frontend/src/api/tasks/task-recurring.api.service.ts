import { API_BASE_URL } from '@/shared/constants';
import { IServerResponse } from '@/types/common.types';
import { ITaskRecurringSchedule } from '@/types/tasks/task-recurring-schedule';
import apiClient from '../api-client';

const rootUrl = `${API_BASE_URL}/task-recurring`;

export const taskRecurringApiService = {
  getTaskRecurringData: async (
    schedule_id: string
  ): Promise<IServerResponse<ITaskRecurringSchedule>> => {
    const response = await apiClient.get(`${rootUrl}/${schedule_id}`);
    return response.data;
  },
  updateTaskRecurringData: async (
    schedule_id: string,
    body: any
  ): Promise<IServerResponse<ITaskRecurringSchedule>> => {
    return apiClient.put(`${rootUrl}/${schedule_id}`, body);
  },
};
