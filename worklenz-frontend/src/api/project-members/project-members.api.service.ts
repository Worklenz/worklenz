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

  inviteByEmail: async (body: {
    email: string;
    project_id: string;
    job_title_id?: string;
    access_level?: string;
    role_name?: string;
    is_admin?: boolean;
  }): Promise<IServerResponse<any>> => {
    const response = await apiClient.post<IServerResponse<any>>(`${rootUrl}/invite`, body);
    return response.data;
  },

  // Project invitation link methods
  generateInvitationLink: async (body: {
    project_id: string;
    access_level?: string;
    job_title_id?: string;
    role_name?: string;
    is_admin?: boolean;
    max_usage?: number | null;
  }): Promise<
    IServerResponse<{
      id: string;
      token: string;
      invitation_url: string;
      project_name: string;
      expires_at: string;
      expires_in_days: number;
      created_at: string;
      error_code: string;
    }>
  > => {
    const response = await apiClient.post<IServerResponse<any>>(`${rootUrl}/invitation-link`, body);
    return response.data;
  },

  getInvitationLinkStatus: async (
    projectId: string
  ): Promise<
    IServerResponse<{
      has_active_link: boolean;
      invitation_url?: string;
      expires_at?: string;
      usage_count?: number;
      max_usage?: number | null;
      created_at?: string;
      access_level?: string;
      project_name: string;
    }>
  > => {
    const params = new URLSearchParams({ project_id: projectId });
    const response = await apiClient.get<IServerResponse<any>>(
      `${rootUrl}/invitation-link/status?${params}`
    );
    return response.data;
  },

  revokeInvitationLink: async (projectId: string): Promise<IServerResponse<any>> => {
    const response = await apiClient.put<IServerResponse<any>>(
      `${rootUrl}/invitation-link/revoke`,
      {
        project_id: projectId,
      }
    );
    return response.data;
  },

  validateInvitationLink: async (
    token: string
  ): Promise<
    IServerResponse<{
      project: {
        id: string;
        name: string;
        color_code: string;
        team_name: string;
        owner_name: string;
      };
      invitation: {
        expires_at: string;
        access_level: string;
        job_title_id?: string;
        role_name: string;
        is_admin: boolean;
      };
    }>
  > => {
    const response = await apiClient.get<IServerResponse<any>>(
      `${rootUrl}/invitation-link/validate/${token}`
    );
    return response.data;
  },

  acceptInvitationByLink: async (
    token: string,
    body: {
      name: string;
      email: string;
    }
  ): Promise<IServerResponse<any>> => {
    const response = await apiClient.post<IServerResponse<any>>(
      `${rootUrl}/invitation-link/accept/${token}`,
      body
    );
    return response.data;
  },
};
