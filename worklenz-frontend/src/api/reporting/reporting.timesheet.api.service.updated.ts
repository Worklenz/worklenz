import { API_BASE_URL } from '@/shared/constants';
import { toQueryString } from '@/utils/toQueryString';
import apiClient from '../api-client';
import { IServerResponse } from '@/types/common.types';
import { IAllocationViewModel } from '@/types/reporting/reporting-allocation.types';
import {
  IProjectLogsBreakdown,
  IRPTTimeMember,
  IRPTTimeProject,
  ITimeLogBreakdownReq,
} from '@/types/reporting/reporting.types';

const rootUrl = `${API_BASE_URL}/reporting`;

// Helper function to get user's timezone
const getUserTimezone = () => {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
};

export const reportingTimesheetApiService = {
  getTimeSheetData: async (
    body = {},
    archived = false
  ): Promise<IServerResponse<IAllocationViewModel>> => {
    const q = toQueryString({ archived });
    const bodyWithTimezone = {
      ...body,
      timezone: getUserTimezone()
    };
    const response = await apiClient.post(`${rootUrl}/allocation/${q}`, bodyWithTimezone);
    return response.data;
  },

  getAllocationProjects: async (body = {}) => {
    const bodyWithTimezone = {
      ...body,
      timezone: getUserTimezone()
    };
    const response = await apiClient.post(`${rootUrl}/allocation/allocation-projects`, bodyWithTimezone);
    return response.data;
  },

  getProjectTimeSheets: async (
    body = {},
    archived = false
  ): Promise<IServerResponse<IRPTTimeProject[]>> => {
    const q = toQueryString({ archived });
    const bodyWithTimezone = {
      ...body,
      timezone: getUserTimezone()
    };
    const response = await apiClient.post(`${rootUrl}/time-reports/projects/${q}`, bodyWithTimezone);
    return response.data;
  },

  getMemberTimeSheets: async (
    body = {},
    archived = false
  ): Promise<IServerResponse<IRPTTimeMember[]>> => {
    const q = toQueryString({ archived });
    const bodyWithTimezone = {
      ...body,
      timezone: getUserTimezone()
    };
    const response = await apiClient.post(`${rootUrl}/time-reports/members/${q}`, bodyWithTimezone);
    return response.data;
  },

  getProjectTimeLogs: async (
    body: ITimeLogBreakdownReq
  ): Promise<IServerResponse<IProjectLogsBreakdown[]>> => {
    const bodyWithTimezone = {
      ...body,
      timezone: getUserTimezone()
    };
    const response = await apiClient.post(`${rootUrl}/project-timelogs`, bodyWithTimezone);
    return response.data;
  },

  getProjectEstimatedVsActual: async (
    body = {},
    archived = false
  ): Promise<IServerResponse<IRPTTimeProject[]>> => {
    const q = toQueryString({ archived });
    const bodyWithTimezone = {
      ...body,
      timezone: getUserTimezone()
    };
    const response = await apiClient.post(`${rootUrl}/time-reports/estimated-vs-actual${q}`, bodyWithTimezone);
    return response.data;
  },
};