import apiClient from '@api/api-client';
import { API_BASE_URL } from '@/shared/constants';
import { IServerResponse } from '@/types/common.types';
import { IJobTitle, IJobTitlesViewModel } from '@/types/job.types';
import { toQueryString } from '@/utils/toQueryString';

const rootUrl = `${API_BASE_URL}/job-titles`;

export const jobTitlesApiService = {
  async getJobTitles(
    index: number,
    size: number,
    field: string | null,
    order: string | null,
    search?: string | null
  ): Promise<IServerResponse<IJobTitlesViewModel>> {
    const s = encodeURIComponent(search || '');
    const queryString = toQueryString({ index, size, field, order, search: s });
    const response = await apiClient.get<IServerResponse<IJobTitlesViewModel>>(
      `${rootUrl}${queryString}`
    );
    return response.data;
  },

  async getJobTitleById(id: string): Promise<IServerResponse<IJobTitle>> {
    const response = await apiClient.get<IServerResponse<IJobTitle>>(`${rootUrl}/${id}`);
    return response.data;
  },

  async createJobTitle(body: IJobTitle): Promise<IServerResponse<IJobTitle>> {
    const response = await apiClient.post<IServerResponse<IJobTitle>>(rootUrl, body);
    return response.data;
  },

  async updateJobTitle(id: string, body: IJobTitle): Promise<IServerResponse<IJobTitle>> {
    const response = await apiClient.put<IServerResponse<IJobTitle>>(`${rootUrl}/${id}`, body);
    return response.data;
  },

  async deleteJobTitle(id: string): Promise<IServerResponse<void>> {
    const response = await apiClient.delete<IServerResponse<void>>(`${rootUrl}/${id}`);
    return response.data;
  },
};
