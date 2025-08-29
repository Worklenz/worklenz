import { API_BASE_URL } from '@/shared/constants';
import { IServerResponse } from '@/types/common.types';
import apiClient from '../api-client';
import {
  IProjectFinanceResponse,
  ITaskBreakdownResponse,
  IProjectFinanceTask,
} from '@/types/project/project-finance.types';

const rootUrl = `${API_BASE_URL}/project-finance`;

type BillableFilterType = 'all' | 'billable' | 'non-billable';

export const projectFinanceApiService = {
  getProjectTasks: async (
    projectId: string,
    groupBy: 'status' | 'priority' | 'phases' = 'status',
    billableFilter: BillableFilterType = 'billable'
  ): Promise<IServerResponse<IProjectFinanceResponse>> => {
    const response = await apiClient.get<IServerResponse<IProjectFinanceResponse>>(
      `${rootUrl}/project/${projectId}/tasks`,
      {
        params: {
          group_by: groupBy,
          billable_filter: billableFilter,
        },
      }
    );
    return response.data;
  },

  getSubTasks: async (
    projectId: string,
    parentTaskId: string,
    billableFilter: BillableFilterType = 'billable'
  ): Promise<IServerResponse<IProjectFinanceTask[]>> => {
    const response = await apiClient.get<IServerResponse<IProjectFinanceTask[]>>(
      `${rootUrl}/project/${projectId}/tasks/${parentTaskId}/subtasks`,
      {
        params: {
          billable_filter: billableFilter,
        },
      }
    );
    return response.data;
  },

  getTaskBreakdown: async (taskId: string): Promise<IServerResponse<ITaskBreakdownResponse>> => {
    const response = await apiClient.get<IServerResponse<ITaskBreakdownResponse>>(
      `${rootUrl}/task/${taskId}/breakdown`
    );
    return response.data;
  },

  updateTaskFixedCost: async (taskId: string, fixedCost: number): Promise<IServerResponse<any>> => {
    const response = await apiClient.put<IServerResponse<any>>(
      `${rootUrl}/task/${taskId}/fixed-cost`,
      { fixed_cost: fixedCost }
    );
    return response.data;
  },

  updateProjectCurrency: async (
    projectId: string,
    currency: string
  ): Promise<IServerResponse<any>> => {
    const response = await apiClient.put<IServerResponse<any>>(
      `${rootUrl}/project/${projectId}/currency`,
      { currency }
    );
    return response.data;
  },

  updateProjectBudget: async (projectId: string, budget: number): Promise<IServerResponse<any>> => {
    const response = await apiClient.put<IServerResponse<any>>(
      `${rootUrl}/project/${projectId}/budget`,
      { budget }
    );
    return response.data;
  },

  updateProjectCalculationMethod: async (
    projectId: string,
    calculationMethod: 'hourly' | 'man_days',
    hoursPerDay?: number
  ): Promise<IServerResponse<any>> => {
    const response = await apiClient.put<IServerResponse<any>>(
      `${rootUrl}/project/${projectId}/calculation-method`,
      {
        calculation_method: calculationMethod,
        hours_per_day: hoursPerDay,
      }
    );
    return response.data;
  },

  updateTaskEstimatedManDays: async (
    taskId: string,
    estimatedManDays: number
  ): Promise<IServerResponse<any>> => {
    const response = await apiClient.put<IServerResponse<any>>(
      `${rootUrl}/task/${taskId}/estimated-man-days`,
      { estimated_man_days: estimatedManDays }
    );
    return response.data;
  },

  updateRateCardManDayRate: async (
    rateCardRoleId: string,
    manDayRate: number
  ): Promise<IServerResponse<any>> => {
    const response = await apiClient.put<IServerResponse<any>>(
      `${rootUrl}/rate-card-role/${rateCardRoleId}/man-day-rate`,
      { man_day_rate: manDayRate }
    );
    return response.data;
  },

  exportFinanceData: async (
    projectId: string,
    groupBy: 'status' | 'priority' | 'phases' = 'status',
    billableFilter: BillableFilterType = 'billable'
  ): Promise<Blob> => {
    const response = await apiClient.get(`${rootUrl}/project/${projectId}/export`, {
      params: {
        groupBy,
        billable_filter: billableFilter,
      },
      responseType: 'blob',
    });
    return response.data;
  },
};
