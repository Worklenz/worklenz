import { API_BASE_URL } from '@/shared/constants';
import { IServerResponse } from '@/types/common.types';
import apiClient from '../api-client';

export interface IBusinessLicenseStatus {
  isConfigured: boolean;
  isValid: boolean;
  status: string;
  licenseId: string | null;
  maxUsers: number | null;
  entitlements: string[];
  lastValidatedAt: string | null;
  graceExpiresAt: string | null;
  error: string | null;
}

export interface ISelfHostedCheckoutInfo {
  priceId: string;
  installationId: string;
  customerEmail: string | null;
}

export interface ISelfHostedManagementLinks {
  cancelUrl: string;
  updatePaymentMethodUrl: string | null;
}

const licenseRootUrl = `${API_BASE_URL}/license`;
const rootUrl = `${API_BASE_URL}/self-hosted-billing`;

export const selfHostedBillingApiService = {
  async getLicenseStatus(): Promise<IServerResponse<IBusinessLicenseStatus>> {
    const response = await apiClient.get<IServerResponse<IBusinessLicenseStatus>>(
      `${licenseRootUrl}/status`
    );
    return response.data;
  },

  async getCheckoutInfo(): Promise<IServerResponse<ISelfHostedCheckoutInfo>> {
    const response = await apiClient.get<IServerResponse<ISelfHostedCheckoutInfo>>(
      `${rootUrl}/checkout-info`
    );
    return response.data;
  },

  async activate(): Promise<IServerResponse<IBusinessLicenseStatus>> {
    const response = await apiClient.post<IServerResponse<IBusinessLicenseStatus>>(
      `${rootUrl}/activate`,
      {}
    );
    return response.data;
  },

  async getManagementLinks(): Promise<IServerResponse<ISelfHostedManagementLinks | null>> {
    const response = await apiClient.get<IServerResponse<ISelfHostedManagementLinks | null>>(
      `${rootUrl}/management-links`
    );
    return response.data;
  },
};
