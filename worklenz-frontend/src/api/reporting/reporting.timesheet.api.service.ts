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

export const reportingTimesheetApiService = {
  getTimeSheetData: async (
    body = {},
    archived = false
  ): Promise<IServerResponse<IAllocationViewModel>> => {
    const q = toQueryString({ archived });
    const response = await apiClient.post(`${rootUrl}/allocation/${q}`, body);
    return response.data;
  },

  getAllocationProjects: async (body = {}) => {
    const response = await apiClient.post(`${rootUrl}/allocation/allocation-projects`, { body });
    return response.data;
  },

  getProjectTimeSheets: async (
    body = {},
    archived = false
  ): Promise<IServerResponse<IRPTTimeProject[]>> => {
    const q = toQueryString({ archived });
    const response = await apiClient.post(`${rootUrl}/time-reports/projects/${q}`, body);
    return response.data;
  },

  getMemberTimeSheets: async (
    body = {},
    archived = false
  ): Promise<IServerResponse<IRPTTimeMember[]>> => {
    const q = toQueryString({ archived });
    const response = await apiClient.post(`${rootUrl}/time-reports/members/${q}`, body);
    return response.data;
  },

  getProjectTimeLogs: async (
    body: ITimeLogBreakdownReq
  ): Promise<IServerResponse<IProjectLogsBreakdown[]>> => {
    const response = await apiClient.post(`${rootUrl}/project-timelogs`, body);
    return response.data;
  },

  getProjectEstimatedVsActual: async (
    body = {},
    archived = false
  ): Promise<IServerResponse<IRPTTimeProject[]>> => {
    const q = toQueryString({ archived });
    const response = await apiClient.post(`${rootUrl}/time-reports/estimated-vs-actual${q}`, body);
    return response.data;
  },
};
