import apiClient from '@api/api-client';
import { API_BASE_URL } from '@/shared/constants';
import { IServerResponse } from '@/types/common.types';
import { toQueryString } from '@/utils/toQueryString';
import type {
  PlannedVsActualMilestonesFilters,
  PlannedVsActualMilestonesSeriesResponse,
} from '@/types/reporting/analytics-planned-vs-actual-milestones.types';

const rootUrl = `${API_BASE_URL}/reporting/analytics`;

const filtersToQuery = (filters: PlannedVsActualMilestonesFilters): Record<string, unknown> => ({
  project_ids: filters.project_ids?.join(','),
  member_ids: filters.member_ids?.join(','),
  team_ids: filters.team_ids?.join(','),
});

export const analyticsPlannedVsActualMilestonesApiService = {
  getSeries: async (
    filters: PlannedVsActualMilestonesFilters
  ): Promise<IServerResponse<PlannedVsActualMilestonesSeriesResponse>> => {
    const q = toQueryString(filtersToQuery(filters));
    const response = await apiClient.get<IServerResponse<PlannedVsActualMilestonesSeriesResponse>>(
      `${rootUrl}/planned-vs-actual-milestones/series${q}`
    );
    return response.data;
  },

  exportCsv: async (filters: PlannedVsActualMilestonesFilters): Promise<Blob> => {
    const response = await apiClient.post(
      `${rootUrl}/planned-vs-actual-milestones/export/csv`,
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
