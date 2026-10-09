import apiClient from '@api/api-client';
import { API_BASE_URL } from '@/shared/constants';
import { IServerResponse } from '@/types/common.types';
import {
  ICustomReport,
  ICustomReportData,
  ICustomReportDefinition,
  ICustomReportInput,
  ICycleTimeReport,
  IFlowReport,
  ISprintReport,
} from '@/types/project/softwareReports.types';
import { toQueryString } from '@/utils/toQueryString';

const rootUrl = `${API_BASE_URL}/software-reports`;

export const softwareReportsApiService = {
  getSprintReport: async (projectId: string, sprintId?: string | null) => {
    const q = toQueryString({ project_id: projectId, ...(sprintId ? { sprint_id: sprintId } : {}) });
    const response = await apiClient.get<IServerResponse<ISprintReport>>(`${rootUrl}/sprint${q}`);
    return response.data;
  },

  getFlowReport: async (projectId: string) => {
    const q = toQueryString({ project_id: projectId });
    const response = await apiClient.get<IServerResponse<IFlowReport>>(`${rootUrl}/flow${q}`);
    return response.data;
  },

  getCycleTimeReport: async (projectId: string) => {
    const q = toQueryString({ project_id: projectId });
    const response = await apiClient.get<IServerResponse<ICycleTimeReport>>(
      `${rootUrl}/cycle-time${q}`
    );
    return response.data;
  },

  getCustomReports: async (projectId: string) => {
    const q = toQueryString({ project_id: projectId });
    const response = await apiClient.get<IServerResponse<ICustomReport[]>>(`${rootUrl}/custom${q}`);
    return response.data;
  },

  createCustomReport: async (projectId: string, body: ICustomReportInput) => {
    const response = await apiClient.post<IServerResponse<ICustomReport>>(`${rootUrl}/custom`, {
      ...body,
      project_id: projectId,
    });
    return response.data;
  },

  previewCustomReport: async (projectId: string, definition: ICustomReportDefinition) => {
    const response = await apiClient.post<IServerResponse<ICustomReportData>>(
      `${rootUrl}/custom/preview`,
      { ...definition, project_id: projectId }
    );
    return response.data;
  },

  getCustomReportData: async (projectId: string, reportId: string) => {
    const q = toQueryString({ project_id: projectId });
    const response = await apiClient.get<IServerResponse<ICustomReportData>>(
      `${rootUrl}/custom/${reportId}/data${q}`
    );
    return response.data;
  },

  deleteCustomReport: async (projectId: string, reportId: string) => {
    const q = toQueryString({ project_id: projectId });
    const response = await apiClient.delete<IServerResponse<{ id: string }>>(
      `${rootUrl}/custom/${reportId}${q}`
    );
    return response.data;
  },
};
