import { IServerResponse } from '@/types/common.types';
import apiClient from '../api-client';
import { API_BASE_URL } from '@/shared/constants';

const rootUrl = `${API_BASE_URL}/team-management`;

export const teamManagementApiService = {
  assignManager: async (teamMemberId: string, managerId: string): Promise<IServerResponse<any>> => {
    const response = await apiClient.post<IServerResponse<any>>(`${rootUrl}/assign-manager`, {
      teamMemberId,
      managerId,
    });
    return response.data;
  },

  bulkAssignMembers: async (
    teamLeadId: string,
    memberIds: string[]
  ): Promise<IServerResponse<any>> => {
    const response = await apiClient.post<IServerResponse<any>>(`${rootUrl}/bulk-assign-members`, {
      teamLeadId,
      memberIds,
    });
    return response.data;
  },

  removeManagerAssignment: async (teamMemberId: string): Promise<IServerResponse<any>> => {
    const response = await apiClient.post<IServerResponse<any>>(
      `${rootUrl}/remove-manager-assignment`,
      {
        teamMemberId,
      }
    );
    return response.data;
  },

  getTeamHierarchy: async (): Promise<IServerResponse<any[]>> => {
    const response = await apiClient.get<IServerResponse<any[]>>(`${rootUrl}/team-hierarchy`);
    return response.data;
  },
};
