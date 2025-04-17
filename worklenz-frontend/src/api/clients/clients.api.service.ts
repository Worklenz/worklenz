import { IClient, IClientsViewModel } from '@/types/client.types';
import apiClient from '@api/api-client';
import { API_BASE_URL } from '@/shared/constants';
import { IServerResponse } from '@/types/common.types';
import { toQueryString } from '@/utils/toQueryString';

const rootUrl = `${API_BASE_URL}/clients`;

export const clientsApiService = {
  // Get all clients
  async getClients(
    index: number,
    size: number,
    field: string | null,
    order: string | null,
    search?: string | null
  ): Promise<IServerResponse<IClientsViewModel>> {
    const s = encodeURIComponent(search || '');
    const queryString = toQueryString({ index, size, field, order, search: s });
    const response = await apiClient.get<IServerResponse<IClientsViewModel>>(
      `${rootUrl}${queryString}`
    );
    return response.data;
  },

  // Get single client by ID
  async getClientById(id: string): Promise<IServerResponse<IClient>> {
    const response = await apiClient.get<IServerResponse<IClient>>(`${rootUrl}/${id}`);
    return response.data;
  },

  // Create new client
  async createClient(body: IClient): Promise<IServerResponse<IClient>> {
    const response = await apiClient.post<IServerResponse<IClient>>(rootUrl, body);
    return response.data;
  },

  // Update existing client
  async updateClient(id: string, body: IClient): Promise<IServerResponse<IClient>> {
    const response = await apiClient.put<IServerResponse<IClient>>(`${rootUrl}/${id}`, body);
    return response.data;
  },

  // Delete client
  async deleteClient(id: string): Promise<IServerResponse<void>> {
    const response = await apiClient.delete<IServerResponse<void>>(`${rootUrl}/${id}`);
    return response.data;
  },
};
