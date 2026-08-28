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

interface PresignResponse {
  file_id: string;
  upload_url: string;
  expires_in: number;
}

const taskAttachmentsApiService = {
  createTaskAttachment: async (
    body: ITaskAttachment
  ): Promise<IServerResponse<ITaskAttachmentViewModel>> => {
    const response = await apiClient.post(`${rootUrl}/tasks`, body);
    return response.data;
  },

  /**
   * Step 1: Request a presigned URL for direct browser upload
   */
  presignTaskAttachment: async (
    taskId: string,
    projectId: string,
    filename: string,
    size: number,
    mimeType: string
  ): Promise<IServerResponse<PresignResponse>> => {
    const response = await apiClient.post(`${rootUrl}/tasks/presign`, {
      task_id: taskId,
      project_id: projectId,
      filename,
      size,
      mime_type: mimeType,
    });
    return response.data;
  },

  /**
   * Step 2: Upload file directly to storage using presigned URL
   * Returns progress updates via callback
   */
  uploadDirect: (
    uploadUrl: string,
    file: File,
    onProgress?: (percent: number) => void,
    signal?: AbortSignal
  ): Promise<void> => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.open('PUT', uploadUrl);
      xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');

      if (onProgress) {
        xhr.upload.addEventListener('progress', event => {
          if (event.lengthComputable) {
            onProgress(Math.round((event.loaded / event.total) * 100));
          }
        });
      }

      xhr.addEventListener('load', () => {
        // S3 returns 200, Azure returns 201 for a successful PUT
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
        } else {
          reject(new Error(`Storage upload failed with status ${xhr.status}`));
        }
      });

      xhr.addEventListener('error', () => reject(new Error('Network error during file upload')));
      xhr.addEventListener('abort', () => reject(new Error('Upload cancelled')));

      // Support AbortSignal for cancellation
      if (signal) {
        signal.addEventListener('abort', () => xhr.abort(), { once: true });
      }

      xhr.send(file);
    });
  },

  /**
   * Step 3: Confirm upload completion
   */
  confirmTaskAttachment: async (
    fileId: string,
    taskId: string
  ): Promise<IServerResponse<ITaskAttachmentViewModel>> => {
    const response = await apiClient.post(`${rootUrl}/tasks/confirm`, {
      file_id: fileId,
      task_id: taskId,
    });
    return response.data;
  },

  createAvatarAttachment: async (
    body: IAvatarAttachment
  ): Promise<IServerResponse<{ url: string; updated_at?: string }>> => {
    const response = await apiClient.post(`${rootUrl}/avatar`, body);
    return response.data;
  },

  deleteAvatarAttachment: async (): Promise<IServerResponse<{ url: null; updated_at?: string }>> => {
    const response = await apiClient.delete(`${rootUrl}/avatar`);
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

  downloadTaskAttachment: async (
    id: string,
    filename: string
  ): Promise<IServerResponse<{ url: string; expires_in: number }>> => {
    const response = await apiClient.get(
      `${rootUrl}/download?id=${id}&file=${encodeURIComponent(filename)}`
    );
    return response.data;
  },
};

export default taskAttachmentsApiService;
