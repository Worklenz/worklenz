import apiClient from '@api/api-client';
import { API_BASE_URL } from '@/shared/constants';
import { IServerResponse } from '@/types/common.types';
import type {
  ProjectHealthFilters,
  ProjectHealthSeriesResponse,
} from '@/types/reporting/analytics-project-health.types';

const rootUrl = `${API_BASE_URL}/reporting/analytics`;

const filtersToBody = (filters: ProjectHealthFilters) => ({
  project_ids: filters.project_ids,
  health_ids: filters.health_ids,
  member_ids: filters.member_ids,
  team_ids: filters.team_ids,
});

export const analyticsProjectHealthApiService = {
  getSeries: async (
    filters: ProjectHealthFilters
  ): Promise<IServerResponse<ProjectHealthSeriesResponse>> => {
    const response = await apiClient.post<IServerResponse<ProjectHealthSeriesResponse>>(
      `${rootUrl}/project-health/series`,
      filtersToBody(filters)
    );
    return response.data;
  },

  exportCsv: async (filters: ProjectHealthFilters): Promise<Blob> => {
    const response = await apiClient.post(
      `${rootUrl}/project-health/export/csv`,
      filtersToBody(filters),
      { responseType: 'blob' }
    );
    return response.data as Blob;
  },
};
