import apiClient from '@api/api-client';
import { API_BASE_URL } from '@/shared/constants';
import { IServerResponse } from '@/types/common.types';
import { toQueryString } from '@/utils/toQueryString';
import type { AnalyticsReportTemplate } from '@/types/reporting/analytics-velocity.types';

const rootUrl = `${API_BASE_URL}/reporting/analytics`;

export const analyticsTemplatesApiService = {
  listTemplates: async (
    reportKind: string = 'all'
  ): Promise<IServerResponse<AnalyticsReportTemplate[]>> => {
    const q = toQueryString({ report_kind: reportKind });
    const response = await apiClient.get<IServerResponse<AnalyticsReportTemplate[]>>(
      `${rootUrl}/templates${q}`
    );
    return response.data;
  },

  createTemplate: async (body: {
    name: string;
    report_kind: string;
    filters?: Record<string, unknown>;
    is_workspace_shared?: boolean;
    is_default?: boolean;
  }): Promise<IServerResponse<AnalyticsReportTemplate>> => {
    const response = await apiClient.post<IServerResponse<AnalyticsReportTemplate>>(
      `${rootUrl}/templates`,
      body
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
