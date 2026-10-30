import apiClient from '@api/api-client';
import { API_BASE_URL } from '@/shared/constants';
import { IServerResponse } from '@/types/common.types';
import { toQueryString } from '@/utils/toQueryString';
import type {
  ProjectHealthFilters,
  ProjectHealthSeriesResponse,
} from '@/types/reporting/analytics-project-health.types';

const rootUrl = `${API_BASE_URL}/reporting/analytics`;

const filtersToQuery = (filters: ProjectHealthFilters): Record<string, unknown> => ({
  project_ids: filters.project_ids?.join(','),
  health_ids: filters.health_ids?.join(','),
  member_ids: filters.member_ids?.join(','),
  team_ids: filters.team_ids?.join(','),
});

export const analyticsProjectHealthApiService = {
  getSeries: async (
    filters: ProjectHealthFilters
  ): Promise<IServerResponse<ProjectHealthSeriesResponse>> => {
    const q = toQueryString(filtersToQuery(filters));
    const response = await apiClient.get<IServerResponse<ProjectHealthSeriesResponse>>(
      `${rootUrl}/project-health/series${q}`
    );
    return response.data;
  },

  exportCsv: async (filters: ProjectHealthFilters): Promise<Blob> => {
    const response = await apiClient.post(
      `${rootUrl}/project-health/export/csv`,
      {
        project_ids: filters.project_ids,
        health_ids: filters.health_ids,
        member_ids: filters.member_ids,
        team_ids: filters.team_ids,
      },
      { responseType: 'blob' }
    );
    return response.data as Blob;
  },
};
