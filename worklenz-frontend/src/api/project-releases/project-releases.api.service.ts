import apiClient from '@api/api-client';
import { API_BASE_URL } from '@/shared/constants';
import { IServerResponse } from '@/types/common.types';
import {
  IProjectRelease,
  IProjectReleaseInput,
  IReleaseAddItemsResult,
  IReleaseWorkItem,
  ITaskReleaseAssignment,
} from '@/types/project/projectRelease.types';
import { toQueryString } from '@/utils/toQueryString';

const rootUrl = `${API_BASE_URL}/project-releases`;

export const projectReleasesApiService = {
  getByProjectId: async (projectId: string) => {
    const q = toQueryString({ project_id: projectId });
    const response = await apiClient.get<IServerResponse<IProjectRelease[]>>(`${rootUrl}${q}`);
    return response.data;
  },

  getItems: async (projectId: string, releaseId: string) => {
    const q = toQueryString({ project_id: projectId });
    const response = await apiClient.get<IServerResponse<IReleaseWorkItem[]>>(
      `${rootUrl}/${releaseId}/items${q}`
    );
    return response.data;
  },

  getAvailableItems: async (projectId: string) => {
    const q = toQueryString({ project_id: projectId });
    const response = await apiClient.get<IServerResponse<IReleaseWorkItem[]>>(
      `${rootUrl}/available-items${q}`
    );
    return response.data;
  },

  create: async (projectId: string, body: IProjectReleaseInput) => {
    const response = await apiClient.post<IServerResponse<IProjectRelease>>(rootUrl, {
      ...body,
      project_id: projectId,
    });
    return response.data;
  },

  update: async (projectId: string, releaseId: string, body: IProjectReleaseInput) => {
    const response = await apiClient.put<IServerResponse<IProjectRelease>>(
      `${rootUrl}/${releaseId}`,
      { ...body, project_id: projectId }
    );
    return response.data;
  },

  markReleased: async (projectId: string, releaseId: string) => {
    const response = await apiClient.put<IServerResponse<IProjectRelease>>(
      `${rootUrl}/${releaseId}/release`,
      { project_id: projectId }
    );
    return response.data;
  },

  addItems: async (projectId: string, releaseId: string, taskIds: string[]) => {
    const response = await apiClient.post<IServerResponse<IReleaseAddItemsResult>>(
      `${rootUrl}/${releaseId}/items`,
      { project_id: projectId, task_ids: taskIds }
    );
    return response.data;
  },

  removeItem: async (projectId: string, releaseId: string, taskId: string) => {
    const q = toQueryString({ project_id: projectId });
    const response = await apiClient.delete<IServerResponse<IProjectRelease>>(
      `${rootUrl}/${releaseId}/items/${taskId}${q}`
    );
    return response.data;
  },

  assignTask: async (projectId: string, taskId: string, releaseId: string | null) => {
    const response = await apiClient.put<IServerResponse<ITaskReleaseAssignment>>(
      `${rootUrl}/assign/${taskId}`,
      { project_id: projectId, release_id: releaseId }
    );
    return response.data;
  },
};
