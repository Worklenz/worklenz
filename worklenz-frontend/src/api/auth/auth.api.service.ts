import { IServerResponse } from '@/types/common.types';
import apiClient from '../api-client';
import {
  IUserLoginRequest,
  IUserLoginResponse,
  IAuthorizeResponse,
} from '@/types/auth/login.types';
import { AUTH_API_BASE_URL } from '@/shared/constants';

const rootUrl = `${AUTH_API_BASE_URL}`;

export const authApiService = {
  async login(credentials: IUserLoginRequest): Promise<IAuthorizeResponse> {
    const response = await apiClient.post<IAuthorizeResponse>(`${rootUrl}/login`, credentials);
    return response.data;
  },

  async logout(): Promise<IServerResponse<void>> {
    const response = await apiClient.get<IServerResponse<void>>(`${rootUrl}/logout`);
    return response.data;
  },

  async verify(): Promise<IAuthorizeResponse> {
    const response = await apiClient.get<IAuthorizeResponse>(`${rootUrl}/verify`);
    return response.data;
  },

  async signUp(body: any): Promise<IServerResponse<void>> {
    const response = await apiClient.post<IServerResponse<void>>(`${rootUrl}/signup`, body);
    return response.data;
  },

  async signUpCheck(body: any): Promise<IServerResponse<void>> {
    const response = await apiClient.post<IServerResponse<void>>(`${rootUrl}/signup/check`, body);
    return response.data;
  },

  async resetPassword(email: string): Promise<IServerResponse<string>> {
    const response = await apiClient.post<IServerResponse<string>>(`${rootUrl}/reset-password`, {
      email,
    });
    return response.data;
  },

  async updatePassword(values: any): Promise<IServerResponse<string>> {
    const response = await apiClient.post<IServerResponse<string>>(
      `${rootUrl}/update-password`,
      values
    );
    return response.data;
  },

  async verifyRecaptchaToken(token: string): Promise<IServerResponse<string>> {
    const response = await apiClient.post<IServerResponse<string>>(`${rootUrl}/verify-captcha`, {
      token,
    });
    return response.data;
  },
};
