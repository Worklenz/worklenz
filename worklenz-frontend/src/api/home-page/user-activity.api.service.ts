import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { API_BASE_URL } from '@/shared/constants';
import { getCsrfToken } from '../api-client';
import { IUserRecentTask, IUserTimeLoggedTask } from '@/types/home/user-activity.types';
import { IServerResponse } from '@/types/common.types';
import config from '@/config/env';

const rootUrl = '/logs';

export const userActivityApiService = createApi({
  reducerPath: 'userActivityApi',
  baseQuery: fetchBaseQuery({
    baseUrl: `${config.apiUrl}${API_BASE_URL}`,
    prepareHeaders: headers => {
      headers.set('X-CSRF-Token', getCsrfToken() || '');
      headers.set('Content-Type', 'application/json');
      return headers;
    },
    credentials: 'include',
  }),
  tagTypes: ['UserRecentTasks', 'UserTimeLoggedTasks'],
  endpoints: builder => ({
    getUserRecentTasks: builder.query<IUserRecentTask[], { limit?: number; offset?: number }>({
      query: ({ limit = 10, offset = 0 }) => ({
        url: `${rootUrl}/user-recent-tasks`,
        params: { limit, offset },
        method: 'GET',
      }),
      providesTags: ['UserRecentTasks'],
    }),
    getUserTimeLoggedTasks: builder.query<
      IUserTimeLoggedTask[],
      { limit?: number; offset?: number; period?: 'today' | 'week'; time_zone?: string }
    >({
      query: ({ limit = 10, offset = 0, period, time_zone }) => ({
        url: `${rootUrl}/user-time-logged-tasks`,
        params: { limit, offset, period, time_zone },
        method: 'GET',
      }),
      providesTags: ['UserTimeLoggedTasks'],
    }),
    getUserTimeLoggedSummary: builder.query<
      IServerResponse<{ billable_seconds: number; non_billable_seconds: number }>,
      { period?: 'today' | 'week'; time_zone?: string }
    >({
      query: ({ period, time_zone }) => ({
        url: `${rootUrl}/user-time-logged-summary`,
        params: { period, time_zone },
        method: 'GET',
      }),
      providesTags: ['UserTimeLoggedTasks'],
    }),
  }),
});

export const { useGetUserRecentTasksQuery, useGetUserTimeLoggedTasksQuery, useGetUserTimeLoggedSummaryQuery } =
  userActivityApiService;
