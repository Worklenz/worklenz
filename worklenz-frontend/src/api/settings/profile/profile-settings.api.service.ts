import apiClient from '@api/api-client';
import { API_BASE_URL } from '@/shared/constants';
import { IServerResponse } from '@/types/common.types';
import { IProfileSettings } from '@/types/settings/profile.types';
import { INotificationSettings } from '@/types/settings/notifications.types';
import {
  IAccountSetupRequest,
  IAccountSetupResponse,
} from '@/types/project-templates/project-templates.types';
import { ITeam } from '@/types/teams/team.type';

const rootUrl = `${API_BASE_URL}/settings`;

export const profileSettingsApiService = {
  getProfile: async (): Promise<IServerResponse<IProfileSettings>> => {
    const response = await apiClient.get<IServerResponse<IProfileSettings>>(`${rootUrl}/profile`);
    return response.data;
  },

  updateProfile: async (body: IProfileSettings): Promise<IServerResponse<IProfileSettings>> => {
    const response = await apiClient.put<IServerResponse<IProfileSettings>>(
      `${rootUrl}/profile`,
      body
    );
    return response.data;
  },

  getNotificationSettings: async (): Promise<IServerResponse<INotificationSettings>> => {
    const response = await apiClient.get<IServerResponse<INotificationSettings>>(
      `${rootUrl}/notifications`
    );
    return response.data;
  },

  updateNotificationSettings: async (
    body: INotificationSettings
  ): Promise<IServerResponse<INotificationSettings>> => {
    const response = await apiClient.put<IServerResponse<INotificationSettings>>(
      `${rootUrl}/notifications`,
      body
    );
    return response.data;
  },

  setupAccount: async (
    body: IAccountSetupRequest
  ): Promise<IServerResponse<IAccountSetupResponse>> => {
    const response = await apiClient.post<IServerResponse<IAccountSetupResponse>>(
      `${rootUrl}/setup`,
      body
    );
    return response.data;
  },

  updateTeamName: async (id: string, body: ITeam): Promise<IServerResponse<ITeam>> => {
    const response = await apiClient.put<IServerResponse<ITeam>>(
      `${rootUrl}/team-name/${id}`,
      body
    );
    return response.data;
  },

  changePassword: async (body: {
    new_password: string;
    confirm_password: string;
    password: string;
  }): Promise<IServerResponse<any>> => {
    const response = await apiClient.post<IServerResponse<any>>(
      `${API_BASE_URL}/change-password`,
      body
    );
    return response.data;
  },

  // Client Portal Settings
  getClientPortalSettings: async (): Promise<IServerResponse<any>> => {
    const response = await apiClient.get<IServerResponse<any>>(`${rootUrl}/client-portal`);
    return response.data;
  },

  updateClientPortalSettings: async (body: any): Promise<IServerResponse<any>> => {
    const response = await apiClient.put<IServerResponse<any>>(`${rootUrl}/client-portal`, body);
    return response.data;
  },

  uploadClientPortalLogo: async (
    logoData: string
  ): Promise<IServerResponse<{ logo_url: string }>> => {
    const response = await apiClient.post<IServerResponse<{ logo_url: string }>>(
      `${rootUrl}/client-portal/upload-logo`,
      { logoData }
    );
    return response.data;
  },
};
