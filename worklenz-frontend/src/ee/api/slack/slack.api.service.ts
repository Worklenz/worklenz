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
  projectId: string;
  projectName: string;
  slackChannelId: string;
  slackChannelName: string;
  notificationTypes: string[];
  isActive: boolean;
}

export interface ISlackStatusResponse {
  connected: boolean;
  workspace?: {
    id: string;
    name: string;
    team_id: string;
    is_active: boolean;
  };
}

export interface ISlackInstallUrlResponse {
  url: string;
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
  // Connection status and setup
  getStatus: async (): Promise<ISlackStatusResponse> => {
    const response = await apiClient.get<ISlackStatusResponse>(`${rootUrl}/status`);
    return response.data;
  },

  getInstallUrl: async (): Promise<ISlackInstallUrlResponse> => {
    const response = await apiClient.get<ISlackInstallUrlResponse>(`${rootUrl}/install-url`);
    return response.data;
  },

  disconnect: async (): Promise<void> => {
    await apiClient.delete(`${rootUrl}/disconnect`);
  },

  // Workspace operations (legacy - kept for backward compatibility)
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

  disconnectWorkspace: async (workspaceId: string): Promise<IServerResponse<void>> => {
    const response = await apiClient.delete<IServerResponse<void>>(
      `${rootUrl}/workspace/${workspaceId}`
    );
    return response.data;
  },

  // Channel operations
  getAvailableChannels: async (): Promise<ISlackChannel[]> => {
    const response = await apiClient.get<ISlackChannel[]>(`${rootUrl}/channels`);
    return response.data;
  },

  syncChannels: async (
    workspaceId: string,
    channels: Array<{ id: string; name: string; is_private?: boolean; is_archived?: boolean }>
  ): Promise<IServerResponse<void>> => {
    const response = await apiClient.post<IServerResponse<void>>(
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

  // Channel operations
  refreshChannels: async (): Promise<IServerResponse<ISlackChannel[]>> => {
    const response = await apiClient.post<IServerResponse<ISlackChannel[]>>(
      `${rootUrl}/channels/refresh`
    );
    return response.data;
  },

  // Channel configuration operations
  getAllChannelConfigs: async (): Promise<ISlackChannelConfig[]> => {
    const response = await apiClient.get<ISlackChannelConfig[]>(`${rootUrl}/channel-configs`);
    return response.data;
  },

  createChannelConfig: async (data: {
    projectId: string;
    slackChannelId: string;
    notificationTypes: string[];
    autoJoin?: boolean;
  }): Promise<ISlackChannelConfig> => {
    const response = await apiClient.post<IServerResponse<ISlackChannelConfig>>(
      `${rootUrl}/channel-configs`,
      data
    );
    // Check if the response indicates success
    if (response.data && response.data.done && response.data.body) {
      return response.data.body;
    }
    // If done is false, throw an error with the message
    throw new Error(response.data?.message || 'Failed to create channel configuration');
  },

  updateChannelConfig: async (configId: string, data: { isActive: boolean }): Promise<void> => {
    await apiClient.patch(`${rootUrl}/channel-configs/${configId}`, data);
  },

  deleteChannelConfig: async (configId: string): Promise<void> => {
    await apiClient.delete(`${rootUrl}/channel-configs/${configId}`);
  },

  reactivateChannelConfig: async (configId: string): Promise<void> => {
    await apiClient.post(`${rootUrl}/channel-configs/${configId}/reactivate`);
  },

  getProjectChannelConfigs: async (
    projectId: string
  ): Promise<IServerResponse<ISlackChannelConfig[]>> => {
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

  // Test notification
  sendTestNotification: async (
    configId: string,
    message?: unknown
  ): Promise<IServerResponse<void>> => {
    const response = await apiClient.post<IServerResponse<void>>(
      `${rootUrl}/test-notification/${configId}`,
      { message }
    );
    return response.data;
  },

  // Channel joining operations
  joinChannel: async (
    workspaceId: string,
    channelId: string
  ): Promise<
    IServerResponse<{
      success: boolean;
      message: string;
      alreadyInChannel?: boolean;
    }>
  > => {
    const response = await apiClient.post<
      IServerResponse<{
        success: boolean;
        message: string;
        alreadyInChannel?: boolean;
      }>
    >(`${rootUrl}/channels/join`, { workspaceId, channelId });
    return response.data;
  },

  autoJoinPublicChannels: async (
    workspaceId: string
  ): Promise<
    IServerResponse<{
      joinedCount: number;
      failedCount: number;
      results: Array<{ channelName: string; success: boolean; message: string }>;
    }>
  > => {
    const response = await apiClient.post<
      IServerResponse<{
        joinedCount: number;
        failedCount: number;
        results: Array<{ channelName: string; success: boolean; message: string }>;
      }>
    >(`${rootUrl}/workspace/${workspaceId}/channels/auto-join`);
    return response.data;
  },
};
