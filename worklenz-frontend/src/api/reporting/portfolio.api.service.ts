import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { API_BASE_URL } from '@/shared/constants';
import { IServerResponse } from '@/types/common.types';
import { getCsrfToken, ensureCsrfToken } from '../api-client';
import config from '@/config/env';

export type PortfolioPeriod = 'yearly' | 'quarterly' | 'monthly';

export interface PortfolioPeriodSelection {
  period: PortfolioPeriod;
  year: number;
  /** 1-4, quarterly only */
  quarter?: number;
  /** 1-12, monthly only */
  month?: number;
}

/** One option of a project lookup (status / priority / health), in display order. */
export interface PortfolioLookupItem {
  id: string;
  name: string;
  color: string | null;
}

export interface PortfolioLookups {
  statuses: PortfolioLookupItem[];
  priorities: PortfolioLookupItem[];
  healths: PortfolioLookupItem[];
}

/** Per-option counts keyed by lookup option id. `overdue` is a flag across non-closed projects. */
export interface PortfolioCounts {
  total: number;
  overdue: number;
  status: Record<string, number>;
  priority: Record<string, number>;
  health: Record<string, number>;
}

export interface PortfolioProject {
  id: string;
  name: string;
  status: string;
  statusColor: string | null;
  priority: string | null;
  priorityColor: string | null;
  priorityValue: number | null;
  health: string | null;
  healthColor: string | null;
  manager: string | null;
  startDate: string | null;
  endDate: string | null;
}

export interface PortfolioCategory extends PortfolioCounts {
  id: string | null;
  name: string | null;
  projects: PortfolioProject[];
}

export interface PortfolioKpis {
  opening: number;
  new: number;
  close: number;
  closing: number;
}

export interface PortfolioResponse {
  period: PortfolioPeriod;
  range: { start: string; end: string };
  lookups: PortfolioLookups;
  kpis: PortfolioKpis;
  categories: PortfolioCategory[];
  totals: PortfolioCounts;
}

export type PortfolioExportType = 'summary' | 'detailed';

const buildParams = ({ period, year, quarter, month }: PortfolioPeriodSelection) => {
  const params: Record<string, string> = { period, year: String(year) };
  if (period === 'quarterly' && quarter) params.quarter = String(quarter);
  if (period === 'monthly' && month) params.month = String(month);
  return params;
};

export const buildPortfolioExportUrl = (selection: PortfolioPeriodSelection, type: PortfolioExportType) => {
  const query = new URLSearchParams({ ...buildParams(selection), type }).toString();
  return `${import.meta.env.VITE_API_URL}${API_BASE_URL}/reporting-export/portfolio?${query}`;
};

const portfolioApi = createApi({
  reducerPath: 'portfolioApi',
  baseQuery: fetchBaseQuery({
    baseUrl: `${config.apiUrl}${API_BASE_URL}`,
    prepareHeaders: async headers => {
      let token = getCsrfToken();
      if (!token) {
        try {
          token = await ensureCsrfToken();
        } catch (error) {
          console.error('[CSRF] Failed to refresh CSRF token:', error);
        }
      }
      if (token) headers.set('X-CSRF-Token', token);
      return headers;
    },
    credentials: 'include',
  }),
  endpoints: builder => ({
    getPortfolio: builder.query<IServerResponse<PortfolioResponse>, PortfolioPeriodSelection>({
      query: selection => ({ url: '/reporting/portfolio', params: buildParams(selection) }),
    }),
  }),
});

export const { useGetPortfolioQuery } = portfolioApi;

export default portfolioApi;
