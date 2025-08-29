import { API_BASE_URL } from '@/shared/constants';
import { IServerResponse } from '@/types/common.types';
import apiClient from '../api-client';
import { toQueryString } from '@/utils/toQueryString';
import {
  IUpgradeSubscriptionPlanResponse,
  IPricingOption,
} from '@/types/admin-center/admin-center.types';

export interface IPricingPlan {
  id?: string;
  name: string;
  key: string;
  billing_type: 'month' | 'year';
  billing_period: number;
  default_currency: string;
  initial_price: number;
  recurring_price: number;
  trial_days: number;
  paddle_id: number | null;
  active?: boolean;
  is_startup_plan?: boolean;
}

export interface IPricingTierPlans {
  monthly_plan_id: string | null;
  monthly_paddle_id: number | null;
  annual_plan_id: string | null;
  annual_paddle_id: number | null;
}

export interface IPricingTierFeatures {
  max_projects: number | null;
  max_storage_gb: number | null;
  has_api_access: boolean;
  has_advanced_analytics: boolean;
  has_custom_fields: boolean;
  has_gantt_charts: boolean;
  has_time_tracking: boolean;
  has_resource_management: boolean;
  has_portfolio_view: boolean;
  has_custom_branding: boolean;
  has_sso: boolean;
  has_audit_logs: boolean;
  has_priority_support: boolean;
  has_dedicated_account_manager: boolean;
}

export interface IPricingTier {
  id: string;
  tier_name: string;
  display_name: string;
  tier_level: number;
  pricing_model: string;
  monthly_base_price: string;
  annual_base_price: string;
  monthly_per_user_price: string;
  annual_per_user_price: string;
  min_users: number | null;
  max_users: number | null;
  included_users: number | null;
  plans: IPricingTierPlans;
  features: IPricingTierFeatures;
  is_popular: boolean;
  sort_order: number;
}

const rootUrl = `${API_BASE_URL}/billing`;
export const billingApiService = {
  async upgradeToPaidPlan(
    plan: string,
    pricingModel: 'per_user' | 'regular',
    seatCount?: number
  ): Promise<IServerResponse<IUpgradeSubscriptionPlanResponse>> {
    const params: any = { plan, pricing_model: pricingModel };
    if (pricingModel === 'per_user' && seatCount) {
      params.seatCount = seatCount;
    }
    const q = toQueryString(params);
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

  async getPricingOptions(teamSize: number): Promise<IServerResponse<IPricingOption[]>> {
    const q = toQueryString({ team_size: teamSize });
    const response = await apiClient.get<IServerResponse<IPricingOption[]>>(
      `${rootUrl}/pricing-options${q}`
    );
    return response.data;
  },

  async switchPricingModel(
    pricingModel: 'per_user' | 'flat_rate',
    subscriptionId: string,
    teamSize?: number
  ): Promise<IServerResponse<any>> {
    const response = await apiClient.post<IServerResponse<any>>(`${rootUrl}/switch-pricing-model`, {
      pricing_model: pricingModel,
      subscription_id: subscriptionId,
      team_size: teamSize,
    });
    return response.data;
  },

  async getPricingPlans(): Promise<IServerResponse<{ tiers: IPricingTier[] }>> {
    const response = await apiClient.get<IServerResponse<{ tiers: IPricingTier[] }>>(
      `${rootUrl}/pricing-plans`
    );
    return response.data;
  },
};
