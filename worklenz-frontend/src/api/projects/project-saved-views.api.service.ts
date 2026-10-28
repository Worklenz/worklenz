import apiClient from '@api/api-client';
import { API_BASE_URL } from '@/shared/constants';
import { IServerResponse } from '@/types/common.types';
import {
  ICreateSavedViewBody,
  IProjectSavedView,
  IUpdateSavedViewBody,
} from '@/types/project/project-saved-views.types';

const rootUrl = `${API_BASE_URL}/projects`;

const projectSavedViewsApiService = {
  list: async (projectId: string): Promise<IServerResponse<IProjectSavedView[]>> => {
    const response = await apiClient.get<IServerResponse<IProjectSavedView[]>>(
      `${rootUrl}/${projectId}/saved-views`
    );
    return response.data;
  },

  create: async (
    projectId: string,
    body: ICreateSavedViewBody
  ): Promise<IServerResponse<IProjectSavedView>> => {
    const response = await apiClient.post<IServerResponse<IProjectSavedView>>(
      `${rootUrl}/${projectId}/saved-views`,
      body
    );
    return response.data;
  },

  update: async (
    projectId: string,
    viewId: string,
    body: IUpdateSavedViewBody
  ): Promise<IServerResponse<IProjectSavedView>> => {
    const response = await apiClient.put<IServerResponse<IProjectSavedView>>(
      `${rootUrl}/${projectId}/saved-views/${viewId}`,
      body
    );
    return response.data;
  },

  delete: async (projectId: string, viewId: string): Promise<IServerResponse<null>> => {
    const response = await apiClient.delete<IServerResponse<null>>(
      `${rootUrl}/${projectId}/saved-views/${viewId}`
    );
    return response.data;
  },
};

export default projectSavedViewsApiService;
