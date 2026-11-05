import apiClient from '@api/api-client';
import { API_BASE_URL } from '@/shared/constants';
import { IServerResponse } from '@/types/common.types';
import type {
  TimeReportFilters,
  TimeReportSeriesResponse,
} from '@/types/reporting/analytics-time-report.types';

const rootUrl = `${API_BASE_URL}/reporting/analytics`;

const filtersToBody = (filters: TimeReportFilters) => ({
  project_ids: filters.project_ids,
  member_ids: filters.member_ids,
  team_ids: filters.team_ids,
  date_from: filters.date_from,
  date_to: filters.date_to,
});

export const analyticsTimeReportApiService = {
  getSeries: async (
    filters: TimeReportFilters
  ): Promise<IServerResponse<TimeReportSeriesResponse>> => {
    const response = await apiClient.post<IServerResponse<TimeReportSeriesResponse>>(
      `${rootUrl}/time-report/series`,
      filtersToBody(filters)
    );
    return response.data;
  },

  exportCsv: async (filters: TimeReportFilters): Promise<Blob> => {
    const response = await apiClient.post(
      `${rootUrl}/time-report/export/csv`,
      filtersToBody(filters),
      { responseType: 'blob' }
    );
    return response.data as Blob;
  },
};
