import apiClient from '@api/api-client';
import { API_BASE_URL } from '@/shared/constants';
import { IServerResponse } from '@/types/common.types';

const rootUrl = `${API_BASE_URL}/slack`;

export interface ISlackWorkspace {
  id: string;
  organization_id: string;
  team_id: string;
  team_name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ISlackChannel {
  id: string;
  slack_workspace_id: string;
  channel_id: string;
  channel_name: string;
  is_private: boolean;
  is_archived: boolean;
}

export interface ISlackChannelConfig {
  id: string;
  project_id: string;
  slack_channel_id: string;
  notification_types: string[];
  is_active: boolean;
  channel_name?: string;
  slack_channel_identifier?: string;
  workspace_name?: string;
  project_name?: string;
}

export interface ISlackOAuthData {
  team_id: string;
  team_name: string;
  access_token: string;
  bot_user_id?: string;
  bot?: {
    bot_access_token: string;
  };
  scope?: string;
  authed_user?: {
    id: string;
  };
}

export const slackApiService = {
  // Workspace operations
  connectWorkspace: async (data: ISlackOAuthData): Promise<IServerResponse<ISlackWorkspace>> => {
    const response = await apiClient.post<IServerResponse<ISlackWorkspace>>(
      `${rootUrl}/workspace/connect`,
      data
    );
    return response.data;
  },

  getWorkspace: async (): Promise<IServerResponse<ISlackWorkspace | null>> => {
    const response = await apiClient.get<IServerResponse<ISlackWorkspace | null>>(
      `${rootUrl}/workspace`
    );
    return response.data;
  },

  disconnectWorkspace: async (workspaceId: string): Promise<IServerResponse<any>> => {
    const response = await apiClient.delete<IServerResponse<any>>(
      `${rootUrl}/workspace/${workspaceId}`
    );
    return response.data;
  },

  // Channel operations
  syncChannels: async (
    workspaceId: string,
    channels: Array<{ id: string; name: string; is_private?: boolean; is_archived?: boolean }>
  ): Promise<IServerResponse<any>> => {
    const response = await apiClient.post<IServerResponse<any>>(
      `${rootUrl}/workspace/${workspaceId}/channels/sync`,
      { channels }
    );
    return response.data;
  },

  getChannels: async (workspaceId: string): Promise<IServerResponse<ISlackChannel[]>> => {
    const response = await apiClient.get<IServerResponse<ISlackChannel[]>>(
      `${rootUrl}/workspace/${workspaceId}/channels`
    );
    return response.data;
  },

  // Channel configuration operations
  createChannelConfig: async (
    projectId: string,
    slackChannelId: string,
    notificationTypes: string[]
  ): Promise<IServerResponse<ISlackChannelConfig>> => {
    const response = await apiClient.post<IServerResponse<ISlackChannelConfig>>(
      `${rootUrl}/channel-configs`,
      {
        projectId,
        slackChannelId,
        notificationTypes
      }
    );
    return response.data;
  },

  getProjectChannelConfigs: async (projectId: string): Promise<IServerResponse<ISlackChannelConfig[]>> => {
    const response = await apiClient.get<IServerResponse<ISlackChannelConfig[]>>(
      `${rootUrl}/channel-configs/project/${projectId}`
    );
    return response.data;
  },

  getOrganizationChannelConfigs: async (): Promise<IServerResponse<ISlackChannelConfig[]>> => {
    const response = await apiClient.get<IServerResponse<ISlackChannelConfig[]>>(
      `${rootUrl}/channel-configs/organization`
    );
    return response.data;
  },

  deleteChannelConfig: async (configId: string): Promise<IServerResponse<any>> => {
    const response = await apiClient.delete<IServerResponse<any>>(
      `${rootUrl}/channel-configs/${configId}`
    );
    return response.data;
  },

  // Test notification
  sendTestNotification: async (configId: string, message?: any): Promise<IServerResponse<any>> => {
    const response = await apiClient.post<IServerResponse<any>>(
      `${rootUrl}/test-notification/${configId}`,
      { message }
    );
    return response.data;
  }
};
