import { IServerResponse } from '@/types/common.types';
import { ISurvey, ISurveySubmissionRequest, ISurveyResponse } from '@/types/account-setup/survey.types';
import apiClient from '../api-client';

const API_BASE_URL = '/api/v1';

export const surveyApiService = {
  async getAccountSetupSurvey(): Promise<IServerResponse<ISurvey>> {
    const response = await apiClient.get<IServerResponse<ISurvey>>(`${API_BASE_URL}/surveys/account-setup`);
    return response.data;
  },

  async submitSurveyResponse(data: ISurveySubmissionRequest): Promise<IServerResponse<{ response_id: string }>> {
    const response = await apiClient.post<IServerResponse<{ response_id: string }>>(`${API_BASE_URL}/surveys/responses`, data);
    return response.data;
  },

  async getUserSurveyResponse(surveyId: string): Promise<IServerResponse<ISurveyResponse>> {
    const response = await apiClient.get<IServerResponse<ISurveyResponse>>(`${API_BASE_URL}/surveys/responses/${surveyId}`);
    return response.data;
  },

  async checkAccountSetupSurveyStatus(): Promise<IServerResponse<{ is_completed: boolean; completed_at?: string }>> {
    const response = await apiClient.get<IServerResponse<{ is_completed: boolean; completed_at?: string }>>(`${API_BASE_URL}/surveys/account-setup/status`);
    return response.data;
  }
};