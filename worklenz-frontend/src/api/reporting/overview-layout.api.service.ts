import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { API_BASE_URL } from '@/shared/constants';
import { IServerResponse } from '@/types/common.types';
import { getCsrfToken, ensureCsrfToken } from '../api-client';
import config from '@/config/env';
import type { GridLayout, GridWidgetInstance } from '@/components/dashboard-grid';

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
  | 'kpi_members_with_overdue_tasks'
  | 'project_stats_by_status'
  | 'tasks_by_status'
  | 'time_logged_vs_estimated'
  | 'capacity_vs_logged'
  | 'team_utilization'
  | 'billable_tasks'
  | 'billable_time_logs'
  | 'client_stats'
  | 'project_health_stats'
  | 'incomplete_tasks_by_project'
  | 'upcoming_tasks'
  | 'overdue_tasks';

/** Per-widget filter selection for the stats widgets. All fields optional: an unset field falls
 *  back to the page-level default (the "Include Archived Projects" checkbox etc). */
export interface OverviewWidgetConfig {
  teams?: string[];
  billable?: 'all' | 'billable' | 'nonBillable';
  includeArchived?: boolean;
  /** Which chart the widget renders its data as. Only meaningful for the chart-based stats
   *  widgets; ignored by table widgets (e.g. Client Stats). Unset falls back to the widget's own
   *  default (donut for the status/breakdown widgets, bar for the comparison widgets). */
  chartType?: 'bar' | 'stacked' | 'line' | 'donut' | 'number';
  /** Grouping dimension for Upcoming Tasks / Overdue Tasks; ignored by every other widget. */
  groupBy?: 'assignee' | 'project';
  /** Hides the chart's data labels (legend). Only meaningful for the chart-based stats widgets. */
  hideDataLabels?: boolean;
  /** Per-series bar/line color overrides (as hex strings), in series order. Only meaningful when
   *  chartType is bar/stacked/line; an unset or short-of-series-count entry falls back to the
   *  widget's own default color for that series. */
  colors?: string[];
}

export type OverviewLayout = GridLayout<OverviewWidgetKey, OverviewWidgetConfig>;

/** A single widget as the backend stores/validates it: `key` instead of the frontend's `type`.
 *  `id` distinguishes instances of a repeatable widget type (e.g. two "Tasks by Status" widgets
 *  with different filters); singleton widgets omit it and `id` falls back to `key`. */
export interface OverviewLayoutWireWidget {
  id?: string;
  key: OverviewWidgetKey;
  x: number;
  y: number;
  w: number;
  h: number;
  hidden: boolean;
  config?: OverviewWidgetConfig;
}

/** The layout shape the backend's reporting-overview-layout.service.ts actually reads/writes. */
export interface OverviewLayoutWire {
  version: 1;
  widgets: OverviewLayoutWireWidget[];
}

export interface OverviewLayoutResponse {
  layout: OverviewLayoutWire | null;
}

/** For a singleton widget `id === type`, so sending `id` is redundant but harmless; for a
 *  repeatable type's instance it is what distinguishes it from its siblings. */
export const toWireLayout = (layout: OverviewLayout): OverviewLayoutWire => ({
  version: layout.version,
  widgets: layout.widgets.map(({ id, type, x, y, w, h, hidden, config }) => ({ id, key: type, x, y, w, h, hidden, config })),
});

export const fromWireLayout = (layout: OverviewLayoutWire | null): OverviewLayout | null =>
  layout && {
    version: layout.version,
    widgets: layout.widgets.map(
      ({ id, key, x, y, w, h, hidden, config }): GridWidgetInstance<OverviewWidgetKey, OverviewWidgetConfig> => ({
        id: id || key,
        type: key,
        x,
        y,
        w,
        h,
        hidden,
        ...(config !== undefined ? { config } : {}),
      })
    ),
  };

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
      query: layout => ({ url: rootUrl, method: 'PUT', body: { layout: toWireLayout(layout) } }),
      async onQueryStarted(layout, { dispatch, queryFulfilled }) {
        const patch = dispatch(
          overviewLayoutApi.util.updateQueryData('getOverviewLayout', undefined, draft => {
            if (draft.body) draft.body.layout = toWireLayout(layout);
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
