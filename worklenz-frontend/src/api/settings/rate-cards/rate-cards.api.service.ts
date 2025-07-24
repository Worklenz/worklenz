import apiClient from '@api/api-client';
import { API_BASE_URL } from '@/shared/constants';
import { IServerResponse } from '@/types/common.types';
import { toQueryString } from '@/utils/toQueryString';
import { RatecardType, IRatecardViewModel } from '@/types/project/ratecard.types';

type IRatecard = {
  id: string;
};

const rootUrl = `${API_BASE_URL}/ratecard`;

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
  async getRateCardById(id: string): Promise<IServerResponse<RatecardType>> {
    const response = await apiClient.get<IServerResponse<RatecardType>>(`${rootUrl}/${id}`);
    return response.data;
  },

  async createRateCard(body: RatecardType): Promise<IServerResponse<RatecardType>> {
    const response = await apiClient.post<IServerResponse<RatecardType>>(rootUrl, body);
    return response.data;
  },

  async updateRateCard(id: string, body: RatecardType): Promise<IServerResponse<RatecardType>> {
    const response = await apiClient.put<IServerResponse<RatecardType>>(`${rootUrl}/${id}`, body);
    return response.data;
  },

  async deleteRateCard(id: string): Promise<IServerResponse<void>> {
    const response = await apiClient.delete<IServerResponse<void>>(`${rootUrl}/${id}`);
    return response.data;
  },
};
