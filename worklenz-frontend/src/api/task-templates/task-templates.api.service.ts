import { API_BASE_URL } from '@/shared/constants';
import apiClient from '../api-client';
import { IServerResponse } from '@/types/common.types';
import {
  ITaskTemplateGetResponse,
  ITaskTemplatesGetResponse,
} from '@/types/settings/task-templates.types';
import { ITask } from '@/types/tasks/task.types';
import { IProjectTask } from '@/types/project/projectTasksViewModel.types';

const rootUrl = `${API_BASE_URL}/task-templates`;

export const taskTemplatesApiService = {
  getTemplates: async (): Promise<IServerResponse<ITaskTemplatesGetResponse[]>> => {
    const url = `${rootUrl}`;
    const response = await apiClient.get<IServerResponse<ITaskTemplatesGetResponse[]>>(`${url}`);
    return response.data;
  },
  getTemplate: async (id: string): Promise<IServerResponse<ITaskTemplateGetResponse>> => {
    const url = `${rootUrl}/${id}`;
    const response = await apiClient.get<IServerResponse<ITaskTemplateGetResponse>>(`${url}`);
    return response.data;
  },
  createTemplate: async (body: {
    name: string;
    tasks: IProjectTask[];
  }): Promise<IServerResponse<ITask>> => {
    const url = `${rootUrl}`;
    const response = await apiClient.post<IServerResponse<ITask>>(`${url}`, body);
    return response.data;
  },
  updateTemplate: async (
    id: string,
    body: { name: string; tasks: IProjectTask[] }
  ): Promise<IServerResponse<ITask>> => {
    const url = `${rootUrl}/${id}`;
    const response = await apiClient.put<IServerResponse<ITask>>(`${url}`, body);
    return response.data;
  },
  deleteTemplate: async (id: string): Promise<IServerResponse<ITask>> => {
    const url = `${rootUrl}/${id}`;
    const response = await apiClient.delete<IServerResponse<ITask>>(`${url}`);
    return response.data;
  },
  importTemplate: async (id: string, body: IProjectTask[]): Promise<IServerResponse<ITask>> => {
    const url = `${rootUrl}/import/${id}`;
    const response = await apiClient.post<IServerResponse<ITask>>(`${url}`, body);
    return response.data;
  },
};
