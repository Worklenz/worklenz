import { IProjectMemberViewModel } from '@/types/projectMember.types';
import apiClient from '../api-client';
import { API_BASE_URL } from '@/shared/constants';
import { IServerResponse } from '@/types/common.types';
import { toQueryString } from '@/utils/toQueryString';

const rootUrl = `${API_BASE_URL}/project-members`;

export const projectMembersApiService = {
  createProjectMember: async (
    body: IProjectMemberViewModel
  ): Promise<IServerResponse<IProjectMemberViewModel>> => {
    const q = toQueryString({ current_project_id: body.project_id });

    const response = await apiClient.post<IServerResponse<IProjectMemberViewModel>>(
      `${rootUrl}${q}`,
      body
    );
    return response.data;
  },

  createByEmail: async (body: {
    project_id: string;
    email: string;
  }): Promise<IServerResponse<IProjectMemberViewModel>> => {
    const response = await apiClient.post<IServerResponse<IProjectMemberViewModel>>(
      `${rootUrl}/invite`,
      body
    );
    return response.data;
  },

  getByProjectId: async (
    projectId: string
  ): Promise<IServerResponse<IProjectMemberViewModel[]>> => {
    const response = await apiClient.get<IServerResponse<IProjectMemberViewModel[]>>(
      `${rootUrl}/${projectId}`
    );
    return response.data;
  },

  deleteProjectMember: async (
    id: string,
    currentProjectId: string
  ): Promise<IServerResponse<IProjectMemberViewModel>> => {
    const q = toQueryString({ current_project_id: currentProjectId });
    const response = await apiClient.delete<IServerResponse<IProjectMemberViewModel>>(
      `${rootUrl}/${id}${q}`
    );
    return response.data;
  },
};
