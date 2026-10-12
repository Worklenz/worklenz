import { AxiosError } from 'axios';

import apiClient from '../api-client';
import { API_BASE_URL } from '@/shared/constants';
import {
  TaskExportAsyncCreateBody,
  TaskExportCreateResult,
  TaskExportDownloadResponse,
  TaskExportJobResponse,
  TaskExportListResponse,
  TaskExportOptionsPayload,
  TaskExportPublicJob,
} from '@/types/project/task-export.types';

const rootUrl = (projectId: string) =>
  `${API_BASE_URL}/projects/${projectId}/task-exports`;

const parseFileNameFromDisposition = (header: string | undefined): string | null => {
  if (!header) return null;
  const utfMatch = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (utfMatch?.[1]) {
    try {
      return decodeURIComponent(utfMatch[1].trim());
    } catch {
      return utfMatch[1].trim();
    }
  }
  const plainMatch = /filename="?([^";]+)"?/i.exec(header);
  return plainMatch?.[1]?.trim() || null;
};

const isJsonBlob = (blob: Blob): boolean => {
  const type = (blob.type || '').toLowerCase();
  return type.includes('application/json') || type.includes('text/json');
};

const parseErrorMessageFromBlob = async (blob: Blob): Promise<string | null> => {
  try {
    const text = await blob.text();
    const parsed = JSON.parse(text) as { message?: string };
    return parsed.message || null;
  } catch {
    return null;
  }
};

export const taskExportApiService = {
  create: async (
    projectId: string,
    options: TaskExportOptionsPayload
  ): Promise<TaskExportCreateResult> => {
    try {
      const response = await apiClient.post(rootUrl(projectId), options, {
        responseType: 'blob',
        validateStatus: status => (status >= 200 && status < 300) || status === 202,
      });

      if (response.status === 202 || isJsonBlob(response.data as Blob)) {
        const text = await (response.data as Blob).text();
        const parsed = JSON.parse(text) as {
          done?: boolean;
          message?: string;
          body?: TaskExportAsyncCreateBody | null;
        };

        if (response.status >= 400 || parsed.done === false) {
          throw new Error(parsed.message || 'Export failed');
        }

        const job = (parsed.body as TaskExportAsyncCreateBody | undefined)?.job;
        if (!job) {
          throw new Error(parsed.message || 'Export job was not created');
        }

        return { mode: 'async', job };
      }

      const blob = response.data as Blob;
      const fileName =
        parseFileNameFromDisposition(
          response.headers?.['content-disposition'] as string | undefined
        ) || 'task-export.csv';

      return { mode: 'sync', blob, fileName };
    } catch (error) {
      if (error instanceof AxiosError && error.response?.data instanceof Blob) {
        const message = await parseErrorMessageFromBlob(error.response.data);
        throw new Error(message || error.message || 'Export failed');
      }
      throw error;
    }
  },

  list: async (projectId: string): Promise<TaskExportPublicJob[]> => {
    const response = await apiClient.get<TaskExportListResponse>(rootUrl(projectId));
    return response.data.body || [];
  },

  get: async (projectId: string, jobId: string): Promise<TaskExportPublicJob> => {
    const response = await apiClient.get<TaskExportJobResponse>(
      `${rootUrl(projectId)}/${jobId}`
    );
    return response.data.body;
  },

  getDownload: async (
    projectId: string,
    jobId: string
  ): Promise<{ url: string; expires_in: number; file_name: string }> => {
    const response = await apiClient.get<TaskExportDownloadResponse>(
      `${rootUrl(projectId)}/${jobId}/download`
    );
    return response.data.body;
  },

  createFiltered: async (
    projectId: string,
    taskIds: string[]
  ): Promise<{ blob: Blob; fileName: string }> => {
    try {
      const response = await apiClient.post(
        `${rootUrl(projectId)}/filtered`,
        { task_ids: taskIds },
        { responseType: 'blob' }
      );

      const blob = response.data as Blob;
      if (isJsonBlob(blob)) {
        const message = await parseErrorMessageFromBlob(blob);
        throw new Error(message || 'Export failed');
      }

      const fileName =
        parseFileNameFromDisposition(
          response.headers?.['content-disposition'] as string | undefined
        ) || 'filtered-tasks.csv';

      return { blob, fileName };
    } catch (error) {
      if (error instanceof AxiosError && error.response?.data instanceof Blob) {
        const message = await parseErrorMessageFromBlob(error.response.data);
        throw new Error(message || error.message || 'Export failed');
      }
      throw error;
    }
  },
};

export const downloadBlobFile = (blob: Blob, fileName: string): void => {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};
