import { API_BASE_URL } from '@/shared/constants';
import { IServerResponse } from '@/types/common.types';
import apiClient from '../api-client';

export interface IPlanTrialInfo {
  trial_id?: string;
  plan_tier_id?: string;
  tier_name?: string;
  display_name?: string;
  trial_end_date?: Date;
  days_remaining?: number;
  can_start_trial?: boolean;
  trial_duration_days?: number;
}

export interface IPlanTrialStartResponse {
  trial_id: string;
  plan_name: string;
  trial_days: number;
  trial_end_date: Date;
  message: string;
}

export interface IPlanTrialStatusResponse {
  has_active_trial: boolean;
  trial_info?: IPlanTrialInfo;
}

export class PlanTrialApiService {
  private static readonly rootUrl = API_BASE_URL;

  /**
   * Check if user can start a Business plan trial
   */
  public static async checkBusinessTrialEligibility(): Promise<IServerResponse<IPlanTrialInfo>> {
    const response = await apiClient.get<IServerResponse<IPlanTrialInfo>>(
      `${this.rootUrl}/plan-trials/business/trial/eligibility`
    );
    return response.data;
  }

  /**
   * Start a Business plan trial
   */
  public static async startBusinessTrial(): Promise<IServerResponse<IPlanTrialStartResponse>> {
    const response = await apiClient.post<IServerResponse<IPlanTrialStartResponse>>(
      `${this.rootUrl}/plan-trials/business/trial`
    );
    return response.data;
  }

  /**
   * Get current trial status
   */
  public static async getTrialStatus(): Promise<IServerResponse<IPlanTrialStatusResponse>> {
    const response = await apiClient.get<IServerResponse<IPlanTrialStatusResponse>>(
      `${this.rootUrl}/plan-trials/trial/status`
    );
    return response.data;
  }

  /**
   * Cancel active trial
   */
  public static async cancelTrial(reason?: string): Promise<IServerResponse<{ message: string }>> {
    const response = await apiClient.post<IServerResponse<{ message: string }>>(
      `${this.rootUrl}/plan-trials/trial/cancel`,
      { reason }
    );
    return response.data;
  }

  /**
   * Convert trial to paid subscription
   */
  public static async convertTrial(
    trialId: string
  ): Promise<IServerResponse<{ message: string; plan_tier_id?: string }>> {
    const response = await apiClient.post<
      IServerResponse<{ message: string; plan_tier_id?: string }>
    >(`${this.rootUrl}/plan-trials/trial/convert`, { trial_id: trialId });
    return response.data;
  }

  /**
   * Get trial statistics (admin only)
   */
  public static async getTrialStats(plan?: string): Promise<IServerResponse<any[]>> {
    const url = plan
      ? `${this.rootUrl}/plan-trials/trial/stats?plan=${plan}`
      : `${this.rootUrl}/plan-trials/trial/stats`;

    const response = await apiClient.get<IServerResponse<any[]>>(url);
    return response.data;
  }
}
