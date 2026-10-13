import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { API_BASE_URL } from '@/shared/constants';
import { IServerResponse } from '@/types/common.types';
import { getCsrfToken, ensureCsrfToken } from '../api-client';
import config from '@/config/env';
import type {
  OverviewWidgetConfig,
  ProgressMetric,
  ProgressScope,
  ProgressSource,
} from './overview-layout.api.service';

export interface ProgressChartPoint {
  date: string;
  /** null for days that have not happened yet. */
  scope: number | null;
  completed: number | null;
  remaining: number | null;
  ideal_remaining: number;
  ideal_completed: number;
  forecast_remaining: number | null;
}

export interface ProgressChartSummary {
  scope: number;
  completed: number;
  remaining: number;
  scope_change: number;
  velocity_per_day: number;
  projected_finish: string | null;
  on_track: boolean | null;
}

export interface ProgressChartResponse {
  scope: ProgressScope;
  source: ProgressSource;
  metric: ProgressMetric;
  start_date: string;
  end_date: string;
  sprint: { id: string; name: string; sprint_status: string } | null;
  series: ProgressChartPoint[];
  summary: ProgressChartSummary;
  has_estimated_history: boolean;
}

export interface ProgressChartOptionsResponse {
  projects: { id: string; name: string; project_type: string }[];
  sprints: { id: string; name: string; sprint_status: string }[];
}

export interface GetProgressChartArgs {
  config?: OverviewWidgetConfig;
  /** Page-level default for "Include archived projects", used when the widget leaves it unset. */
  includeArchived?: boolean;
  /** The toolbar's date range; only used by the date-range source. */
  dateRange?: { from: string; to: string } | null;
}

const buildParams = ({ config: widgetConfig, includeArchived, dateRange }: GetProgressChartArgs): Record<string, string> => {
  const scope = widgetConfig?.progressScope ?? 'team';
  const source = scope === 'project' ? (widgetConfig?.progressSource ?? 'range') : 'range';
  const params: Record<string, string> = {
    scope,
    source,
    metric: widgetConfig?.progressMetric ?? 'story_points',
    includeSubtasks: String(widgetConfig?.includeSubtasks ?? false),
    forecast: String(widgetConfig?.showForecast ?? true),
    archived: String(widgetConfig?.includeArchived ?? includeArchived ?? false),
  };
  if (scope === 'project' && widgetConfig?.projectId) params.projectId = widgetConfig.projectId;
  if (source === 'sprint' && widgetConfig?.sprintId) params.sprintId = widgetConfig.sprintId;
  if (source === 'range' && dateRange) {
    params.dateFrom = dateRange.from;
    params.dateTo = dateRange.to;
  }
  return params;
};

const progressChartApi = createApi({
  reducerPath: 'progressChartApi',
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
      if (token) headers.set('X-CSRF-Token', token);
      return headers;
    },
    credentials: 'include',
  }),
  endpoints: builder => ({
    getProgressChart: builder.query<IServerResponse<ProgressChartResponse>, GetProgressChartArgs>({
      query: args => ({ url: '/reporting/projects/widgets/progress-chart', params: buildParams(args) }),
    }),
    getProgressChartOptions: builder.query<IServerResponse<ProgressChartOptionsResponse>, { projectId?: string }>({
      query: ({ projectId }) => ({
        url: '/reporting/projects/widgets/progress-chart/options',
        params: projectId ? { projectId } : undefined,
      }),
    }),
  }),
});

export const { useGetProgressChartQuery, useGetProgressChartOptionsQuery } = progressChartApi;

export default progressChartApi;
