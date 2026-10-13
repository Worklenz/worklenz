import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { API_BASE_URL } from '@/shared/constants';
import { IServerResponse } from '@/types/common.types';
import { getCsrfToken, ensureCsrfToken } from '../api-client';
import config from '@/config/env';
import type { OverviewWidgetConfig, OverviewWidgetKey } from './overview-layout.api.service';

/** The subset of Overview widget keys this endpoint can compute data for. */
export type ProjectWidgetType = Extract<
  OverviewWidgetKey,
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
  | 'overdue_tasks'
>;

export interface ProjectStatsByStatusRow {
  status: string;
  color_code: string;
  count: number;
}

export interface TasksByStatusRow {
  todo: number;
  doing: number;
  done: number;
  total: number;
}

export interface TimeLoggedVsEstimatedRow {
  project_id: string;
  project_name: string;
  estimated_hours: number;
  logged_hours: number;
}

export interface CapacityVsLoggedRow {
  team_member_id: string;
  name: string;
  email: string;
  expected_capacity_hours: number;
  logged_hours: number;
}

export interface TeamUtilizationRow extends CapacityVsLoggedRow {
  utilization_percent: number;
}

export interface BillableTaskStats {
  billable: number;
  non_billable: number;
}

export interface BillableTimeLogStats {
  billable_hours: number;
  non_billable_hours: number;
}

export interface ClientStatsRow {
  client_name: string;
  client_id: string | null;
  project_count: number;
  task_count: number;
  logged_hours: number;
}

export interface ProjectHealthStatsRow {
  health: string;
  color_code: string;
  count: number;
}

export interface IncompleteTasksByProjectRow {
  project_id: string;
  project_name: string;
  count: number;
}

/** Shared by Upcoming Tasks and Overdue Tasks: one row per project or per assignee, depending on
 *  the widget's `groupBy` config. */
export interface TaskGroupCountRow {
  group_id: string | null;
  group_name: string | null;
  count: number;
}

export interface ProjectWidgetStatsResponse {
  project_stats_by_status?: ProjectStatsByStatusRow[];
  tasks_by_status?: TasksByStatusRow;
  time_logged_vs_estimated?: TimeLoggedVsEstimatedRow[];
  capacity_vs_logged?: CapacityVsLoggedRow[];
  team_utilization?: TeamUtilizationRow[];
  billable_tasks?: BillableTaskStats;
  billable_time_logs?: BillableTimeLogStats;
  client_stats?: ClientStatsRow[];
  project_health_stats?: ProjectHealthStatsRow[];
  incomplete_tasks_by_project?: IncompleteTasksByProjectRow[];
  upcoming_tasks?: TaskGroupCountRow[];
  overdue_tasks?: TaskGroupCountRow[];
}

export interface GetProjectWidgetStatsArgs {
  widget: ProjectWidgetType;
  config?: OverviewWidgetConfig;
  /** Page-level defaults, used for any field the widget's own config leaves unset. */
  pageDefaults?: Pick<OverviewWidgetConfig, 'includeArchived'>;
  /** The toolbar's date range filter. Page-wide only: widgets no longer have their own override, so there's only ever one range in view. */
  dateRange?: { from: string; to: string } | null;
}

const join = (ids?: string[]) => (ids?.length ? ids.join(',') : undefined);

const buildParams = ({ widget, config, pageDefaults, dateRange }: GetProjectWidgetStatsArgs): Record<string, string> => {
  const params: Record<string, string> = { widgets: widget };
  const teams = join(config?.teams);
  if (teams) params.teams = teams;
  if (dateRange) {
    params.dateFrom = dateRange.from;
    params.dateTo = dateRange.to;
  }
  if (config?.billable) params.billable = config.billable;
  if (config?.groupBy) params.groupBy = config.groupBy;
  const includeArchived = config?.includeArchived ?? pageDefaults?.includeArchived;
  if (includeArchived !== undefined) params.archived = includeArchived ? 'true' : 'false';
  return params;
};

const overviewWidgetsStatsApi = createApi({
  reducerPath: 'overviewWidgetsStatsApi',
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
    getOverviewWidgetStats: builder.query<IServerResponse<ProjectWidgetStatsResponse>, GetProjectWidgetStatsArgs>({
      query: args => ({ url: '/reporting/projects/widgets/stats', params: buildParams(args) }),
    }),
  }),
});

export const { useGetOverviewWidgetStatsQuery } = overviewWidgetsStatsApi;

export default overviewWidgetsStatsApi;
