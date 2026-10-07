import apiClient from '@api/api-client';
import { API_BASE_URL } from '@/shared/constants';
import { IServerResponse } from '@/types/common.types';
import { ITaskDuplicateRequest } from '@/types/tasks/task-duplicate.types';
import { ITaskViewModel } from '@/types/tasks/task.types';

const taskDuplicateApiService = {
  compare: async (data: Pick<ITaskDuplicateRequest, 'task_id' | 'project_id' | 'destination_project_id'>) => {
    const response = await apiClient.post(`${API_BASE_URL}/task-duplicate/compare`, data);
    return response.data;
  },

  duplicate: async (
    data: ITaskDuplicateRequest
  ): Promise<IServerResponse<ITaskViewModel>> => {
    const response = await apiClient.post(`${API_BASE_URL}/task-duplicate/duplicate`, data);
    return response.data;
  },
};

export default taskDuplicateApiService;
