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
  projects: { id: string; name: string; color_code: string | null; project_type: string; has_sprints: boolean }[];
  sprints: { id: string; name: string; sprint_status: string }[];
  members: { id: string; name: string }[];
  statuses: { name: string; color: string | null }[];
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

export interface VelocitySprint {
  sprint_id: string;
  name: string;
  sprint_status: 'active' | 'completed';
  committed: number | null;
  completed: number;
  start_date: string | null;
  end_date: string | null;
  completion_rate: number | null;
}

export interface VelocityResponse {
  metric: 'story_points' | 'issue_count';
  sprints: VelocitySprint[];
  average_velocity: number | null;
  completed_sprint_count: number;
  best_sprint: { name: string; completed: number } | null;
  worst_sprint: { name: string; completed: number } | null;
  commitment_accuracy: number | null;
}

export interface FlowBand {
  id: string;
  name: string;
  color: string;
  category: 'todo' | 'doing' | 'done';
}

export interface CumulativeFlowResponse {
  scope: ProgressScope;
  start_date: string;
  end_date: string;
  bands: FlowBand[];
  /** counts is null for days that have not happened yet. */
  series: { date: string; counts: Record<string, number> | null }[];
  summary: { total: number; in_progress: number; done: number; throughput_per_day: number; added: number; avg_cycle_days: number | null };
}

export interface TimeInStatusTask {
  id: string;
  name: string;
  task_key: string | null;
  project_id: string;
  project_name: string;
  project_color: string;
  status_name: string;
  status_color: string;
  hours_in_status: number;
  hours_overdue: number | null;
  assignees: TimeInStatusAssignee[];
  updated_at: string;
}

export interface TimeInStatusAssignee {
  id: string;
  name: string;
  avatar_url: string | null;
}

export type TimeInStatusGroupBy = 'project' | 'status' | 'assignee';

export interface TimeInStatusGroup {
  group_id: string;
  group_name: string;
  group_color: string;
  task_count: number;
  avg_hours: number;
  overdue_count: number;
  tasks: TimeInStatusTask[];
}

export interface TimeInStatusTasksResponse {
  tasks: TimeInStatusTask[];
  total: number;
}

export interface TimeInStatusGroupsResponse {
  groups: TimeInStatusGroup[];
  truncated: boolean;
}

export interface TimeInStatusTaskArgs extends GetFlowArgs {
  search?: string;
  statuses?: string[];
  field?: string;
  order?: 'asc' | 'desc';
  index?: number;
  size?: number;
  groupBy?: TimeInStatusGroupBy;
}

export interface TimeInStatusResponse {
  scope: ProgressScope;
  start_date: string;
  end_date: string;
  rows: { band: FlowBand; task_count: number; avg_hours: number; median_hours: number; total_hours: number }[];
  avg_hours_overall: number;
}

export interface GetFlowArgs {
  config?: OverviewWidgetConfig;
  includeArchived?: boolean;
  dateRange?: { from: string; to: string } | null;
  /** Time in Status: only tasks assigned to any of these team members. */
  assigneeIds?: string[];
  /** Time in Status: restrict to these projects (team scope). */
  projectIds?: string[];
}

const buildFlowParams = ({ config: widgetConfig, includeArchived, dateRange, assigneeIds, projectIds }: GetFlowArgs): Record<string, string> => {
  const scope = widgetConfig?.progressScope ?? 'team';
  const params: Record<string, string> = {
    scope,
    includeSubtasks: String(widgetConfig?.includeSubtasks ?? false),
    archived: String(widgetConfig?.includeArchived ?? includeArchived ?? false),
  };
  if (scope === 'project' && widgetConfig?.projectId) params.projectId = widgetConfig.projectId;
  if (assigneeIds?.length) params.assigneeIds = assigneeIds.join(',');
  if (projectIds?.length) params.projectIds = projectIds.join(',');
  if (dateRange) {
    params.dateFrom = dateRange.from;
    params.dateTo = dateRange.to;
  }
  return params;
};

const buildTaskParams = (args: TimeInStatusTaskArgs, grouped: boolean): Record<string, string> => {
  const params = buildFlowParams(args);
  if (args.search) params.search = args.search;
  if (args.statuses?.length) params.statuses = args.statuses.join(',');
  if (args.field) params.field = args.field;
  if (args.order) params.order = args.order;
  if (grouped) {
    params.group_by = args.groupBy ?? 'project';
  } else {
    params.index = String(args.index ?? 1);
    params.size = String(args.size ?? 10);
  }
  return params;
};

const buildVelocityParams = (widgetConfig?: OverviewWidgetConfig): Record<string, string> => {
  const params: Record<string, string> = {
    metric: widgetConfig?.progressMetric === 'issue_count' ? 'issue_count' : 'story_points',
    includeSubtasks: String(widgetConfig?.includeSubtasks ?? false),
  };
  if (widgetConfig?.projectId) params.projectId = widgetConfig.projectId;
  if (widgetConfig?.sprintCount) params.sprintCount = String(widgetConfig.sprintCount);
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
    getProgressChartOptions: builder.query<
      IServerResponse<ProgressChartOptionsResponse>,
      { projectId?: string; includeArchived?: boolean }
    >({
      query: ({ projectId, includeArchived }) => {
        const params: Record<string, string> = {};
        if (projectId) params.projectId = projectId;
        if (includeArchived) params.archived = 'true';
        return { url: '/reporting/projects/widgets/progress-chart/options', params };
      },
    }),
    getVelocity: builder.query<IServerResponse<VelocityResponse>, { config?: OverviewWidgetConfig }>({
      query: ({ config: widgetConfig }) => ({ url: '/reporting/projects/widgets/velocity', params: buildVelocityParams(widgetConfig) }),
    }),
    getCumulativeFlow: builder.query<IServerResponse<CumulativeFlowResponse>, GetFlowArgs>({
      query: args => ({ url: '/reporting/projects/widgets/cumulative-flow', params: buildFlowParams(args) }),
    }),
    getTimeInStatus: builder.query<IServerResponse<TimeInStatusResponse>, GetFlowArgs>({
      query: args => ({ url: '/reporting/projects/widgets/time-in-status', params: buildFlowParams(args) }),
    }),
    getTimeInStatusTasks: builder.query<IServerResponse<TimeInStatusTasksResponse>, TimeInStatusTaskArgs>({
      query: args => ({ url: '/reporting/projects/widgets/time-in-status/tasks', params: buildTaskParams(args, false) }),
    }),
    getTimeInStatusGroups: builder.query<IServerResponse<TimeInStatusGroupsResponse>, TimeInStatusTaskArgs>({
      query: args => ({ url: '/reporting/projects/widgets/time-in-status/groups', params: buildTaskParams(args, true) }),
    }),
  }),
});

export const {
  useGetProgressChartQuery,
  useGetProgressChartOptionsQuery,
  useGetVelocityQuery,
  useGetCumulativeFlowQuery,
  useGetTimeInStatusQuery,
  useGetTimeInStatusTasksQuery,
  useGetTimeInStatusGroupsQuery,
} = progressChartApi;

export default progressChartApi;
