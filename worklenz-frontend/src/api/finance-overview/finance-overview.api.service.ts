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

export type FinanceAlertStatus = 'high' | 'watch' | 'ok' | 'none';

export interface IFinanceBudgetProject {
  id: string;
  name: string;
  color_code: string;
  client_name: string | null;
  currency: string;
  budget: number;
  spent: number;
  remaining: number;
  burn_pct: number;
  etc: number;
  alert: FinanceAlertStatus;
  estimated_hours: number;
  logged_hours: number;
}

export interface IFinanceBudgetsResponse {
  projects: IFinanceBudgetProject[];
}

export interface IFinanceInvoiceRow {
  id: string;
  invoice_no: string;
  client_name: string | null;
  project_name: string | null;
  project_color: string;
  amount: number;
  currency: string;
  payment_status: string;
  paid_amount: number;
  status: string;
  issued_at: string;
  due_date: string | null;
}

export interface IFinanceInvoicesResponse {
  summary: {
    total_invoiced: number;
    total_paid: number;
    total_outstanding: number;
  };
  invoices: IFinanceInvoiceRow[];
  total: number;
  page: number;
  page_size: number;
}

export interface IFinanceBillableEntry {
  id: string;
  logged_at: string;
  hours: number;
  billable: boolean;
  rate: number;
  value: number;
  task_id: string;
  task_name: string;
  project_id: string;
  project_name: string;
  project_color: string;
  currency: string;
  member_name: string;
  avatar_url: string | null;
  color_code: string;
  role_name: string | null;
}

export interface IFinanceBillableTimeResponse {
  range: { start: string; end: string };
  summary: {
    logged_hours: number;
    billable_hours: number;
    non_billable_hours: number;
    billable_value: number;
  };
  entries: IFinanceBillableEntry[];
  total: number;
  page: number;
  page_size: number;
}

export interface IFinanceUtilizationMember {
  team_member_id: string;
  member_name: string;
  avatar_url: string | null;
  color_code: string;
  role_name: string | null;
  billable_hours: number;
  total_hours: number;
  utilization_pct: number;
  status: Exclude<FinanceAlertStatus, 'none'>;
}

export interface IFinanceUtilizationResponse {
  range: { start: string; end: string };
  summary: {
    team_utilization_pct: number;
    billable_hours: number;
    non_billable_hours: number;
    overallocated_count: number;
    capacity_hours: number;
  };
  members: IFinanceUtilizationMember[];
}

export interface IFinanceProfitabilityProject {
  id: string;
  name: string;
  color_code: string;
  client_name: string | null;
  currency: string;
  cost: number;
  fixed_cost: number;
  time_based_cost: number;
  utilization_pct: number;
  health: FinanceAlertStatus;
}

export interface IFinanceProfitabilityResponse {
  summary: {
    revenue: number;
    invoiced_revenue: number;
    tracked_cost: number;
    profit: number;
    profit_margin_pct: number;
    billable_utilization_pct: number;
    has_revenue: boolean;
  };
  cost_breakdown: Array<{ key: 'fixed' | 'timeBased'; amount: number }>;
  trend: Array<{
    month_key: string;
    month_label: string;
    revenue: number;
    cost: number;
    profit: number;
  }>;
  projects: IFinanceProfitabilityProject[];
}

export interface IFinanceForecastPoint {
  month_key: string;
  month_label: string;
  revenue: number;
  cost: number;
  profit: number;
  projected: boolean;
}

export interface IFinanceForecastsResponse {
  methodology: string;
  summary: {
    projected_revenue: number;
    projected_profit: number;
    revenue_delta_pct: number | null;
    profit_delta_pct: number | null;
    has_revenue: boolean;
  };
  chart: IFinanceForecastPoint[];
}

export interface IFinanceReportQuery {
  page?: number;
  page_size?: number;
  search?: string;
  status?: string;
  start?: string;
  end?: string;
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

  getBudgets: async (): Promise<IServerResponse<IFinanceBudgetsResponse>> => {
    const response = await apiClient.get<IServerResponse<IFinanceBudgetsResponse>>(
      `${API_BASE_URL}/finance-overview/budgets`
    );
    return response.data;
  },

  getInvoices: async (
    params: IFinanceReportQuery = {}
  ): Promise<IServerResponse<IFinanceInvoicesResponse>> => {
    const response = await apiClient.get<IServerResponse<IFinanceInvoicesResponse>>(
      `${API_BASE_URL}/finance-overview/invoices`,
      { params }
    );
    return response.data;
  },

  getBillableTime: async (
    params: IFinanceReportQuery = {}
  ): Promise<IServerResponse<IFinanceBillableTimeResponse>> => {
    const response = await apiClient.get<IServerResponse<IFinanceBillableTimeResponse>>(
      `${API_BASE_URL}/finance-overview/billable-time`,
      { params }
    );
    return response.data;
  },

  getUtilization: async (
    params: IFinanceReportQuery = {}
  ): Promise<IServerResponse<IFinanceUtilizationResponse>> => {
    const response = await apiClient.get<IServerResponse<IFinanceUtilizationResponse>>(
      `${API_BASE_URL}/finance-overview/utilization`,
      { params }
    );
    return response.data;
  },

  getProfitability: async (): Promise<IServerResponse<IFinanceProfitabilityResponse>> => {
    const response = await apiClient.get<IServerResponse<IFinanceProfitabilityResponse>>(
      `${API_BASE_URL}/finance-overview/profitability`
    );
    return response.data;
  },

  getForecasts: async (): Promise<IServerResponse<IFinanceForecastsResponse>> => {
    const response = await apiClient.get<IServerResponse<IFinanceForecastsResponse>>(
      `${API_BASE_URL}/finance-overview/forecasts`
    );
    return response.data;
  },
};
