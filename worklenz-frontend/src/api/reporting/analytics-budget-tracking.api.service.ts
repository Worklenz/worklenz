import apiClient from '@api/api-client';
import { API_BASE_URL } from '@/shared/constants';
import { IServerResponse } from '@/types/common.types';
import { toQueryString } from '@/utils/toQueryString';
import type {
  BudgetTrackingFilters,
  BudgetTrackingSeriesResponse,
} from '@/types/reporting/analytics-budget-tracking.types';

const rootUrl = `${API_BASE_URL}/reporting/analytics`;

const filtersToQuery = (filters: BudgetTrackingFilters): Record<string, unknown> => ({
  project_ids: filters.project_ids?.join(','),
  member_ids: filters.member_ids?.join(','),
  team_ids: filters.team_ids?.join(','),
});

export const analyticsBudgetTrackingApiService = {
  getSeries: async (
    filters: BudgetTrackingFilters
  ): Promise<IServerResponse<BudgetTrackingSeriesResponse>> => {
    const q = toQueryString(filtersToQuery(filters));
    const response = await apiClient.get<IServerResponse<BudgetTrackingSeriesResponse>>(
      `${rootUrl}/budget-tracking/series${q}`
    );
    return response.data;
  },

  exportCsv: async (filters: BudgetTrackingFilters): Promise<Blob> => {
    const response = await apiClient.post(
      `${rootUrl}/budget-tracking/export/csv`,
      {
        project_ids: filters.project_ids,
        member_ids: filters.member_ids,
        team_ids: filters.team_ids,
      },
      { responseType: 'blob' }
    );
    return response.data as Blob;
  },
};
