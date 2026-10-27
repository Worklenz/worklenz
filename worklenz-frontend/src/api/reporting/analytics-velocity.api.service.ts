import apiClient from '@api/api-client';
import { API_BASE_URL } from '@/shared/constants';
import { IServerResponse } from '@/types/common.types';
import { toQueryString } from '@/utils/toQueryString';
import type {
  AnalyticsReportTemplate,
  VelocitySeriesFilters,
  VelocitySeriesResponse,
} from '@/types/reporting/analytics-velocity.types';

const rootUrl = `${API_BASE_URL}/reporting/analytics`;

const filtersToQuery = (filters: VelocitySeriesFilters): Record<string, unknown> => ({
  view_by: filters.view_by,
  project_ids: filters.project_ids?.join(','),
  member_ids: filters.member_ids?.join(','),
  team_ids: filters.team_ids?.join(','),
  sprint_count: filters.sprint_count,
  date_from: filters.date_from || undefined,
  date_to: filters.date_to || undefined,
  metric: filters.metric,
  avg_window: filters.avg_window,
  trend: filters.trend ? 'true' : 'false',
});

export const analyticsVelocityApiService = {
  getSeries: async (
    filters: VelocitySeriesFilters
  ): Promise<IServerResponse<VelocitySeriesResponse>> => {
    const q = toQueryString(filtersToQuery(filters));
    const response = await apiClient.get<IServerResponse<VelocitySeriesResponse>>(
      `${rootUrl}/velocity/series${q}`
    );
    return response.data;
  },

  exportExcel: async (
    filters: VelocitySeriesFilters,
    chartImage?: string | null
  ): Promise<Blob> => {
    const response = await apiClient.post(
      `${rootUrl}/velocity/export/excel`,
      {
        ...filtersToQuery(filters),
        project_ids: filters.project_ids,
        member_ids: filters.member_ids,
        team_ids: filters.team_ids,
        chart_image: chartImage || undefined,
      },
      { responseType: 'blob' }
    );
    return response.data as Blob;
  },

  listTemplates: async (
    reportKind = 'velocity'
  ): Promise<IServerResponse<AnalyticsReportTemplate[]>> => {
    const q = toQueryString({ report_kind: reportKind });
    const response = await apiClient.get<IServerResponse<AnalyticsReportTemplate[]>>(
      `${rootUrl}/templates${q}`
    );
    return response.data;
  },

  createTemplate: async (body: {
    name: string;
    filters?: Record<string, unknown>;
    is_workspace_shared?: boolean;
    is_default?: boolean;
    report_kind?: string;
  }): Promise<IServerResponse<AnalyticsReportTemplate>> => {
    const response = await apiClient.post<IServerResponse<AnalyticsReportTemplate>>(
      `${rootUrl}/templates`,
      { report_kind: 'velocity', ...body }
    );
    return response.data;
  },

  renameTemplate: async (
    id: string,
    name: string
  ): Promise<IServerResponse<AnalyticsReportTemplate>> => {
    const response = await apiClient.patch<IServerResponse<AnalyticsReportTemplate>>(
      `${rootUrl}/templates/${id}`,
      { name }
    );
    return response.data;
  },

  deleteTemplate: async (id: string): Promise<IServerResponse<null>> => {
    const response = await apiClient.delete<IServerResponse<null>>(
      `${rootUrl}/templates/${id}`
    );
    return response.data;
  },

  setDefaultTemplate: async (
    id: string
  ): Promise<IServerResponse<AnalyticsReportTemplate>> => {
    const response = await apiClient.post<IServerResponse<AnalyticsReportTemplate>>(
      `${rootUrl}/templates/${id}/default`
    );
    return response.data;
  },

  setTemplateShare: async (
    id: string,
    is_workspace_shared: boolean
  ): Promise<IServerResponse<AnalyticsReportTemplate>> => {
    const response = await apiClient.post<IServerResponse<AnalyticsReportTemplate>>(
      `${rootUrl}/templates/${id}/share`,
      { is_workspace_shared }
    );
    return response.data;
  },
};
