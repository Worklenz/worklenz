import { API_BASE_URL } from "@/shared/constants";
import apiClient from "../api-client";
import { IServerResponse } from "@/types/common.types";
import { ITaskLogViewModel } from "@/types/tasks/task-log-view.types";

const rootUrl = `${API_BASE_URL}/task-time-log`;

export const taskTimeLogsApiService = {
  getByTask: async (id: string) : Promise<IServerResponse<ITaskLogViewModel[]>> => {
    const response = await apiClient.get(`${rootUrl}/task/${id}`);
    return response.data;
  },

  delete: async (id: string, taskId: string) : Promise<IServerResponse<void>> => {
    const response = await apiClient.delete(`${rootUrl}/${id}?task=${taskId}`);
    return response.data;
  },

  create: async (body: {}): Promise<IServerResponse<ITaskLogViewModel>> => {
    const response = await apiClient.post(`${rootUrl}`, body);
    return response.data;
  },

  update: async (id: string, body: {}): Promise<IServerResponse<ITaskLogViewModel>> => {
    const response = await apiClient.put(`${rootUrl}/${id}`, body);
    return response.data;
  },

  exportToExcel(taskId: string) {
    window.location.href = `${import.meta.env.VITE_API_URL}${API_BASE_URL}/task-time-log/export/${taskId}`;
  },
};
