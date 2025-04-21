import { IServerResponse } from '@/types/common.types';
import { API_BASE_URL } from '@/shared/constants';
import { IProjectCategory, IProjectCategoryViewModel } from '@/types/project/projectCategory.types';
import apiClient from '@api/api-client';

const rootUrl = `${API_BASE_URL}/project-categories`;

export const categoriesApiService = {
  getCategories: async (): Promise<IServerResponse<IProjectCategoryViewModel[]>> => {
    const response = await apiClient.get<IServerResponse<IProjectCategoryViewModel[]>>(rootUrl);
    return response.data;
  },

  getCategoriesByTeam: async (
    id: string
  ): Promise<IServerResponse<IProjectCategoryViewModel[]>> => {
    const response = await apiClient.get<IServerResponse<IProjectCategoryViewModel[]>>(
      `${rootUrl}/${id}`
    );
    return response.data;
  },

  getCategoriesByOrganization: async (): Promise<IServerResponse<IProjectCategoryViewModel[]>> => {
    const response = await apiClient.get<IServerResponse<IProjectCategoryViewModel[]>>(
      `${rootUrl}/org-categories`
    );
    return response.data;
  },

  createCategory: async (
    category: Partial<IProjectCategory>
  ): Promise<IServerResponse<IProjectCategoryViewModel>> => {
    const response = await apiClient.post<IServerResponse<IProjectCategoryViewModel>>(
      rootUrl,
      category
    );
    return response.data;
  },

  updateCategory: async (
    category: IProjectCategoryViewModel
  ): Promise<IServerResponse<IProjectCategoryViewModel>> => {
    const response = await apiClient.put<IServerResponse<IProjectCategoryViewModel>>(
      `${rootUrl}/${category.id}`,
      category
    );
    return response.data;
  },

  deleteCategory: async (id: string): Promise<IServerResponse<string>> => {
    const response = await apiClient.delete<IServerResponse<string>>(`${rootUrl}/${id}`);
    return response.data;
  },
};
