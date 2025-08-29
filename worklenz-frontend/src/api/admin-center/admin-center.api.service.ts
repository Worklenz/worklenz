import { IServerResponse } from '@/types/common.types';
import apiClient from '../api-client';
import { API_BASE_URL } from '@/shared/constants';
import {
  IOrganization,
  IOrganizationUser,
  IOrganizationTeam,
  IOrganizationUsersGetRequest,
  IOrganizationTeamGetRequest,
  IOrganizationProjectsGetResponse,
  IBillingConfigurationCountry,
  IBillingConfiguration,
  IBillingAccountInfo,
  IUpgradeSubscriptionPlanResponse,
  IPricingPlans,
  IBillingTransaction,
  IBillingChargesResponse,
  IStorageInfo,
  IFreePlanSettings,
  IBillingAccountStorage,
} from '@/types/admin-center/admin-center.types';
import { IOrganizationHolidaySettings } from '@/types/holiday/holiday.types';
import { IClient } from '@/types/client.types';
import { toQueryString } from '@/utils/toQueryString';

const rootUrl = `${API_BASE_URL}/admin-center`;

export interface IOrganizationUserRequestParams {
  page: number;
  pageSize: number;
  sort: string;
  order: string;
  searchTerm: string;
}

export interface IOrganizationTeamRequestParams {
  index: number;
  size: number;
  field: string | null;
  order: string | null;
  search: string | null;
}

export const adminCenterApiService = {
  async getOrganizationDetails(): Promise<IServerResponse<IOrganization>> {
    const response = await apiClient.get<IServerResponse<IOrganization>>(`${rootUrl}/organization`);
    return response.data;
  },

  async getOrganizationAdmins(): Promise<IServerResponse<IOrganizationUser[]>> {
    const response = await apiClient.get<IServerResponse<IOrganizationUser[]>>(
      `${rootUrl}/organization/admins`
    );
    return response.data;
  },

  async updateOrganizationName<T>(body: IClient): Promise<IServerResponse<IOrganization>> {
    const response = await apiClient.put<IServerResponse<IOrganization>>(
      `${rootUrl}/organization`,
      body
    );
    return response.data;
  },

  async updateOwnerContactNumber<T>(body: {
    contact_number: string;
  }): Promise<IServerResponse<IOrganization>> {
    const response = await apiClient.put<IServerResponse<IOrganization>>(
      `${rootUrl}/organization/owner/contact-number`,
      body
    );
    return response.data;
  },

  async getOrganizationUsers(
    requestParams: IOrganizationUserRequestParams
  ): Promise<IServerResponse<IOrganizationUsersGetRequest>> {
    const params = new URLSearchParams({
      index: requestParams.page.toString(),
      size: requestParams.pageSize.toString(),
      ...(requestParams.sort && { field: requestParams.sort }),
      ...(requestParams.order && { order: requestParams.order }),
      ...(requestParams.searchTerm && { search: requestParams.searchTerm }),
    });
    const response = await apiClient.get<IServerResponse<IOrganizationUsersGetRequest>>(
      `${rootUrl}/organization/users?${params}`
    );
    return response.data;
  },

  async getOrganizationTeams(
    requestParams: IOrganizationTeamRequestParams
  ): Promise<IServerResponse<IOrganizationTeamGetRequest>> {
    const params = new URLSearchParams({
      index: requestParams.index.toString(),
      size: requestParams.size.toString(),
      ...(requestParams.field && { field: requestParams.field }),
      ...(requestParams.order && { order: requestParams.order }),
      ...(requestParams.search && { search: requestParams.search }),
    });
    const response = await apiClient.get<IServerResponse<IOrganizationTeamGetRequest>>(
      `${rootUrl}/organization/teams?${params}`
    );
    return response.data;
  },

  async getOrganizationTeam(team_id: string): Promise<IServerResponse<IOrganizationTeam>> {
    const response = await apiClient.get<IServerResponse<IOrganizationTeam>>(
      `${rootUrl}/organization/team/${team_id}`
    );
    return response.data;
  },

  async updateTeam(
    team_id: string,
    body: { name: string; teamMembers: IOrganizationUser[] }
  ): Promise<IServerResponse<IOrganization>> {
    const response = await apiClient.put<IServerResponse<IOrganization>>(
      `${rootUrl}/organization/team/${team_id}`,
      body
    );
    return response.data;
  },

  async deleteTeam(id: string): Promise<IServerResponse<any>> {
    const response = await apiClient.delete<IServerResponse<any>>(
      `${rootUrl}/organization/team/${id}`
    );
    return response.data;
  },

  async removeTeamMember(team_member_id: string, team_id: string): Promise<IServerResponse<any>> {
    const response = await apiClient.put<IServerResponse<any>>(
      `${rootUrl}/organization/team-member/${team_member_id}`,
      { teamId: team_id }
    );
    return response.data;
  },

  async getOrganizationProjects(
    requestParams: IOrganizationTeamRequestParams
  ): Promise<IServerResponse<IOrganizationProjectsGetResponse>> {
    const params = new URLSearchParams({
      index: requestParams.index.toString(),
      size: requestParams.size.toString(),
      ...(requestParams.field && { field: requestParams.field }),
      ...(requestParams.order && { order: requestParams.order }),
      ...(requestParams.search && { search: requestParams.search }),
    });
    const response = await apiClient.get<IServerResponse<IOrganizationProjectsGetResponse>>(
      `${rootUrl}/organization/projects?${params}`
    );
    return response.data;
  },

  // Billing - Configuration
  async getCountries(): Promise<IServerResponse<IBillingConfigurationCountry[]>> {
    const response = await apiClient.get<IServerResponse<IBillingConfigurationCountry[]>>(
      `${rootUrl}/billing/countries`
    );
    return response.data;
  },

  async getBillingConfiguration(): Promise<IServerResponse<IBillingConfiguration>> {
    const response = await apiClient.get<IServerResponse<IBillingConfiguration>>(
      `${rootUrl}/billing/configuration`
    );
    return response.data;
  },

  async updateBillingConfiguration(
    body: IBillingConfiguration
  ): Promise<IServerResponse<IBillingConfiguration>> {
    const response = await apiClient.put<IServerResponse<IBillingConfiguration>>(
      `${rootUrl}/billing/configuration`,
      body
    );
    return response.data;
  },

  // Billing - Current Bill
  async getCharges(): Promise<IServerResponse<IBillingChargesResponse>> {
    const response = await apiClient.get<IServerResponse<IBillingChargesResponse>>(
      `${rootUrl}/billing/charges`
    );
    return response.data;
  },

  async getTransactions(): Promise<IServerResponse<IBillingTransaction[]>> {
    const response = await apiClient.get<IServerResponse<IBillingTransaction[]>>(
      `${rootUrl}/billing/transactions`
    );
    return response.data;
  },

  async getBillingAccountInfo(): Promise<IServerResponse<IBillingAccountInfo>> {
    const response = await apiClient.get<IServerResponse<IBillingAccountInfo>>(
      `${rootUrl}/billing/info`
    );
    return response.data;
  },

  async getFreePlanSettings(): Promise<IServerResponse<IFreePlanSettings>> {
    const response = await apiClient.get<IServerResponse<IFreePlanSettings>>(
      `${rootUrl}/billing/free-plan`
    );
    return response.data;
  },

  async upgradePlan(plan: string): Promise<IServerResponse<IUpgradeSubscriptionPlanResponse>> {
    const response = await apiClient.get<IServerResponse<IUpgradeSubscriptionPlanResponse>>(
      `${rootUrl}/billing/upgrade-plan${toQueryString({ plan })}`
    );
    return response.data;
  },

  async changePlan(plan: string): Promise<IServerResponse<IUpgradeSubscriptionPlanResponse>> {
    const response = await apiClient.get<IServerResponse<IUpgradeSubscriptionPlanResponse>>(
      `${rootUrl}/billing/change-plan${toQueryString({ plan })}`
    );
    return response.data;
  },

  async getPlans(): Promise<IServerResponse<IPricingPlans>> {
    const response = await apiClient.get<IServerResponse<IPricingPlans>>(
      `${rootUrl}/billing/plans`
    );
    return response.data;
  },

  async getStorageInfo(): Promise<IServerResponse<IStorageInfo>> {
    const response = await apiClient.get<IServerResponse<IStorageInfo>>(
      `${rootUrl}/billing/storage`
    );
    return response.data;
  },

  async pauseSubscription(): Promise<IServerResponse<any>> {
    const response = await apiClient.get<IServerResponse<any>>(`${rootUrl}/billing/pause-plan`);
    return response.data;
  },

  async resumeSubscription(): Promise<IServerResponse<any>> {
    const response = await apiClient.get<IServerResponse<any>>(`${rootUrl}/billing/resume-plan`);
    return response.data;
  },

  async cancelSubscription(): Promise<IServerResponse<any>> {
    const response = await apiClient.get<IServerResponse<any>>(`${rootUrl}/billing/cancel-plan`);
    return response.data;
  },

  async addMoreSeats(totalSeats: number): Promise<IServerResponse<any>> {
    const response = await apiClient.post<IServerResponse<any>>(
      `${rootUrl}/billing/purchase-more-seats`,
      { seatCount: totalSeats }
    );
    return response.data;
  },

  async redeemCode(code: string): Promise<IServerResponse<IUpgradeSubscriptionPlanResponse>> {
    const response = await apiClient.post<IServerResponse<IUpgradeSubscriptionPlanResponse>>(
      `${rootUrl}/billing/redeem`,
      {
        code,
      }
    );
    return response.data;
  },

  async getAccountStorage(): Promise<IServerResponse<IBillingAccountStorage>> {
    const response = await apiClient.get<IServerResponse<IBillingAccountStorage>>(
      `${rootUrl}/billing/account-storage`
    );
    return response.data;
  },

  async switchToFreePlan(teamId: string): Promise<IServerResponse<any>> {
    const response = await apiClient.get<IServerResponse<any>>(
      `${rootUrl}/billing/switch-to-free-plan/${teamId}`
    );
    return response.data;
  },

  async updateOrganizationCalculationMethod(
    calculationMethod: 'hourly' | 'man_days'
  ): Promise<IServerResponse<any>> {
    const response = await apiClient.put<IServerResponse<any>>(
      `${rootUrl}/organization/calculation-method`,
      {
        calculation_method: calculationMethod,
      }
    );
    return response.data;
  },

  async updateOrganizationHolidaySettings(
    settings: IOrganizationHolidaySettings
  ): Promise<IServerResponse<any>> {
    const response = await apiClient.put<IServerResponse<any>>(
      `${rootUrl}/organization/holiday-settings`,
      settings
    );
    return response.data;
  },

  async getAdminCenterSettings(): Promise<IServerResponse<IOrganization>> {
    const response = await apiClient.get<IServerResponse<IOrganization>>(`${rootUrl}/settings`);
    return response.data;
  },

  async getAppSumoCountdownWidget(): Promise<
    IServerResponse<{
      isVisible: boolean;
      remainingDays: number;
      remainingHours: number;
      remainingMinutes: number;
      urgencyLevel: string;
      message: string;
      ctaText: string;
      ctaUrl: string;
    }>
  > {
    const response = await apiClient.get(`${rootUrl}/appsumo/countdown-widget`);
    return response.data;
  },
};
