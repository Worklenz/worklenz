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
import {
  IInboxProjectConversation,
  IPinnedProjectComment,
} from '@/types/home/inbox.types';

const rootUrl = `${API_BASE_URL}/project-comments`;
const reactionsUrl = `${API_BASE_URL}/project-comment-reactions`;

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

  uploadCommentAttachment: async (
    projectId: string,
    fileData: string,
    fileName: string,
    fileType: string
  ): Promise<IServerResponse<{ name: string; url: string; key: string; type?: string; size?: number }>> => {
    const url = `${rootUrl}/attachment/upload`;
    const response = await apiClient.post<
      IServerResponse<{ name: string; url: string; key: string; type?: string; size?: number }>
    >(url, { project_id: projectId, fileData, fileName, fileType });
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
    const url = `${rootUrl}/project-members/${projectId}${toQueryString({ index, size, field, order, search: search || '' })}`;
    const response = await apiClient.get<IServerResponse<IMentionMemberViewModel[]>>(`${url}`);
    return response.data;
  },

  getCountByProjectId: async (projectId: string): Promise<IServerResponse<number>> => {
    const url = `${rootUrl}/comments-count/${projectId}`;
    const response = await apiClient.get<IServerResponse<number>>(`${url}`);
    return response.data;
  },

  // Inbox
  getInboxConversations: async (): Promise<IServerResponse<IInboxProjectConversation[]>> => {
    const url = `${rootUrl}/inbox/conversations`;
    const response = await apiClient.get<IServerResponse<IInboxProjectConversation[]>>(`${url}`);
    return response.data;
  },

  markConversationRead: async (projectId: string): Promise<IServerResponse<any>> => {
    const url = `${rootUrl}/read/${projectId}`;
    const response = await apiClient.put<IServerResponse<any>>(`${url}`, {});
    return response.data;
  },

  // Pinned messages
  setPinned: async (
    commentId: string,
    projectId: string,
    pinned: boolean
  ): Promise<IServerResponse<any>> => {
    const url = `${rootUrl}/pin/${commentId}`;
    const response = await apiClient.put<IServerResponse<any>>(`${url}`, {
      project_id: projectId,
      pinned,
    });
    return response.data;
  },

  getPinnedByProjectId: async (
    projectId: string
  ): Promise<IServerResponse<IPinnedProjectComment[]>> => {
    const url = `${rootUrl}/pinned/${projectId}`;
    const response = await apiClient.get<IServerResponse<IPinnedProjectComment[]>>(`${url}`);
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

  // Reactions
  addReaction: async (commentId: string, emoji: string): Promise<IServerResponse<any>> => {
    const url = `${reactionsUrl}/reactions/add`;
    const response = await apiClient.post<IServerResponse<any>>(`${url}`, {
      comment_id: commentId,
      emoji,
    });
    return response.data;
  },

  removeReaction: async (commentId: string, emoji: string): Promise<IServerResponse<any>> => {
    const url = `${reactionsUrl}/reactions/remove`;
    const response = await apiClient.post<IServerResponse<any>>(`${url}`, {
      comment_id: commentId,
      emoji,
    });
    return response.data;
  },

  getReactions: async (commentId: string): Promise<IServerResponse<any>> => {
    const url = `${reactionsUrl}/reactions/${commentId}`;
    const response = await apiClient.get<IServerResponse<any>>(`${url}`);
    return response.data;
  },

  // Editing
  editComment: async (commentId: string, content: string): Promise<IServerResponse<any>> => {
    const url = `${reactionsUrl}/edit`;
    const response = await apiClient.put<IServerResponse<any>>(`${url}`, {
      comment_id: commentId,
      content,
    });
    return response.data;
  },

  getEditHistory: async (commentId: string): Promise<IServerResponse<any>> => {
    const url = `${reactionsUrl}/edit-history/${commentId}`;
    const response = await apiClient.get<IServerResponse<any>>(`${url}`);
    return response.data;
  },
};
