import apiClient from '@api/api-client';
import { API_BASE_URL } from '@/shared/constants';
import { IServerResponse } from '@/types/common.types';
import { ITaskDuplicateRequest } from '@/types/tasks/task-duplicate.types';

const taskDuplicateApiService = {
  duplicate: async (
    data: ITaskDuplicateRequest
  ): Promise<IServerResponse<ITaskDuplicateRequest>> => {
    const response = await apiClient.post(`${API_BASE_URL}/task-duplicate/duplicate`, data);
    return response.data;
  },
};

export default taskDuplicateApiService;
