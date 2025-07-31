import { IServerResponse } from '@/types/common.types';
import {
  IProjectAttachmentsViewModel,
  ITaskAttachment,
  ITaskAttachmentViewModel,
} from '@/types/tasks/task-attachment-view-model';
import apiClient from '../api-client';
import { API_BASE_URL } from '@/shared/constants';
import { IAvatarAttachment } from '@/types/avatarAttachment.types';
import { toQueryString } from '@/utils/toQueryString';

const rootUrl = `${API_BASE_URL}/attachments`;

const taskAttachmentsApiService = {
  createTaskAttachment: async (
    body: ITaskAttachment
  ): Promise<IServerResponse<ITaskAttachmentViewModel>> => {
    const response = await apiClient.post(`${rootUrl}/tasks`, body);
    return response.data;
  },

  createAvatarAttachment: async (
    body: IAvatarAttachment
  ): Promise<IServerResponse<{ url: string }>> => {
    const response = await apiClient.post(`${rootUrl}/avatar`, body);
    return response.data;
  },

  getTaskAttachments: async (
    taskId: string
  ): Promise<IServerResponse<ITaskAttachmentViewModel[]>> => {
    const response = await apiClient.get(`${rootUrl}/tasks/${taskId}`);
    return response.data;
  },

  getProjectAttachments: async (
    projectId: string,
    index: number,
    size: number
  ): Promise<IServerResponse<IProjectAttachmentsViewModel>> => {
    const q = toQueryString({ index, size });
    const response = await apiClient.get(`${rootUrl}/project/${projectId}${q}`);
    return response.data;
  },

  deleteTaskAttachment: async (attachmentId: string): Promise<IServerResponse<void>> => {
    const response = await apiClient.delete(`${rootUrl}/tasks/${attachmentId}`);
    return response.data;
  },

  downloadTaskAttachment: async (id: string, filename: string): Promise<IServerResponse<any>> => {
    const response = await apiClient.get(`${rootUrl}/download?id=${id}&file=${filename}`);
    return response.data;
  },
};

export default taskAttachmentsApiService;
