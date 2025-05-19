import apiClient from '@api/api-client';
import { API_BASE_URL } from '@/shared/constants';
import { IServerResponse } from '@/types/common.types';
import { IJobTitle, IJobTitlesViewModel } from '@/types/job.types';
import { toQueryString } from '@/utils/toQueryString';

type IRatecard = {
  id: string;}
type IRatecardViewModel = {
  id: string;}

const rootUrl = `${API_BASE_URL}/rate-cards`;

export const rateCardApiService = {
    async getRateCards(
    index: number,
    size: number,
    field: string | null,
    order: string | null,
    search?: string | null
  ): Promise<IServerResponse<IRatecardViewModel>> {
    const s = encodeURIComponent(search || '');
    const queryString = toQueryString({ index, size, field, order, search: s });
    const response = await apiClient.get<IServerResponse<IRatecardViewModel>>(
      `${rootUrl}${queryString}`
    );
    return response.data;
  },
  async getRateCardById(id: string): Promise<IServerResponse<IRatecard>> {
    const response = await apiClient.get<IServerResponse<IRatecard>>(`${rootUrl}/${id}`);
    return response.data;
  },

  async createRateCard(body: IRatecard): Promise<IServerResponse<IRatecard>> {
    const response = await apiClient.post<IServerResponse<IRatecard>>(rootUrl, body);
    return response.data;
  },

  async updateRateCard(id: string, body: IRatecard): Promise<IServerResponse<IRatecard>> {
    const response = await apiClient.put<IServerResponse<IRatecard>>(`${rootUrl}/${id}`, body);
    return response.data;
  },

  async deleteRateCard(id: string): Promise<IServerResponse<void>> {
    const response = await apiClient.delete<IServerResponse<void>>(`${rootUrl}/${id}`);
    return response.data;
  },

};