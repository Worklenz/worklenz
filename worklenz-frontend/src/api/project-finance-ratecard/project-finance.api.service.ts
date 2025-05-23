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
        return response.data;
      },
}