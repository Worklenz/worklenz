import apiClient from '@api/api-client';
import { API_BASE_URL } from '@/shared/constants';
import { IServerResponse } from '@/types/common.types';
import type {
  PlannedVsActualTasksFilters,
  PlannedVsActualTasksSeriesResponse,
} from '@/types/reporting/analytics-planned-vs-actual-tasks.types';

const rootUrl = `${API_BASE_URL}/reporting/analytics`;

const filtersToBody = (filters: PlannedVsActualTasksFilters) => ({
  project_ids: filters.project_ids,
  member_ids: filters.member_ids,
  team_ids: filters.team_ids,
});

export const analyticsPlannedVsActualTasksApiService = {
  getSeries: async (
    filters: PlannedVsActualTasksFilters
  ): Promise<IServerResponse<PlannedVsActualTasksSeriesResponse>> => {
    const response = await apiClient.post<IServerResponse<PlannedVsActualTasksSeriesResponse>>(
      `${rootUrl}/planned-vs-actual-tasks/series`,
      filtersToBody(filters)
    );
    return response.data;
  },

  exportCsv: async (filters: PlannedVsActualTasksFilters): Promise<Blob> => {
    const response = await apiClient.post(
      `${rootUrl}/planned-vs-actual-tasks/export/csv`,
      filtersToBody(filters),
      { responseType: 'blob' }
    );
    return response.data as Blob;
  },
};
