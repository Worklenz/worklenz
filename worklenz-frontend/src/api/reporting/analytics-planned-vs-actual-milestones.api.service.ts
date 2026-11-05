import apiClient from '@api/api-client';
import { API_BASE_URL } from '@/shared/constants';
import { IServerResponse } from '@/types/common.types';
import type {
  PlannedVsActualMilestonesFilters,
  PlannedVsActualMilestonesSeriesResponse,
} from '@/types/reporting/analytics-planned-vs-actual-milestones.types';

const rootUrl = `${API_BASE_URL}/reporting/analytics`;

const filtersToBody = (filters: PlannedVsActualMilestonesFilters) => ({
  project_ids: filters.project_ids,
  member_ids: filters.member_ids,
  team_ids: filters.team_ids,
});

export const analyticsPlannedVsActualMilestonesApiService = {
  /**
   * POST keeps large "Select all" project lists out of the URL — GET query strings
   * exceed Node/proxy header limits in large testing portfolios and surface as
   * "Something went wrong".
   */
  getSeries: async (
    filters: PlannedVsActualMilestonesFilters
  ): Promise<IServerResponse<PlannedVsActualMilestonesSeriesResponse>> => {
    const response = await apiClient.post<IServerResponse<PlannedVsActualMilestonesSeriesResponse>>(
      `${rootUrl}/planned-vs-actual-milestones/series`,
      filtersToBody(filters)
    );
    return response.data;
  },

  exportCsv: async (filters: PlannedVsActualMilestonesFilters): Promise<Blob> => {
    const response = await apiClient.post(
      `${rootUrl}/planned-vs-actual-milestones/export/csv`,
      filtersToBody(filters),
      { responseType: 'blob' }
    );
    return response.data as Blob;
  },
};
