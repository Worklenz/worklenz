import { API_BASE_URL } from '@/shared/constants';
import { IServerResponse } from '@/types/common.types';
import apiClient from '../api-client';
import { toQueryString } from '@/utils/toQueryString';
import { IUpgradeSubscriptionPlanResponse } from '@/types/admin-center/admin-center.types';

const rootUrl = `${API_BASE_URL}/billing`;
export const billingApiService = {
  async upgradeToPaidPlan(
    plan: string,
    seatCount: number
  ): Promise<IServerResponse<IUpgradeSubscriptionPlanResponse>> {
    const q = toQueryString({ plan, seatCount });
    const response = await apiClient.get<IServerResponse<any>>(
      `${rootUrl}/upgrade-to-paid-plan${q}`
    );
    return response.data;
  },

  async purchaseMoreSeats(
    seatCount: number
  ): Promise<IServerResponse<IUpgradeSubscriptionPlanResponse>> {
    const response = await apiClient.post<IServerResponse<IUpgradeSubscriptionPlanResponse>>(
      `${rootUrl}/purchase-more-seats`,
      { seatCount }
    );
    return response.data;
  },

  async contactUs(contactNo: string): Promise<IServerResponse<any>> {
    const response = await apiClient.get<IServerResponse<any>>(
      `${rootUrl}/contact-us${toQueryString({ contactNo })}`
    );
    return response.data;
  },
};
