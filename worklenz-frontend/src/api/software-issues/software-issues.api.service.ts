import apiClient from '@api/api-client';
import { API_BASE_URL } from '@/shared/constants';
import { IServerResponse } from '@/types/common.types';
import {
  ICreateSoftwareIssueRequest,
  ICreateSoftwareIssueResponse,
  ISoftwareWorkItem,
} from '@/types/project/softwareIssue.types';

const rootUrl = `${API_BASE_URL}/software-issues`;

export const softwareIssuesApiService = {
  getWorkItems: async (projectId: string) => {
    const response = await apiClient.get<IServerResponse<ISoftwareWorkItem[]>>(rootUrl, {
      params: { project_id: projectId },
    });
    return response.data;
  },

  create: async (body: ICreateSoftwareIssueRequest) => {
    const response = await apiClient.post<IServerResponse<ICreateSoftwareIssueResponse>>(
      rootUrl,
      body
    );
    return response.data;
  },
};
