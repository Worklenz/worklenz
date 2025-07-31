import { API_BASE_URL } from '@/shared/constants';
import apiClient from '../api-client';
import { IServerResponse } from '@/types/common.types';
import { ISubTask } from '@/types/tasks/subTask.types';

const root = `${API_BASE_URL}/sub-tasks`;

export const subTasksApiService = {
  getSubTasks: async (parentTaskId: string): Promise<IServerResponse<ISubTask[]>> => {
    const response = await apiClient.get(`${root}/${parentTaskId}`);
    return response.data;
  },
};
