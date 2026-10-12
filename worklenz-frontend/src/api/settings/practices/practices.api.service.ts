import apiClient from '@api/api-client';
import { API_BASE_URL } from '@/shared/constants';
import { IServerResponse } from '@/types/common.types';
import { IPractice, IPracticesViewModel } from '@/types/practice.types';
import { toQueryString } from '@/utils/toQueryString';

const rootUrl = `${API_BASE_URL}/practices`;

export const practicesApiService = {
  async getPractices(
    index: number,
    size: number,
    field: string | null,
    order: string | null,
    search?: string | null
  ): Promise<IServerResponse<IPracticesViewModel>> {
    const s = encodeURIComponent(search || '');
    const queryString = toQueryString({ index, size, field, order, search: s });
    const response = await apiClient.get<IServerResponse<IPracticesViewModel>>(
      `${rootUrl}${queryString}`
    );
    return response.data;
  },

  async createPractice(body: IPractice): Promise<IServerResponse<IPractice>> {
    const response = await apiClient.post<IServerResponse<IPractice>>(rootUrl, body);
    return response.data;
  },

  async getPracticeById(id: string): Promise<IServerResponse<IPractice>> {
    const response = await apiClient.get<IServerResponse<IPractice>>(`${rootUrl}/${id}`);
    return response.data;
  },

  async updatePractice(id: string, body: IPractice): Promise<IServerResponse<IPractice>> {
    const response = await apiClient.put<IServerResponse<IPractice>>(`${rootUrl}/${id}`, body);
    return response.data;
  },

  async deletePractice(id: string): Promise<IServerResponse<null>> {
    const response = await apiClient.delete<IServerResponse<null>>(`${rootUrl}/${id}`);
    return response.data;
  },
};
