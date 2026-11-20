import { IServerResponse } from '@/types/common.types';
import apiClient, { clearCsrfToken } from '../api-client';
import {
  IUserLoginRequest,
  IUserLoginResponse,
  IAuthorizeResponse,
} from '@/types/auth/login.types';
import { AUTH_API_BASE_URL } from '@/shared/constants';

const rootUrl = `${AUTH_API_BASE_URL}`;

export const authApiService = {
  async googleOneTapConfig(): Promise<{ enabled: boolean; clientId?: string }> {
    const response = await apiClient.get<IServerResponse<{ enabled: boolean; clientId?: string }>>(
      `${rootUrl}/google/one-tap/config`, { headers: { 'X-Silent-Request': '1' } }
    );
    return response.data.body;
  },

  async googleOneTapChallenge(): Promise<string> {
    const response = await apiClient.post<IServerResponse<{ nonce: string }>>(
      `${rootUrl}/google/one-tap/challenge`, {}, { headers: { 'X-Silent-Request': '1' } }
    );
    return response.data.body.nonce;
  },

  async googleOneTapLogin(credential: string): Promise<void> {
    await apiClient.post(`${rootUrl}/google/one-tap/login`, { credential }, {
      headers: { 'X-Silent-Request': '1' },
    });
    clearCsrfToken();
  },

  async login(credentials: IUserLoginRequest): Promise<IAuthorizeResponse> {
    const response = await apiClient.post<IAuthorizeResponse>(`${rootUrl}/login`, credentials);
    // Login replaces the server session, which invalidates the cached CSRF token
    clearCsrfToken();
    return response.data;
  },

  async logout(): Promise<IServerResponse<void>> {
    const response = await apiClient.get<IServerResponse<void>>(`${rootUrl}/logout`);
    clearCsrfToken();
    return response.data;
  },

  async verify(silent = false): Promise<IAuthorizeResponse> {
    const response = await apiClient.get<IAuthorizeResponse>(`${rootUrl}/verify`, {
      headers: silent ? { 'X-Silent-Request': '1' } : undefined,
    });
    return response.data;
  },

  async signUp(body: any): Promise<IServerResponse<void>> {
    const response = await apiClient.post<IServerResponse<void>>(`${rootUrl}/signup`, body);
    // Signup logs the user in, which replaces the server session
    clearCsrfToken();
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
