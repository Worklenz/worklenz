import apiClient from '@/api/api-client';
import { API_BASE_URL } from '@/shared/constants';
import { IServerResponse } from '@/types/common.types';
import {
  ITeamDocumentSearchResult,
  ITeamDocumentSummary,
} from '@/types/project/project-documents.types';
import { toQueryString } from '@/utils/toQueryString';

const rootUrl = `${API_BASE_URL}/team-documents`;
const silentHeaders = { headers: { 'X-Silent-Request': '1' } };

export const teamDocumentsApiService = {
  list: async (): Promise<IServerResponse<ITeamDocumentSummary[]>> => {
    const response = await apiClient.get<IServerResponse<ITeamDocumentSummary[]>>(rootUrl, silentHeaders);
    return response.data;
  },

  favorites: async (): Promise<IServerResponse<string[]>> => {
    const response = await apiClient.get<IServerResponse<string[]>>(`${rootUrl}/favorites`, silentHeaders);
    return response.data;
  },

  search: async (query: string): Promise<IServerResponse<ITeamDocumentSearchResult[]>> => {
    const response = await apiClient.get<IServerResponse<ITeamDocumentSearchResult[]>>(
      `${rootUrl}/search${toQueryString({ q: query })}`,
      silentHeaders
    );
    return response.data;
  },
};
