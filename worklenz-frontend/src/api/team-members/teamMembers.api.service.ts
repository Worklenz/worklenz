import { IServerResponse } from '@/types/common.types';
import apiClient from '../api-client';
import { API_BASE_URL } from '@/shared/constants';
import { ITeamMemberCreateRequest } from '@/types/teamMembers/team-member-create-request';
import { ITeamMemberViewModel } from '@/types/teamMembers/teamMembersGetResponse.types';
import { ITeamMembersViewModel } from '@/types/teamMembers/teamMembersViewModel.types';
import { ITeamMember } from '@/types/teamMembers/teamMember.types';

const rootUrl = `${API_BASE_URL}/team-members`;

export const teamMembersApiService = {
  createTeamMember: async (
    body: ITeamMemberCreateRequest
  ): Promise<IServerResponse<ITeamMember>> => {
    const response = await apiClient.post<IServerResponse<ITeamMember>>(`${rootUrl}`, body);
    return response.data;
  },

  get: async (
    index: number,
    size: number,
    field: string | null,
    order: string | null,
    search: string | null,
    all = false
  ): Promise<IServerResponse<ITeamMembersViewModel>> => {
    const s = encodeURIComponent(search || '');
    const params = new URLSearchParams({
      index: index.toString(),
      size: size.toString(),
      ...(field && { field }),
      ...(order && { order }),
      ...(s && { search: s }),
      ...(all && { all: all.toString() }),
    });
    const response = await apiClient.get<IServerResponse<ITeamMembersViewModel>>(
      `${rootUrl}?${params}`
    );
    return response.data;
  },

  getById: async (id: string): Promise<IServerResponse<ITeamMemberViewModel>> => {
    const response = await apiClient.get<IServerResponse<ITeamMemberViewModel>>(`${rootUrl}/${id}`);
    return response.data;
  },

  getAll: async (
    projectId: string | null = null
  ): Promise<IServerResponse<ITeamMemberViewModel[]>> => {
    const params = new URLSearchParams(projectId ? { project: projectId } : {});
    const response = await apiClient.get<IServerResponse<ITeamMemberViewModel[]>>(
      `${rootUrl}/all${params.toString() ? '?' + params.toString() : ''}`
    );
    return response.data;
  },

  update: async (id: string, body: ITeamMemberCreateRequest): Promise<IServerResponse<any>> => {
    const response = await apiClient.put<IServerResponse<any>>(`${rootUrl}/${id}`, body);
    return response.data;
  },

  updateMemberName: async (id: string, name: string): Promise<IServerResponse<any>> => {
    const response = await apiClient.put<IServerResponse<any>>(`${rootUrl}/${id}/name`, { name });
    return response.data;
  },

  delete: async (id: string): Promise<IServerResponse<any>> => {
    const response = await apiClient.delete<IServerResponse<any>>(`${rootUrl}/${id}`);
    return response.data;
  },

  getTeamMembersByProjectId: async (projectId: string): Promise<IServerResponse<any[]>> => {
    const response = await apiClient.get<IServerResponse<any[]>>(`${rootUrl}/project/${projectId}`);
    return response.data;
  },

  resendInvitation: async (id: string): Promise<IServerResponse<any>> => {
    const response = await apiClient.put<IServerResponse<any>>(`${rootUrl}/resend-invitation`, {
      id,
    });
    return response.data;
  },

  toggleMemberActiveStatus: async (
    id: string,
    active: boolean,
    email: string
  ): Promise<IServerResponse<any>> => {
    const params = new URLSearchParams({
      active: active.toString(),
      email,
    });
    const response = await apiClient.get<IServerResponse<any>>(
      `${rootUrl}/deactivate/${id}?${params}`
    );
    return response.data;
  },

  addTeamMember: async (
    id: string,
    body: ITeamMemberCreateRequest
  ): Promise<IServerResponse<any>> => {
    const response = await apiClient.put<IServerResponse<any>>(`${rootUrl}/add-member/${id}`, body);
    return response.data;
  },

  // Team invitation link methods
  generateInvitationLink: async (body: {
    job_title_id?: string;
    role_name?: string;
    is_admin?: boolean;
    max_usage?: number | null;
  }): Promise<
    IServerResponse<{
      id: string;
      token: string;
      invitation_url: string;
      expires_at: string;
      expires_in_days: number;
      created_at: string;
    }>
  > => {
    const response = await apiClient.post<IServerResponse<any>>(`${rootUrl}/invitation-link`, body);
    return response.data;
  },

  getInvitationLinkStatus: async (): Promise<
    IServerResponse<{
      has_active_link: boolean;
      invitation_url?: string;
      expires_at?: string;
      usage_count?: number;
      max_usage?: number | null;
      created_at?: string;
    }>
  > => {
    const response = await apiClient.get<IServerResponse<any>>(`${rootUrl}/invitation-link/status`);
    return response.data;
  },

  revokeInvitationLink: async (): Promise<IServerResponse<any>> => {
    const response = await apiClient.put<IServerResponse<any>>(
      `${rootUrl}/invitation-link/revoke`,
      {}
    );
    return response.data;
  },

  validateInvitationLink: async (
    token: string
  ): Promise<
    IServerResponse<{
      team: {
        id: string;
        name: string;
        owner_name: string;
      };
      invitation: {
        expires_at: string;
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