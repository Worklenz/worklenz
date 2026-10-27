import apiClient from '@api/api-client';
import { API_BASE_URL } from '@/shared/constants';
import { IServerResponse } from '@/types/common.types';
import { toQueryString } from '@/utils/toQueryString';
import type {
  TimeReportFilters,
  TimeReportSeriesResponse,
} from '@/types/reporting/analytics-time-report.types';

const rootUrl = `${API_BASE_URL}/reporting/analytics`;

const filtersToQuery = (filters: TimeReportFilters): Record<string, unknown> => ({
  project_ids: filters.project_ids?.join(','),
  member_ids: filters.member_ids?.join(','),
  team_ids: filters.team_ids?.join(','),
  date_from: filters.date_from ?? undefined,
  date_to: filters.date_to ?? undefined,
});

export const analyticsTimeReportApiService = {
  getSeries: async (
    filters: TimeReportFilters
  ): Promise<IServerResponse<TimeReportSeriesResponse>> => {
    const q = toQueryString(filtersToQuery(filters));
    const response = await apiClient.get<IServerResponse<TimeReportSeriesResponse>>(
      `${rootUrl}/time-report/series${q}`
    );
    return response.data;
  },

  exportCsv: async (filters: TimeReportFilters): Promise<Blob> => {
    const response = await apiClient.post(
      `${rootUrl}/time-report/export/csv`,
      {
        project_ids: filters.project_ids,
        member_ids: filters.member_ids,
        team_ids: filters.team_ids,
        date_from: filters.date_from,
        date_to: filters.date_to,
      },
      { responseType: 'blob' }
    );
    return response.data as Blob;
  },
};
