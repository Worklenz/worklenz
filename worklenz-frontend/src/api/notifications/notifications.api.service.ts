import apiClient from '@api/api-client';
import { API_BASE_URL } from '@/shared/constants';
import { IServerResponse } from '@/types/common.types';
import { toQueryString } from '@/utils/toQueryString';

import { IMyTask } from '@/types/home/my-tasks.types';
import { IWorklenzNotification } from '@/types/notifications/notifications.types';

const rootUrl = `${API_BASE_URL}/notifications`;

export const notificationsApiService = {
  getNotifications: async (filter: string): Promise<IServerResponse<IWorklenzNotification[]>> => {
    const q = toQueryString({ filter });
    const response = await apiClient.get<IServerResponse<IWorklenzNotification[]>>(
      `${rootUrl}${q}`
    );
    return response.data;
  },

  updateNotification: async (id: string): Promise<IServerResponse<any>> => {
    const response = await apiClient.put<IServerResponse<any>>(`${rootUrl}/${id}`);
    return response.data;
  },

  readAllNotifications: async (): Promise<IServerResponse<any>> => {
    const response = await apiClient.put<IServerResponse<any>>(`${rootUrl}/read-all`);
    return response.data;
  },

  getUnreadCount: async (): Promise<IServerResponse<number>> => {
    const response = await apiClient.get<IServerResponse<number>>(`${rootUrl}/unread-count`);
    return response.data;
  },
};
