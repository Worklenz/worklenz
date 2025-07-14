import { IServerResponse } from '@/types/common.types';
import { IProjectAttachmentsViewModel } from '@/types/tasks/task-attachment-view-model';
import apiClient from '../api-client';
import { API_BASE_URL } from '@/shared/constants';
import { toQueryString } from '@/utils/toQueryString';

const rootUrl = `${API_BASE_URL}/attachments`;

export const attachmentsApiService = {
  getTaskAttachments: async (
    taskId: string
  ): Promise<IServerResponse<IProjectAttachmentsViewModel>> => {
    const response = await apiClient.get<IServerResponse<IProjectAttachmentsViewModel>>(
      `${rootUrl}/tasks/${taskId}`
    );
    return response.data;
  },

  getProjectAttachments: async (
    projectId: string,
    index: number,
    size: number
  ): Promise<IServerResponse<IProjectAttachmentsViewModel>> => {
    const q = toQueryString({ index, size });
    const response = await apiClient.get<IServerResponse<IProjectAttachmentsViewModel>>(
      `${rootUrl}/project/${projectId}${q}`
    );
    return response.data;
  },

  downloadAttachment: async (id: string, filename: string): Promise<IServerResponse<string>> => {
    const response = await apiClient.get<IServerResponse<string>>(
      `${rootUrl}/download?id=${id}&file=${filename}`
    );
    return response.data;
  },

  deleteAttachment: async (id: string): Promise<IServerResponse<string>> => {
    const response = await apiClient.delete<IServerResponse<string>>(`${rootUrl}/tasks/${id}`);
    return response.data;
  },
};
