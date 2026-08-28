import apiClient from '@api/api-client';
import { API_BASE_URL } from '@/shared/constants';
import { IServerResponse } from '@/types/common.types';
import {
  ProjectFile,
  ProjectFilesResponse,
  ProjectFilesSortField,
  ProjectFilesSortOrder,
} from '@/types/projects/project-files.types';
import { toQueryString } from '@/utils/toQueryString';

const rootUrl = `${API_BASE_URL}/projects`;

interface ListParams {
  page: number;
  size: number;
  sort: ProjectFilesSortField;
  order: ProjectFilesSortOrder;
  search?: string;
}

interface PresignResponse {
  file_id: string;
  upload_url: string;
  expires_in: number;
}

const projectFilesApiService = {
  list: async (
    projectId: string,
    params: ListParams
  ): Promise<IServerResponse<ProjectFilesResponse>> => {
    const q = toQueryString(params);
    const response = await apiClient.get<IServerResponse<ProjectFilesResponse>>(
      `${rootUrl}/${projectId}/files${q}`
    );
    return response.data;
  },

  /**
   * Legacy synchronous upload — kept for files ≤ 25 MB (Starter plan).
   * For larger files use the presigned upload flow below.
   */
  upload: async (
    projectId: string,
    file: File,
    onProgress?: (percent: number) => void
  ): Promise<IServerResponse<ProjectFile>> => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await apiClient.post<IServerResponse<ProjectFile>>(
      `${rootUrl}/${projectId}/files`,
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: event => {
          if (!onProgress || !event.total) return;
          onProgress(Math.round((event.loaded / event.total) * 100));
        },
      }
    );

    return response.data;
  },

  // ---------------------------------------------------------------------------
  // Async presigned-URL upload (3-step flow for large files)
  // ---------------------------------------------------------------------------

  /**
   * Step 1 — Ask the backend for a presigned PUT URL.
   * No file bytes are sent to Node; only metadata.
   */
  presign: async (
    projectId: string,
    filename: string,
    size: number,
    mimeType: string
  ): Promise<IServerResponse<PresignResponse>> => {
    const response = await apiClient.post<IServerResponse<PresignResponse>>(
      `${rootUrl}/${projectId}/files/presign`,
      { filename, size, mime_type: mimeType }
    );
    return response.data;
  },

  /**
   * Step 2 — Upload the file bytes directly to S3/Azure using the presigned URL.
   * Progress is tracked via XHR so the UI can show a real progress bar.
   *
   * Returns a promise that resolves when the PUT completes (HTTP 200/204 from storage).
   * Rejects with an Error on network failure or non-2xx status.
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
   * Step 3 — Notify the backend that the upload completed.
   * The backend verifies the object exists in storage and marks the DB record active.
   */
  confirm: async (
    projectId: string,
    fileId: string
  ): Promise<IServerResponse<ProjectFile>> => {
    const response = await apiClient.post<IServerResponse<ProjectFile>>(
      `${rootUrl}/${projectId}/files/confirm`,
      { file_id: fileId }
    );
    return response.data;
  },

  download: async (
    projectId: string,
    fileId: string,
    fileName: string
  ): Promise<IServerResponse<{ url: string; expires_in: number }>> => {
    const response = await apiClient.get<IServerResponse<{ url: string; expires_in: number }>>(
      `${rootUrl}/${projectId}/files/${fileId}/download?file=${encodeURIComponent(fileName)}`
    );
    return response.data;
  },

  delete: async (projectId: string, fileId: string): Promise<IServerResponse<null>> => {
    const response = await apiClient.delete<IServerResponse<null>>(
      `${rootUrl}/${projectId}/files/${fileId}`
    );
    return response.data;
  },
};

export default projectFilesApiService;
