import { API_BASE_URL } from '@/shared/constants';
import { IServerResponse } from '@/types/common.types';
import apiClient from '@/api/api-client';
import { InlineMember } from '@/types/teamMembers/inlineMember.types';

export interface IFinanceOverviewProject {
  id: string;
  name: string;
  color_code: string;
  client_name: string | null;
  budget: number;
  fixed_cost: number;
  time_based_cost: number;
  actual_cost: number;
  estimated_hours: number;
  currency: string;
}

export interface IFinanceOverviewResponse {
  projects: IFinanceOverviewProject[];
}

export interface ITeamFixedCostItem {
  task_id: string;
  task_name: string;
  fixed_cost: number;
  updated_at: string;
  project_id: string;
  project_name: string;
  project_color: string;
  currency: string;
  assignees: InlineMember[];
}

export interface ITeamFixedCostsResponse {
  items: ITeamFixedCostItem[];
  total: number;
  page: number;
  page_size: number;
}

export const financeOverviewApiService = {
  getPortfolioFinance: async (): Promise<IServerResponse<IFinanceOverviewResponse>> => {
    const response = await apiClient.get<IServerResponse<IFinanceOverviewResponse>>(
      `${API_BASE_URL}/finance-overview/portfolio`
    );
    return response.data;
  },
  exportPortfolioFinance: async (): Promise<Blob> => {
    const response = await apiClient.get(
      `${API_BASE_URL}/finance-overview/export`,
      { responseType: 'blob' }
    );
    return response.data;
  },

  getTeamFixedCosts: async (
    page = 1,
    pageSize = 10
  ): Promise<IServerResponse<ITeamFixedCostsResponse>> => {
    const response = await apiClient.get<IServerResponse<ITeamFixedCostsResponse>>(
      `${API_BASE_URL}/finance-overview/fixed-costs`,
      { params: { page, page_size: pageSize } }
    );
    return response.data;
  },

};
