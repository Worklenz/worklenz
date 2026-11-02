import apiClient from '@api/api-client';
import { API_BASE_URL } from '@/shared/constants';
import { IServerResponse } from '@/types/common.types';
import { toQueryString } from '@/utils/toQueryString';
import type {
  TimeInStatusFilterOptions,
  TimeInStatusFilters,
  TimeInStatusSeriesResponse,
} from '@/types/reporting/analytics-time-in-status.types';

const rootUrl = `${API_BASE_URL}/reporting/analytics`;

const filtersToQuery = (filters: TimeInStatusFilters): Record<string, unknown> => ({
  project_ids: filters.project_ids?.join(','),
  team_ids: filters.team_ids?.join(','),
  status_ids: filters.status_ids?.join(','),
  assignee_ids: filters.assignee_ids?.join(','),
  issue_types: filters.issue_types?.join(','),
  label_ids: filters.label_ids?.join(','),
  epic_ids: filters.epic_ids?.join(','),
  sprint_ids: filters.sprint_ids?.join(','),
  date_from: filters.date_from || undefined,
  date_to: filters.date_to || undefined,
  date_mode: filters.date_mode,
  exclude_weekends: filters.exclude_weekends ? 'true' : 'false',
  view_mode: filters.view_mode,
  sort: filters.sort,
  limit: filters.limit,
  offset: filters.offset,
});

const filtersToBody = (filters: TimeInStatusFilters): Record<string, unknown> => ({
  ...filtersToQuery(filters),
  project_ids: filters.project_ids,
  team_ids: filters.team_ids,
  status_ids: filters.status_ids,
  assignee_ids: filters.assignee_ids,
  issue_types: filters.issue_types,
  label_ids: filters.label_ids,
  epic_ids: filters.epic_ids,
  sprint_ids: filters.sprint_ids,
});

export const analyticsTimeInStatusApiService = {
  getSeries: async (
    filters: TimeInStatusFilters
  ): Promise<IServerResponse<TimeInStatusSeriesResponse>> => {
    const q = toQueryString(filtersToQuery(filters));
    const response = await apiClient.get<IServerResponse<TimeInStatusSeriesResponse>>(
      `${rootUrl}/time-in-status/series${q}`
    );
    return response.data;
  },

  getFilterOptions: async (
    filters: Pick<TimeInStatusFilters, 'project_ids' | 'team_ids'>
  ): Promise<IServerResponse<TimeInStatusFilterOptions>> => {
    const q = toQueryString({
      project_ids: filters.project_ids?.join(','),
      team_ids: filters.team_ids?.join(','),
    });
    const response = await apiClient.get<IServerResponse<TimeInStatusFilterOptions>>(
      `${rootUrl}/time-in-status/filter-options${q}`
    );
    return response.data;
  },

  exportCsv: async (filters: TimeInStatusFilters): Promise<Blob> => {
    const response = await apiClient.post(
      `${rootUrl}/time-in-status/export/csv`,
      filtersToBody(filters),
      { responseType: 'blob' }
    );
    return response.data as Blob;
  },
};
