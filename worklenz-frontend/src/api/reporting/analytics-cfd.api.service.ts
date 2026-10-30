import apiClient from '@api/api-client';
import { API_BASE_URL } from '@/shared/constants';
import { IServerResponse } from '@/types/common.types';
import { toQueryString } from '@/utils/toQueryString';
import type {
  CfdSeriesFilters,
  CfdSeriesResponse,
} from '@/types/reporting/analytics-cfd.types';

const rootUrl = `${API_BASE_URL}/reporting/analytics`;

const filtersToQuery = (filters: CfdSeriesFilters): Record<string, unknown> => ({
  project_ids: filters.project_ids?.join(','),
  team_ids: filters.team_ids?.join(','),
  status_ids: filters.status_ids?.join(','),
  date_from: filters.date_from || undefined,
  date_to: filters.date_to || undefined,
  group_by: filters.group_by,
  smoothing: filters.smoothing,
  wip_thresholds:
    filters.wip_thresholds && Object.keys(filters.wip_thresholds).length > 0
      ? JSON.stringify(filters.wip_thresholds)
      : undefined,
  sprint_overlay: filters.sprint_overlay ? 'true' : 'false',
});

export const analyticsCfdApiService = {
  getSeries: async (
    filters: CfdSeriesFilters
  ): Promise<IServerResponse<CfdSeriesResponse>> => {
    const q = toQueryString(filtersToQuery(filters));
    const response = await apiClient.get<IServerResponse<CfdSeriesResponse>>(
      `${rootUrl}/cfd/series${q}`
    );
    return response.data;
  },

  exportCsv: async (filters: CfdSeriesFilters): Promise<Blob> => {
    const response = await apiClient.post(
      `${rootUrl}/cfd/export/csv`,
      {
        ...filtersToQuery(filters),
        project_ids: filters.project_ids,
        team_ids: filters.team_ids,
        status_ids: filters.status_ids,
        wip_thresholds: filters.wip_thresholds,
      },
      { responseType: 'blob' }
    );
    return response.data as Blob;
  },
};
