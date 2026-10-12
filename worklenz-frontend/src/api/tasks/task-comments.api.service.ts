import apiClient from '@api/api-client';
import { API_BASE_URL } from '@/shared/constants';
import { IServerResponse } from '@/types/common.types';
import { toQueryString } from '@/utils/toQueryString';
import {
  ITaskComment,
  ITaskCommentsCreateRequest,
  ITaskCommentViewModel,
} from '@/types/tasks/task-comments.types';

const taskCommentsApiService = {
  create: async (
    data: ITaskCommentsCreateRequest
  ): Promise<IServerResponse<ITaskCommentsCreateRequest>> => {
    const response = await apiClient.post(`${API_BASE_URL}/task-comments`, data);
    return response.data;
  },

  getByTaskId: async (id: string): Promise<IServerResponse<ITaskCommentViewModel[]>> => {
    const response = await apiClient.get(`${API_BASE_URL}/task-comments/${id}`);
    return response.data;
  },

  resolveShortLink: async (
    commentId: string
  ): Promise<IServerResponse<{ comment_id: string; task_id: string; project_id: string }>> => {
    const response = await apiClient.get(`${API_BASE_URL}/task-comments/resolve/${commentId}`);
    return response.data;
  },

  update: async (id: string, body: ITaskComment): Promise<IServerResponse<ITaskComment>> => {
    const response = await apiClient.put(`${API_BASE_URL}/task-comments/${id}`, body);
    return response.data;
  },

  deleteAttachment: async (id: string, taskId: string): Promise<IServerResponse<ITaskComment>> => {
    const response = await apiClient.delete(
      `${API_BASE_URL}/task-comments/attachment/${id}/${taskId}`
    );
    return response.data;
  },

  download: async (
    id: string,
    filename: string
  ): Promise<IServerResponse<{ url: string; expires_in: number } | string>> => {
    const response = await apiClient.get<
      IServerResponse<{ url: string; expires_in: number } | string>
    >(`${API_BASE_URL}/task-comments/download?id=${id}&file=${encodeURIComponent(filename)}`);
    return response.data;
  },

  delete: async (id: string, taskId: string): Promise<IServerResponse<ITaskComment>> => {
    const response = await apiClient.delete(`${API_BASE_URL}/task-comments/${id}/${taskId}`);
    return response.data;
  },

  updateReaction: async (
    id: string,
    body: { reaction_type: string; task_id: string }
  ): Promise<IServerResponse<ITaskComment>> => {
    const response = await apiClient.put(
      `${API_BASE_URL}/task-comments/reaction/${id}${toQueryString(body)}`
    );
    return response.data;
  },
};

export default taskCommentsApiService;
