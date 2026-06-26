import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { API_BASE_URL } from '@/shared/constants';
import { IServerResponse } from '@/types/common.types';
import { getCsrfToken, ensureCsrfToken } from '../api-client';
import config from '@/config/env';

const rootUrl = '/personal-overview';

export interface ICompletedTasksTodayResponse {
  total_tasks: number;
  completed_tasks: number;
  percentage: number;
  date: string;
}

const personalOverviewApi = createApi({
  reducerPath: 'personalOverviewApi',
  baseQuery: fetchBaseQuery({
    baseUrl: `${config.apiUrl}${API_BASE_URL}`,
    prepareHeaders: async headers => {
      // Get CSRF token, refresh if needed
      let token = getCsrfToken();
      if (!token) {
        try {
          token = await ensureCsrfToken();
        } catch (error) {
          console.error('[CSRF] Failed to refresh CSRF token:', error);
        }
      }

      if (token) {
        headers.set('X-CSRF-Token', token);
      }
      headers.set('Content-Type', 'application/json');
      return headers;
    },
    credentials: 'include',
  }),
  tagTypes: ['CompletedTasksToday'],
  endpoints: builder => ({
    getCompletedTasksTodayPercentage: builder.query<
      IServerResponse<ICompletedTasksTodayResponse>,
      void
    >({
      query: () => `${rootUrl}/completed-tasks-today-percentage`,
      providesTags: ['CompletedTasksToday'],
    }),
  }),
});

export const { useGetCompletedTasksTodayPercentageQuery } = personalOverviewApi;

export default personalOverviewApi;
