import apiClient from '@api/api-client';
import { API_BASE_URL } from '@/shared/constants';
import { IServerResponse } from '@/types/common.types';

const rootUrl = `${API_BASE_URL}/teams-webhooks`;

export interface ITeamsWebhook {
  id: string;
  project_id: string;
  name: string;
  notification_types: string[];
  is_active: boolean;
  last_sent_at: string | null;
  last_error: string | null;
  created_at: string;
}

export interface ICreateTeamsWebhook {
  projectId: string;
  name: string;
  webhookUrl: string;
  notificationTypes: string[];
}

export const teamsWebhooksApiService = {
  getProjectWebhooks: async (projectId: string): Promise<IServerResponse<ITeamsWebhook[]>> => {
    const response = await apiClient.get<IServerResponse<ITeamsWebhook[]>>(
      `${rootUrl}/project/${projectId}`
    );
    return response.data;
  },

  createWebhook: async (data: ICreateTeamsWebhook): Promise<IServerResponse<ITeamsWebhook>> => {
    const response = await apiClient.post<IServerResponse<ITeamsWebhook>>(rootUrl, data);
    return response.data;
  },

  updateWebhook: async (
    id: string,
    data: { name?: string; notificationTypes?: string[]; isActive?: boolean }
  ): Promise<IServerResponse<ITeamsWebhook>> => {
    const response = await apiClient.patch<IServerResponse<ITeamsWebhook>>(`${rootUrl}/${id}`, data);
    return response.data;
  },

  deleteWebhook: async (id: string): Promise<void> => {
    await apiClient.delete(`${rootUrl}/${id}`);
  },

  sendTest: async (id: string): Promise<IServerResponse<null>> => {
    const response = await apiClient.post<IServerResponse<null>>(`${rootUrl}/${id}/test`);
    return response.data;
  },
};
