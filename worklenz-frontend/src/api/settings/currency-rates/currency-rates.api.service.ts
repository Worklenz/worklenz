import apiClient from '@api/api-client';
import { API_BASE_URL } from '@/shared/constants';
import { IServerResponse } from '@/types/common.types';

export interface ICurrencyRatesResponse {
  base: string;
  rates: Record<string, number>;
  date: string;
  cached: boolean;
  fetched_at: string;
}

const rootUrl = `${API_BASE_URL}/settings`;

export const currencyRatesApiService = {
  /**
   * Fetch live exchange rates relative to the given base currency.
   * Results are cached server-side for 1 hour.
   */
  getRates: async (base: string = 'USD'): Promise<IServerResponse<ICurrencyRatesResponse>> => {
    const response = await apiClient.get<IServerResponse<ICurrencyRatesResponse>>(
      `${rootUrl}/currency-rates`,
      { params: { base: base.toUpperCase() } }
    );
    return response.data;
  },
};
