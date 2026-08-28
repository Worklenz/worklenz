import { IClient, IClientsViewModel } from '@/types/client.types';
import apiClient from '@api/api-client';
import { API_BASE_URL } from '@/shared/constants';
import { IServerResponse } from '@/types/common.types';
import { toQueryString } from '@/utils/toQueryString';

const rootUrl = `${API_BASE_URL}/clients`;

export const clientsApiService = {
  // Lightweight lookup for filter dropdowns — returns {id, name} for all clients
  // in the current team. Supports server-side search via the optional `search` param
  // so the result is never capped to an arbitrary page size.
  async getClientsLookup(search?: string): Promise<IServerResponse<IClient[]>> {
    const params: Record<string, string> = {};
    if (search && search.trim()) params['search'] = search.trim();
    const queryString = Object.keys(params).length ? toQueryString(params) : '';
    const response = await apiClient.get<IServerResponse<IClient[]>>(
      `${rootUrl}/lookup${queryString}`
    );
    return response.data;
  },

  // Get all clients
  async getClients(
    index: number,
    size: number,
    field: string | null,
    order: string | null,
    search?: string | null
  ): Promise<IServerResponse<IClientsViewModel>> {
    const queryString = toQueryString({ index, size, field, order, search: search || '' });
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
