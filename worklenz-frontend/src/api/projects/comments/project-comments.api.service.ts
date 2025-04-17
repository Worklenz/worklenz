import { IServerResponse } from '@/types/common.types';
import apiClient from '@/api/api-client';
import { API_BASE_URL } from '@/shared/constants';

import {
  IMentionMemberSelectOption,
  IMentionMemberViewModel,
  IProjectCommentsCreateRequest,
} from '@/types/project/projectComments.types';
import { toQueryString } from '@/utils/toQueryString';
import { IProjectUpdateCommentViewModel } from '@/types/project/project.types';

const rootUrl = `${API_BASE_URL}/project-comments`;

export const projectCommentsApiService = {
  createProjectComment: async (
    body: IProjectCommentsCreateRequest
  ): Promise<IServerResponse<IProjectCommentsCreateRequest>> => {
    const url = `${rootUrl}`;
    const response = await apiClient.post<IServerResponse<IProjectCommentsCreateRequest>>(
      `${url}`,
      body
    );
    return response.data;
  },

  getMentionMembers: async (
    projectId: string,
    index: number,
    size: number,
    field: string | null,
    order: string | null,
    search: string | null
  ): Promise<IServerResponse<IMentionMemberViewModel[]>> => {
    const s = encodeURIComponent(search || '');
    const url = `${rootUrl}/project-members/${projectId}${toQueryString({ index, size, field, order, search: s })}`;
    const response = await apiClient.get<IServerResponse<IMentionMemberViewModel[]>>(`${url}`);
    return response.data;
  },

  getCountByProjectId: async (projectId: string): Promise<IServerResponse<number>> => {
    const url = `${rootUrl}/${projectId}/comments/count`;
    const response = await apiClient.get<IServerResponse<number>>(`${url}`);
    return response.data;
  },

  getByProjectId: async (
    projectId: string,
    isLimit: boolean = false
  ): Promise<IServerResponse<IProjectUpdateCommentViewModel[]>> => {
    const url = `${rootUrl}/project-comments/${projectId}${toQueryString({ latest: isLimit })}`;
    const response = await apiClient.get<IServerResponse<IProjectUpdateCommentViewModel[]>>(
      `${url}`
    );
    return response.data;
  },

  deleteComment: async (commentId: string): Promise<IServerResponse<string>> => {
    const url = `${rootUrl}/delete/${commentId}`;
    const response = await apiClient.delete<IServerResponse<string>>(`${url}`);
    return response.data;
  },
};
