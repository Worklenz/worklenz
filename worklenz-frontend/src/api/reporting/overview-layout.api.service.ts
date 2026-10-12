import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { API_BASE_URL } from '@/shared/constants';
import { IServerResponse } from '@/types/common.types';
import { getCsrfToken, ensureCsrfToken } from '../api-client';
import config from '@/config/env';
import type { GridLayout } from '@/components/dashboard-grid';

const rootUrl = '/reporting/overview/layout';

/** Known Reports > Overview widget keys, mirroring the backend's reporting-overview-layout.service.ts. */
export type OverviewWidgetKey =
  | 'kpi_teams'
  | 'kpi_projects'
  | 'kpi_members'
  | 'teams_table'
  | 'kpi_active_projects'
  | 'kpi_overdue_projects'
  | 'kpi_unassigned_members'
  | 'kpi_members_with_overdue_tasks';

export type OverviewLayout = GridLayout<OverviewWidgetKey>;

export interface OverviewLayoutResponse {
  layout: OverviewLayout | null;
}

const overviewLayoutApi = createApi({
  reducerPath: 'overviewLayoutApi',
  baseQuery: fetchBaseQuery({
    baseUrl: `${config.apiUrl}${API_BASE_URL}`,
    prepareHeaders: async headers => {
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
  tagTypes: ['OverviewLayout'],
  endpoints: builder => ({
    getOverviewLayout: builder.query<IServerResponse<OverviewLayoutResponse>, void>({
      query: () => rootUrl,
      providesTags: ['OverviewLayout'],
    }),

    // Optimistic: the grid already shows the new layout, so the cache follows it and rolls back on failure.
    saveOverviewLayout: builder.mutation<IServerResponse<OverviewLayoutResponse>, OverviewLayout>({
      query: layout => ({ url: rootUrl, method: 'PUT', body: { layout } }),
      async onQueryStarted(layout, { dispatch, queryFulfilled }) {
        const patch = dispatch(
          overviewLayoutApi.util.updateQueryData('getOverviewLayout', undefined, draft => {
            if (draft.body) draft.body.layout = layout;
          })
        );
        try {
          await queryFulfilled;
        } catch {
          patch.undo();
        }
      },
      invalidatesTags: ['OverviewLayout'],
    }),

    resetOverviewLayout: builder.mutation<IServerResponse<OverviewLayoutResponse>, void>({
      query: () => ({ url: rootUrl, method: 'DELETE' }),
      invalidatesTags: ['OverviewLayout'],
    }),
  }),
});

export const { useGetOverviewLayoutQuery, useSaveOverviewLayoutMutation, useResetOverviewLayoutMutation } = overviewLayoutApi;

export default overviewLayoutApi;
