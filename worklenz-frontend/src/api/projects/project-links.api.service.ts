import apiClient from '@api/api-client';
import { API_BASE_URL } from '@/shared/constants';
import { IServerResponse } from '@/types/common.types';
import {
  ICreateLinkBody,
  IProjectLink,
  IProjectLinksResponse,
  IUpdateLinkBody,
} from '@/types/projects/project-links.types';

const rootUrl = `${API_BASE_URL}/projects`;

const projectLinksApiService = {
  list: async (
    projectId: string,
    page: number,
    size: number
  ): Promise<IServerResponse<IProjectLinksResponse>> => {
    const response = await apiClient.get<IServerResponse<IProjectLinksResponse>>(
      `${rootUrl}/${projectId}/links?page=${page}&size=${size}`
    );
    return response.data;
  },

  create: async (
    projectId: string,
    body: ICreateLinkBody
  ): Promise<IServerResponse<IProjectLink>> => {
    const response = await apiClient.post<IServerResponse<IProjectLink>>(
      `${rootUrl}/${projectId}/links`,
      body
    );
    return response.data;
  },

  update: async (
    projectId: string,
    linkId: string,
    body: IUpdateLinkBody
  ): Promise<IServerResponse<null>> => {
    const response = await apiClient.put<IServerResponse<null>>(
      `${rootUrl}/${projectId}/links/${linkId}`,
      body
    );
    return response.data;
  },

  delete: async (
    projectId: string,
    linkId: string
  ): Promise<IServerResponse<null>> => {
    const response = await apiClient.delete<IServerResponse<null>>(
      `${rootUrl}/${projectId}/links/${linkId}`
    );
    return response.data;
  },
};

export default projectLinksApiService;
