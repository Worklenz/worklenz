import apiClient from '@/api/api-client';
import { API_BASE_URL } from '@/shared/constants';
import { IServerResponse } from '@/types/common.types';
import {
  IProjectDoc,
  IProjectDocPayload,
  IProjectDocTask,
} from '@/types/projects/project-docs.types';

const projectDocsApiService = {
  list: async (projectId: string): Promise<IServerResponse<IProjectDoc[]>> => {
    const response = await apiClient.get<IServerResponse<IProjectDoc[]>>(
      `${API_BASE_URL}/projects/${projectId}/docs`
    );
    return response.data;
  },

  get: async (projectId: string, docId: string): Promise<IServerResponse<IProjectDoc>> => {
    const response = await apiClient.get<IServerResponse<IProjectDoc>>(
      `${API_BASE_URL}/projects/${projectId}/docs/${docId}`
    );
    return response.data;
  },

  create: async (
    projectId: string,
    payload: IProjectDocPayload
  ): Promise<IServerResponse<IProjectDoc>> => {
    const response = await apiClient.post<IServerResponse<IProjectDoc>>(
      `${API_BASE_URL}/projects/${projectId}/docs`,
      payload
    );
    return response.data;
  },

  update: async (
    projectId: string,
    docId: string,
    payload: IProjectDocPayload
  ): Promise<IServerResponse<IProjectDoc>> => {
    const response = await apiClient.put<IServerResponse<IProjectDoc>>(
      `${API_BASE_URL}/projects/${projectId}/docs/${docId}`,
      payload
    );
    return response.data;
  },

  remove: async (projectId: string, docId: string): Promise<IServerResponse<null>> => {
    const response = await apiClient.delete<IServerResponse<null>>(
      `${API_BASE_URL}/projects/${projectId}/docs/${docId}`
    );
    return response.data;
  },

  updateTasks: async (
    projectId: string,
    docId: string,
    taskIds: string[]
  ): Promise<IServerResponse<null>> => {
    const response = await apiClient.put<IServerResponse<null>>(
      `${API_BASE_URL}/projects/${projectId}/docs/${docId}/tasks`,
      { task_ids: taskIds }
    );
    return response.data;
  },

  listByTask: async (
    projectId: string,
    taskId: string
  ): Promise<IServerResponse<IProjectDocTask[]>> => {
    const response = await apiClient.get<IServerResponse<IProjectDocTask[]>>(
      `${API_BASE_URL}/projects/${projectId}/docs/task/${taskId}`
    );
    return response.data;
  },
};

export default projectDocsApiService;
