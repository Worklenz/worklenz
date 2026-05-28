import { API_BASE_URL } from '@/shared/constants';
import { IServerResponse } from '@/types/common.types';
import apiClient from '../api-client';
import { toQueryString } from '@/utils/toQueryString';
import {
  IUpgradeSubscriptionPlanResponse,
  IPricingOption,
} from '@/types/admin-center/admin-center.types';

export interface ILkrPayment {
  id: string;
  created_at: string;
  transaction_amount: number | null;
  amount: number | null;
  transaction_currency: string | null;
  transaction_status: string | null;
  status: string | null;
  transaction_id: string | null;
  order_id: string | null;
  payment_type: string | null;
  card_number: string | null;
}

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

  /**
   * Check user's region based on IP address to determine LKR pricing eligibility.
   * Returns null for isLkrEligible if IP detection fails (triggers timezone fallback).
   */
  async checkRegion(): Promise<
    IServerResponse<{
      isLkrEligible: boolean | null;
      country: string;
      countryCode: string | null;
      ip?: string;
      error?: string;
    }>
  > {
    const response = await apiClient.get<
      IServerResponse<{
        isLkrEligible: boolean | null;
        country: string;
        countryCode: string | null;
        ip?: string;
        error?: string;
      }>
    >(`${rootUrl}/check-region`);
    return response.data;
  },

  /**
   * Get LKR (local) pricing for Free, Pro, and Business plans.
   * This is a simplified endpoint used by the LKR upgrade modal.
   */
  async getLkrPricing(): Promise<
    IServerResponse<{
      free: { display_name: string; price: number };
      pro: { display_name: string; price: number };
      business: { display_name: string; price: number };
    }>
  > {
    const response = await apiClient.get<
      IServerResponse<{
        free: { display_name: string; price: number };
        pro: { display_name: string; price: number };
        business: { display_name: string; price: number };
      }>
    >(`${rootUrl}/lkr-pricing`);
    return response.data;
  },

  /**
   * Create DirectPay card add session for tokenization
   * @param amount Optional amount for initial payment (default: 10.00)
   * @param doInitialPayment Whether to collect payment during card add (default: false)
   */
  async createCardAddSession(
    amount?: number,
    doInitialPayment?: boolean,
    plan?: string
  ): Promise<
    IServerResponse<{
      sessionData?: any;
      stage: string;
      existingCard?: {
        card_id: string;
        wallet_id: string;
        card_number_masked: string;
        card_brand: string;
        expiry_month: string;
        expiry_year: string;
      };
    }>
  > {
    const response = await apiClient.post<
      IServerResponse<{
        sessionData?: any;
        stage: string;
        existingCard?: {
          card_id: string;
          wallet_id: string;
          card_number_masked: string;
          card_brand: string;
          expiry_month: string;
          expiry_year: string;
        };
      }>
    >(`${rootUrl}/directpay/create-card-session`, {
      amount,
      doInitialPayment,
      ...(plan ? { plan } : {}),
    });
    return response.data;
  },

  /**
   * Create a CARD_TOKEN_PAYMENT session for 3DS payment with a stored card.
   */
  async createTokenPaymentSession(
    walletId: string,
    cardId: string,
    amount: number,
    currency: string = 'LKR',
    cvv?: string
  ): Promise<
    IServerResponse<{
      sessionData: any;
      stage: string;
      orderId: string;
    }>
  > {
    const response = await apiClient.post<
      IServerResponse<{
        sessionData: any;
        stage: string;
        orderId: string;
      }>
    >(`${rootUrl}/directpay/create-token-payment-session`, {
      wallet_id: walletId,
      card_id: cardId,
      amount,
      currency,
      ...(cvv ? { cvv } : {}),
    });
    return response.data;
  },

  /**
   * Persist a DirectPay SDK card-add response when the browser receives the full payload.
   * The server webhook remains the source of truth for return URL-only responses.
   */
  async saveDirectPayCardResponse(responsePayload: any): Promise<IServerResponse<any>> {
    const response = await apiClient.post<IServerResponse<any>>(
      `${rootUrl}/directpay/save-card-response`,
      responsePayload
    );
    return response.data;
  },

  /**
   * List saved cards for a wallet
   * @param walletId Wallet ID from DirectPay
   */
  async listCards(): Promise<
    IServerResponse<{
      card_list: Array<{
        card_id: number;
        mask: string;
        brand: string;
        type: string;
        issuer: string;
        expiry: string;
        created_at: string;
      }>;
    }>
  > {
    const response = await apiClient.get<
      IServerResponse<{
        card_list: Array<{
          card_id: number;
          mask: string;
          brand: string;
          type: string;
          issuer: string;
          expiry: string;
          created_at: string;
        }>;
      }>
    >(`${rootUrl}/directpay/list-cards`);
    return response.data;
  },

  /**
   * Delete a saved card
   * @param cardId Card ID from DirectPay
   */
  async deleteCard(cardId: string): Promise<
    IServerResponse<{
      status: number;
      data: {
        card_id: number;
      };
    }>
  > {
    const response = await apiClient.post<
      IServerResponse<{
        status: number;
        data: {
          card_id: number;
        };
      }>
    >(`${rootUrl}/directpay/delete-card`, {
      card_id: cardId,
    });
    return response.data;
  },

  /**
   * Pay using a stored card
   * @param walletId Wallet ID from DirectPay
   * @param cardId Card ID from DirectPay
   * @param orderId Unique order reference
   * @param amount Payment amount
   * @param currency Currency code (default: LKR)
   */
  async payWithCard(
    walletId: string,
    cardId: string,
    orderId: string,
    amount: number,
    currency: string = 'LKR',
    plan?: string
  ): Promise<
    IServerResponse<{
      status: number;
      data: {
        transaction: {
          status: string;
          message: string;
          id: number;
          description: string;
          channel: string;
          dateTime: string;
          amount: number;
          promotion_amount?: string;
        };
        card: {
          number: string;
        };
        promotion: any;
      };
    }>
  > {
    const response = await apiClient.post<
      IServerResponse<{
        status: number;
        data: {
          transaction: {
            status: string;
            message: string;
            id: number;
            description: string;
            channel: string;
            dateTime: string;
            amount: number;
            promotion_amount?: string;
          };
          card: {
            number: string;
          };
          promotion: any;
        };
      }>
    >(`${rootUrl}/directpay/pay-with-card`, {
      wallet_id: walletId,
      card_id: cardId,
      order_id: orderId,
      amount: String(amount),
      currency,
      ...(plan ? { plan } : {}),
    });
    return response.data;
  },

  async getLkrPaymentHistory(): Promise<IServerResponse<{ payments: ILkrPayment[] }>> {
    const response = await apiClient.get<IServerResponse<{ payments: ILkrPayment[] }>>(
      `${rootUrl}/lkr-payment-history`
    );
    return response.data;
  },

  async downloadLkrReceipt(paymentId: string, receiptNumber: string): Promise<void> {
    const response = await apiClient.get(`${rootUrl}/lkr-receipt/${paymentId}`, {
      responseType: 'blob',
    });
    const url = URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `receipt-${receiptNumber}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  },
};
