import apiClient from '@api/api-client';
import { API_BASE_URL } from '@/shared/constants';
import { IServerResponse } from '@/types/common.types';
import { IDepartment, IDepartmentsViewModel } from '@/types/department.types';
import { toQueryString } from '@/utils/toQueryString';

const rootUrl = `${API_BASE_URL}/departments`;

export const departmentsApiService = {
  async getDepartments(
    index: number,
    size: number,
    field: string | null,
    order: string | null,
    search?: string | null
  ): Promise<IServerResponse<IDepartmentsViewModel>> {
    const s = encodeURIComponent(search || '');
    const queryString = toQueryString({ index, size, field, order, search: s });
    const response = await apiClient.get<IServerResponse<IDepartmentsViewModel>>(
      `${rootUrl}${queryString}`
    );
    return response.data;
  },

  async createDepartment(body: IDepartment): Promise<IServerResponse<IDepartment>> {
    const response = await apiClient.post<IServerResponse<IDepartment>>(rootUrl, body);
    return response.data;
  },

  async getDepartmentById(id: string): Promise<IServerResponse<IDepartment>> {
    const response = await apiClient.get<IServerResponse<IDepartment>>(`${rootUrl}/${id}`);
    return response.data;
  },

  async updateDepartment(id: string, body: IDepartment): Promise<IServerResponse<IDepartment>> {
    const response = await apiClient.put<IServerResponse<IDepartment>>(`${rootUrl}/${id}`, body);
    return response.data;
  },

  async deleteDepartment(id: string): Promise<IServerResponse<null>> {
    const response = await apiClient.delete<IServerResponse<null>>(`${rootUrl}/${id}`);
    return response.data;
  },
};
