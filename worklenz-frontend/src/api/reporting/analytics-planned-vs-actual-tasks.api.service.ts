import apiClient from '@api/api-client';
import { API_BASE_URL } from '@/shared/constants';
import { IServerResponse } from '@/types/common.types';
import { toQueryString } from '@/utils/toQueryString';
import type {
  PlannedVsActualTasksFilters,
  PlannedVsActualTasksSeriesResponse,
} from '@/types/reporting/analytics-planned-vs-actual-tasks.types';

const rootUrl = `${API_BASE_URL}/reporting/analytics`;

const filtersToQuery = (filters: PlannedVsActualTasksFilters): Record<string, unknown> => ({
  project_ids: filters.project_ids?.join(','),
  member_ids: filters.member_ids?.join(','),
  team_ids: filters.team_ids?.join(','),
});

export const analyticsPlannedVsActualTasksApiService = {
  getSeries: async (
    filters: PlannedVsActualTasksFilters
  ): Promise<IServerResponse<PlannedVsActualTasksSeriesResponse>> => {
    const q = toQueryString(filtersToQuery(filters));
    const response = await apiClient.get<IServerResponse<PlannedVsActualTasksSeriesResponse>>(
      `${rootUrl}/planned-vs-actual-tasks/series${q}`
    );
    return response.data;
  },

  exportCsv: async (filters: PlannedVsActualTasksFilters): Promise<Blob> => {
    const response = await apiClient.post(
      `${rootUrl}/planned-vs-actual-tasks/export/csv`,
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
