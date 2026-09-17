import apiClient from '@/api/api-client';
import { API_BASE_URL } from '@/shared/constants';

export interface DiscordConfig {
  id: string;
  project_id: string | null;
  guild_id: string | null;
  notification_types: string[];
  is_active: boolean;
  webhook_configured: boolean;
}

export interface DiscordMapping {
  id: string;
  discord_user_id: string;
  user_id: string;
  team_member_id: string;
  name: string;
}

const rootUrl = `${API_BASE_URL}/discord`;

export const discordApiService = {
  getConfig: async () => (await apiClient.get<{ body: DiscordConfig | null }>(`${rootUrl}/config`)).data.body,
  saveConfig: async (data: { webhookUrl: string; guildId: string; notificationTypes: string[] }) =>
    apiClient.put(`${rootUrl}/config`, data),
  deleteConfig: async () => apiClient.delete(`${rootUrl}/config`),
  getMappings: async () => (await apiClient.get<{ body: DiscordMapping[] }>(`${rootUrl}/mappings`)).data.body,
  saveMapping: async (data: { discordUserId: string; userId: string; teamMemberId: string }) =>
    apiClient.post(`${rootUrl}/mappings`, data),
  deleteMapping: async (id: string) => apiClient.delete(`${rootUrl}/mappings/${id}`),
};
