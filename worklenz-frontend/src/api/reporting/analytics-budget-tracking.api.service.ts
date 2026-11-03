import apiClient from '@api/api-client';
import { API_BASE_URL } from '@/shared/constants';
import { IServerResponse } from '@/types/common.types';
import type {
  BudgetTrackingFilters,
  BudgetTrackingSeriesResponse,
} from '@/types/reporting/analytics-budget-tracking.types';

const rootUrl = `${API_BASE_URL}/reporting/analytics`;

const filtersToBody = (filters: BudgetTrackingFilters) => ({
  project_ids: filters.project_ids,
  member_ids: filters.member_ids,
  team_ids: filters.team_ids,
});

export const analyticsBudgetTrackingApiService = {
  getSeries: async (
    filters: BudgetTrackingFilters
  ): Promise<IServerResponse<BudgetTrackingSeriesResponse>> => {
    const response = await apiClient.post<IServerResponse<BudgetTrackingSeriesResponse>>(
      `${rootUrl}/budget-tracking/series`,
      filtersToBody(filters)
    );
    return response.data;
  },

  exportCsv: async (filters: BudgetTrackingFilters): Promise<Blob> => {
    const response = await apiClient.post(
      `${rootUrl}/budget-tracking/export/csv`,
      filtersToBody(filters),
      { responseType: 'blob' }
    );
    return response.data as Blob;
  },
};
