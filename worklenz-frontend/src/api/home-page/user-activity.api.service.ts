import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { API_BASE_URL } from '@/shared/constants';
import { getCsrfToken } from '../api-client';
import { IUserRecentTask, IUserTimeLoggedTask } from '@/types/home/user-activity.types';
import config from '@/config/env';

const rootUrl = '/logs';

export const userActivityApiService = createApi({
    reducerPath: 'userActivityApi',
    baseQuery: fetchBaseQuery({
        baseUrl: `${config.apiUrl}${API_BASE_URL}`,
        prepareHeaders: (headers) => {
            headers.set('X-CSRF-Token', getCsrfToken() || '');
            headers.set('Content-Type', 'application/json');
            return headers;
        },
        credentials: 'include',
    }),
    tagTypes: ['UserRecentTasks', 'UserTimeLoggedTasks'],
    endpoints: (builder) => ({
        getUserRecentTasks: builder.query<IUserRecentTask[], { limit?: number; offset?: number }>({
            query: ({ limit = 10, offset = 0 }) => ({
                url: `${rootUrl}/user-recent-tasks`,
                params: { limit, offset },
                method: 'GET',
            }),
            providesTags: ['UserRecentTasks'],
        }),
        getUserTimeLoggedTasks: builder.query<IUserTimeLoggedTask[], { limit?: number; offset?: number }>({
            query: ({ limit = 10, offset = 0 }) => ({
                url: `${rootUrl}/user-time-logged-tasks`,
                params: { limit, offset },
                method: 'GET',
            }),
            providesTags: ['UserTimeLoggedTasks'],
        }),
    }),
});

export const {
    useGetUserRecentTasksQuery,
    useGetUserTimeLoggedTasksQuery,
} = userActivityApiService;


