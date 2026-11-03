import apiClient from '@api/api-client';
import { API_BASE_URL } from '@/shared/constants';
import { IServerResponse } from '@/types/common.types';
import type {
  UtilizationFilters,
  UtilizationSeriesResponse,
} from '@/types/reporting/analytics-utilization.types';

const rootUrl = `${API_BASE_URL}/reporting/analytics`;

const filtersToBody = (filters: UtilizationFilters) => ({
  project_ids: filters.project_ids,
  member_ids: filters.member_ids,
  team_ids: filters.team_ids,
  date_from: filters.date_from,
  date_to: filters.date_to,
});

export const analyticsUtilizationApiService = {
  getSeries: async (
    filters: UtilizationFilters
  ): Promise<IServerResponse<UtilizationSeriesResponse>> => {
    const response = await apiClient.post<IServerResponse<UtilizationSeriesResponse>>(
      `${rootUrl}/utilization/series`,
      filtersToBody(filters)
    );
    return response.data;
  },

  exportCsv: async (filters: UtilizationFilters): Promise<Blob> => {
    const response = await apiClient.post(
      `${rootUrl}/utilization/export/csv`,
      filtersToBody(filters),
      { responseType: 'blob' }
    );
    return response.data as Blob;
  },
};
