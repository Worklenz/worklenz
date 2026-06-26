import { IServerResponse } from '@/types/common/server-response.types';
import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQueryWithReauth } from '@/api/common/auth.api';

export interface IActivityLog {
  description: string;
  project_name: string;
  created_at: string;
  project_id: string | null;
  project_deleted: boolean;
}

export const activityLogsApi = createApi({
  reducerPath: 'activityLogsApi',
  baseQuery: baseQueryWithReauth,
  tagTypes: ['ActivityLogs'],
  endpoints: builder => ({
    getActivityLogs: builder.query<IServerResponse<IActivityLog[]>, void>({
      query: () => ({
        url: '/api/logs/my-dashboard',
        method: 'GET',
      }),
      providesTags: ['ActivityLogs'],
    }),
  }),
});

export const { useGetActivityLogsQuery } = activityLogsApi;
