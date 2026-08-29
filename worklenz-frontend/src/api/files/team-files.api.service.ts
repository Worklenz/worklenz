import apiClient from '../api-client';
import { API_BASE_URL } from '@/shared/constants';
import { IServerResponse } from '@/types/common.types';
import { toQueryString } from '@/utils/toQueryString';

const rootUrl = `${API_BASE_URL}/team-files`;

export interface ITeamFilesListParams {
  page?: number;
  size?: number;
  search?: string;
  project_id?: string;
  file_type?: string;
  uploaded_by?: string;
}

export interface ITeamProjectFileRow {
  id: string;
  name: string;
  size: number;
  type: string;
  created_at: string;
  project_id: string;
  project_name: string;
  project_color: string;
  uploaded_by?: string;
  uploaded_by_id?: string;
}

export interface ITeamTaskAttachmentRow {
  id: string;
  name: string;
  size: number;
  type: string;
  created_at: string;
  project_id: string;
  project_name: string;
  project_color: string;
  task_id?: string;
  task_name?: string;
  task_key?: string;
  uploaded_by?: string;
  uploaded_by_id?: string;
}

export interface ITeamProjectLinkRow {
  id: string;
  title: string;
  url: string;
  description?: string;
  source_type: 'manual' | 'task_description' | 'task_comment';
  source_task_id?: string;
  source_task_name?: string;
  source_task_key?: string;
  project_id: string;
  project_name: string;
  project_color: string;
  added_by_name?: string;
  added_by_id?: string;
  created_at: string;
  updated_at: string;
}

interface IListResponse<T> {
  total: number;
  data: T[];
}

export const teamFilesApiService = {
  getProjectFiles: async (
    params: ITeamFilesListParams
  ): Promise<IServerResponse<IListResponse<ITeamProjectFileRow>>> => {
    const response = await apiClient.get(`${rootUrl}/project-files${toQueryString(params)}`);
    return response.data;
  },

  getTaskAttachments: async (
    params: ITeamFilesListParams
  ): Promise<IServerResponse<IListResponse<ITeamTaskAttachmentRow>>> => {
    const response = await apiClient.get(`${rootUrl}/task-attachments${toQueryString(params)}`);
    return response.data;
  },

  getLinks: async (
    params: ITeamFilesListParams
  ): Promise<IServerResponse<IListResponse<ITeamProjectLinkRow>>> => {
    const response = await apiClient.get(`${rootUrl}/links${toQueryString(params)}`);
    return response.data;
  },
};

export default teamFilesApiService;
