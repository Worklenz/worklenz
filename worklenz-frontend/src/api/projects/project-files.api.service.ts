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
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: event => {
          if (!onProgress || !event.total) return;
          const percent = Math.round((event.loaded / event.total) * 100);
          onProgress(percent);
        },
      }
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
