import apiClient from '@api/api-client';
import { API_BASE_URL } from '@/shared/constants';
import { IServerResponse } from '@/types/common.types';
import { toQueryString } from '@/utils/toQueryString';
import type {
  UtilizationFilters,
  UtilizationSeriesResponse,
} from '@/types/reporting/analytics-utilization.types';

const rootUrl = `${API_BASE_URL}/reporting/analytics`;

const filtersToQuery = (filters: UtilizationFilters): Record<string, unknown> => ({
  project_ids: filters.project_ids?.join(','),
  member_ids: filters.member_ids?.join(','),
  team_ids: filters.team_ids?.join(','),
  date_from: filters.date_from ?? undefined,
  date_to: filters.date_to ?? undefined,
});

export const analyticsUtilizationApiService = {
  getSeries: async (
    filters: UtilizationFilters
  ): Promise<IServerResponse<UtilizationSeriesResponse>> => {
    const q = toQueryString(filtersToQuery(filters));
    const response = await apiClient.get<IServerResponse<UtilizationSeriesResponse>>(
      `${rootUrl}/utilization/series${q}`
    );
    return response.data;
  },

  exportCsv: async (filters: UtilizationFilters): Promise<Blob> => {
    const response = await apiClient.post(
      `${rootUrl}/utilization/export/csv`,
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
