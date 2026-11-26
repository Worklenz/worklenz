import apiClient from '@api/api-client';
import { API_BASE_URL } from '@/shared/constants';
import { IServerResponse } from '@/types/common.types';
import { toQueryString } from '@/utils/toQueryString';
import type {
  AnalyticsReportSchedule,
  AnalyticsScheduleUpsertPayload,
} from '@/types/reporting/analytics-schedules.types';

const rootUrl = `${API_BASE_URL}/reporting/analytics`;

export const analyticsSchedulesApiService = {
  listSchedules: async (): Promise<IServerResponse<AnalyticsReportSchedule[]>> => {
    const response = await apiClient.get<IServerResponse<AnalyticsReportSchedule[]>>(
      `${rootUrl}/schedules`
    );
    return response.data;
  },

  getByReport: async (
    reportKind: string,
    templateId?: string | null
  ): Promise<IServerResponse<AnalyticsReportSchedule | null>> => {
    const q = toQueryString({
      report_kind: reportKind,
      ...(templateId ? { template_id: templateId } : {}),
    });
    const response = await apiClient.get<IServerResponse<AnalyticsReportSchedule | null>>(
      `${rootUrl}/schedules/by-report${q}`
    );
    return response.data;
  },

  upsertSchedule: async (
    body: AnalyticsScheduleUpsertPayload
  ): Promise<IServerResponse<AnalyticsReportSchedule>> => {
    const response = await apiClient.post<IServerResponse<AnalyticsReportSchedule>>(
      `${rootUrl}/schedules`,
      body
    );
    return response.data;
  },

  updateSchedule: async (
    id: string,
    body: Partial<AnalyticsScheduleUpsertPayload>
  ): Promise<IServerResponse<AnalyticsReportSchedule>> => {
    const response = await apiClient.patch<IServerResponse<AnalyticsReportSchedule>>(
      `${rootUrl}/schedules/${id}`,
      body
    );
    return response.data;
  },

  setPaused: async (
    id: string,
    paused: boolean
  ): Promise<IServerResponse<AnalyticsReportSchedule>> => {
    const response = await apiClient.post<IServerResponse<AnalyticsReportSchedule>>(
      `${rootUrl}/schedules/${id}/pause`,
      { paused }
    );
    return response.data;
  },

  deleteSchedule: async (id: string): Promise<IServerResponse<null>> => {
    const response = await apiClient.delete<IServerResponse<null>>(
      `${rootUrl}/schedules/${id}`
    );
    return response.data;
  },
};
