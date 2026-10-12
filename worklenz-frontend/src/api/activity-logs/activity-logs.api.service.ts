import { IServerResponse } from '@/types/common.types';
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { API_BASE_URL } from '@/shared/constants';
import { getCsrfToken } from '@/api/api-client';
import config from '@/config/env';

export interface IActivityLog {
  description: string;
  project_name: string;
  created_at: string;
  project_id: string | null;
  project_deleted: boolean;
}

export const activityLogsApi = createApi({
  reducerPath: 'activityLogsApi',
  baseQuery: fetchBaseQuery({
    baseUrl: `${config.apiUrl}${API_BASE_URL}`,
    prepareHeaders: headers => {
      headers.set('X-CSRF-Token', getCsrfToken() || '');
      headers.set('Content-Type', 'application/json');
      return headers;
    },
    credentials: 'include',
  }),
  tagTypes: ['ActivityLogs'],
  endpoints: builder => ({
    getActivityLogs: builder.query<IServerResponse<IActivityLog[]>, void>({
      query: () => ({
        url: '/logs/my-dashboard',
        method: 'GET',
      }),
      providesTags: ['ActivityLogs'],
    }),
  }),
});

export const { useGetActivityLogsQuery } = activityLogsApi;
