import apiClient from '@api/api-client';
import { API_BASE_URL } from '@/shared/constants';
import { IServerResponse } from '@/types/common.types';
import {
  IProjectEpic,
  IProjectEpicInput,
  ITaskEpicAssignment,
} from '@/types/project/projectEpic.types';
import { toQueryString } from '@/utils/toQueryString';

const rootUrl = `${API_BASE_URL}/project-epics`;

export const projectEpicsApiService = {
  getByProjectId: async (projectId: string) => {
    const q = toQueryString({ project_id: projectId });
    const response = await apiClient.get<IServerResponse<IProjectEpic[]>>(`${rootUrl}${q}`);
    return response.data;
  },

  create: async (projectId: string, body: IProjectEpicInput) => {
    const response = await apiClient.post<IServerResponse<IProjectEpic>>(rootUrl, {
      ...body,
      project_id: projectId,
    });
    return response.data;
  },

  update: async (projectId: string, epicId: string, body: IProjectEpicInput) => {
    const response = await apiClient.put<IServerResponse<IProjectEpic>>(`${rootUrl}/${epicId}`, {
      ...body,
      project_id: projectId,
    });
    return response.data;
  },

  assignTask: async (projectId: string, taskId: string, epicId: string | null) => {
    const response = await apiClient.put<IServerResponse<ITaskEpicAssignment>>(
      `${rootUrl}/assign/${taskId}`,
      { project_id: projectId, epic_id: epicId }
    );
    return response.data;
  },
};
