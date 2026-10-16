import { isAxiosError } from 'axios';

import apiClient from '@/api/api-client';
import { API_BASE_URL } from '@/shared/constants';
import { IServerResponse } from '@/types/common.types';
import {
  ISectionDocument,
  IProjectDocument,
  IProjectDocumentBacklink,
  IProjectDocumentSearchResult,
  IProjectDocumentSummary,
  IReorderDocumentItem,
} from '@/types/project/project-documents.types';
import { toQueryString } from '@/utils/toQueryString';

const rootUrl = `${API_BASE_URL}/project-documents`;
const silentHeaders = { headers: { 'X-Silent-Request': '1' } };

export type DocumentUpdateResult =
  | { status: 'ok'; document: IProjectDocument }
  | { status: 'conflict'; document: IProjectDocument };

export const projectDocumentsApiService = {
  list: async (projectId: string): Promise<IServerResponse<IProjectDocumentSummary[]>> => {
    const response = await apiClient.get<IServerResponse<IProjectDocumentSummary[]>>(
      `${rootUrl}${toQueryString({ project_id: projectId })}`
    );
    return response.data;
  },

  getById: async (documentId: string): Promise<IServerResponse<IProjectDocument>> => {
    const response = await apiClient.get<IServerResponse<IProjectDocument>>(
      `${rootUrl}/${documentId}`,
      silentHeaders
    );
    return response.data;
  },

  create: async (
    projectId: string,
    title: string,
    parentId?: string | null
  ): Promise<IServerResponse<IProjectDocument>> => {
    const response = await apiClient.post<IServerResponse<IProjectDocument>>(
      rootUrl,
      { project_id: projectId, title, parent_id: parentId ?? null },
      silentHeaders
    );
    return response.data;
  },

  update: async (
    documentId: string,
    body: {
      expected_updated_at: string;
      title?: string;
      content?: ISectionDocument;
      parent_id?: string | null;
      position?: number;
    }
  ): Promise<DocumentUpdateResult> => {
    try {
      const response = await apiClient.put<IServerResponse<IProjectDocument>>(
        `${rootUrl}/${documentId}`,
        body,
        silentHeaders
      );
      return { status: 'ok', document: response.data.body };
    } catch (error) {
      if (isAxiosError(error) && error.response?.status === 409 && error.response.data?.body) {
        return { status: 'conflict', document: error.response.data.body as IProjectDocument };
      }
      throw error;
    }
  },

  duplicate: async (
    documentId: string,
    title: string
  ): Promise<IServerResponse<IProjectDocument>> => {
    const response = await apiClient.post<IServerResponse<IProjectDocument>>(
      `${rootUrl}/${documentId}/duplicate`,
      { title },
      silentHeaders
    );
    return response.data;
  },

  remove: async (
    documentId: string
  ): Promise<IServerResponse<{ id: string; deleted_ids: string[] }>> => {
    const response = await apiClient.delete<IServerResponse<{ id: string; deleted_ids: string[] }>>(
      `${rootUrl}/${documentId}`,
      silentHeaders
    );
    return response.data;
  },

  reorder: async (
    projectId: string,
    items: IReorderDocumentItem[]
  ): Promise<IServerResponse<IProjectDocumentSummary[]>> => {
    const response = await apiClient.put<IServerResponse<IProjectDocumentSummary[]>>(
      `${rootUrl}/reorder`,
      { project_id: projectId, items },
      silentHeaders
    );
    return response.data;
  },

  search: async (
    projectId: string,
    query: string
  ): Promise<IServerResponse<IProjectDocumentSearchResult[]>> => {
    const response = await apiClient.get<IServerResponse<IProjectDocumentSearchResult[]>>(
      `${rootUrl}/search${toQueryString({ project_id: projectId, q: query })}`,
      silentHeaders
    );
    return response.data;
  },

  taskBacklinks: async (
    taskId: string
  ): Promise<IServerResponse<IProjectDocumentBacklink[]>> => {
    const response = await apiClient.get<IServerResponse<IProjectDocumentBacklink[]>>(
      `${rootUrl}/task-backlinks/${taskId}`,
      silentHeaders
    );
    return response.data;
  },
};
