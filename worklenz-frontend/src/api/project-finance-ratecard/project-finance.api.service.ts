import { API_BASE_URL } from "@/shared/constants";
import { IServerResponse } from "@/types/common.types";
import apiClient from "../api-client";
import { IProjectFinanceGroup } from "@/types/project/project-finance.types";

const rootUrl = `${API_BASE_URL}/project-finance`;

export const projectFinanceApiService = {
    getProjectTasks: async (
        projectId: string,
        groupBy: 'status' | 'priority' | 'phases' = 'status'
      ): Promise<IServerResponse<IProjectFinanceGroup[]>> => {
        const response = await apiClient.get<IServerResponse<IProjectFinanceGroup[]>>(
          `${rootUrl}/project/${projectId}/tasks`,
          {
            params: { group_by: groupBy }
          }
        );
        console.log(response.data);
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
}