import { API_BASE_URL } from "@/shared/constants";
import { IServerResponse } from "@/types/common.types";
import apiClient from "../api-client";
import { IProjectFinanceResponse, ITaskBreakdownResponse, IProjectFinanceTask } from "@/types/project/project-finance.types";

const rootUrl = `${API_BASE_URL}/project-finance`;

export const projectFinanceApiService = {
    getProjectTasks: async (
        projectId: string,
        groupBy: 'status' | 'priority' | 'phases' = 'status'
      ): Promise<IServerResponse<IProjectFinanceResponse>> => {
        const response = await apiClient.get<IServerResponse<IProjectFinanceResponse>>(
          `${rootUrl}/project/${projectId}/tasks`,
          {
            params: { group_by: groupBy }
          }
        );
        console.log(response.data);
        return response.data;
      },

    getSubTasks: async (
        projectId: string,
        parentTaskId: string
      ): Promise<IServerResponse<IProjectFinanceTask[]>> => {
        const response = await apiClient.get<IServerResponse<IProjectFinanceTask[]>>(
          `${rootUrl}/project/${projectId}/tasks/${parentTaskId}/subtasks`
        );
        return response.data;
      },

    getTaskBreakdown: async (
        taskId: string
      ): Promise<IServerResponse<ITaskBreakdownResponse>> => {
        const response = await apiClient.get<IServerResponse<ITaskBreakdownResponse>>(
          `${rootUrl}/task/${taskId}/breakdown`
        );
        return response.data;
      },

    updateTaskFixedCost: async (
        taskId: string,
        fixedCost: number
      ): Promise<IServerResponse<any>> => {
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

    exportFinanceData: async (
        projectId: string,
        groupBy: 'status' | 'priority' | 'phases' = 'status'
      ): Promise<Blob> => {
        const response = await apiClient.get(
          `${rootUrl}/project/${projectId}/export`,
          {
            params: { groupBy },
            responseType: 'blob'
          }
        );
        return response.data;
      },
}