import { IServerResponse } from '@/types/common.types';
import apiClient from '../api-client';
import {
  IAcceptTeamInvite,
  ITeam,
  ITeamActivateResponse,
  ITeamGetResponse,
  ITeamInvites,
} from '@/types/teams/team.type';
import { API_BASE_URL } from '@/shared/constants';
import { IOrganizationTeam } from '@/types/admin-center/admin-center.types';

const rootUrl = `${API_BASE_URL}/teams`;

export const teamsApiService = {
  getTeams: async (): Promise<IServerResponse<ITeamGetResponse[]>> => {
    const response = await apiClient.get<IServerResponse<ITeamGetResponse[]>>(`${rootUrl}`);
    return response.data;
  },

  setActiveTeam: async (teamId: string): Promise<IServerResponse<ITeamActivateResponse>> => {
    const response = await apiClient.put<IServerResponse<ITeamActivateResponse>>(
      `${rootUrl}/activate`,
      { id: teamId }
    );
    return response.data;
  },

  createTeam: async (team: IOrganizationTeam): Promise<IServerResponse<ITeam>> => {
    const response = await apiClient.post<IServerResponse<ITeam>>(`${rootUrl}`, team);
    return response.data;
  },

  getInvitations: async (): Promise<IServerResponse<ITeamInvites[]>> => {
    const response = await apiClient.get<IServerResponse<ITeamInvites[]>>(`${rootUrl}/invites`);
    return response.data;
  },

  acceptInvitation: async (body: IAcceptTeamInvite): Promise<IServerResponse<ITeamInvites>> => {
    const response = await apiClient.put<IServerResponse<ITeamInvites>>(`${rootUrl}`, body);
    return response.data;
  },
};
