import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { ApiResponse, ClientUser, ClientToken, SignInCodeRequested } from '@/types';
import { getAccessRemovedReason, isAccessRevokedBody, signalAccessRemoved } from '@/utils/accessRemoved';

class ClientPortalAPI {
  private api: AxiosInstance;
  private clientToken: string | null = null;
  private refreshTokenPromise: Promise<string> | null = null;

  constructor() {
    this.api = axios.create({
      baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api/client-portal',
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Initialize token from localStorage
    this.clientToken = localStorage.getItem('clientToken');

    // Request interceptor to add client token
    this.api.interceptors.request.use(
      (config) => {
        if (this.clientToken) {
          config.headers['x-client-token'] = this.clientToken;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor for error handling and token refresh
    this.api.interceptors.response.use(
      (response: AxiosResponse) => {
        return response;
      },
      async (error) => {
        const originalRequest = error.config;

        // Skip retry if the request has _skipRetry flag (used for initialization)
        if (originalRequest._skipRetry) {
          return Promise.reject(error);
        }

        // Skip token refresh for the sign-in endpoints: they are called without a session
        const url: string = originalRequest.url ?? '';
        const isAuthEndpoint = url.includes('/auth/otp/');
        const isRefreshEndpoint = url.includes('/auth/refresh');
        const isLogoutEndpoint = url.includes('/auth/logout');

        // Check if this is a 403 error due to client deactivation
        const errorMessage = error.response?.data?.message || '';
        const isDeactivated =
          error.response?.status === 403 &&
          (errorMessage.toLowerCase().includes('deactivated') ||
            errorMessage.toLowerCase().includes('portal access is disabled'));

        // The server says access was revoked (removed, deactivated, account deleted, organization gone).
        // Refreshing the token cannot help, so end the session now and say why. A logout that is itself
        // refused is the same answer to the same session: there is nothing left to tell anyone.
        if (!isAuthEndpoint && (isAccessRevokedBody(error.response?.data) || isDeactivated)) {
          this.clearToken();
          localStorage.removeItem('clientTokenExpiry');
          if (!isLogoutEndpoint) signalAccessRemoved(getAccessRemovedReason(error.response?.data));
          return Promise.reject(error);
        }

        // A refresh that fails must never wait on itself. Retrying it would reuse the refresh already in
        // flight (this very request), so the original call, and every screen waiting on it, would hang.
        if (isRefreshEndpoint || isLogoutEndpoint) {
          return Promise.reject(error);
        }

        if ((error.response?.status === 401 || error.response?.status === 403) && !originalRequest._retry && !isAuthEndpoint) {
          originalRequest._retry = true;

          try {
            // Try to refresh token
            const newToken = await this.refreshTokenSilently();
            this.setToken(newToken);
            originalRequest.headers['x-client-token'] = newToken;
            return this.api(originalRequest);
          } catch (refreshError) {
            // If refresh fails, clear token and let the app handle the redirect
            this.clearToken();
            // Don't force redirect here - let the auth state handle it
            return Promise.reject(refreshError);
          }
        }

        return Promise.reject(error);
      }
    );
  }

  setToken(token: string) {
    this.clientToken = token;
    localStorage.setItem('clientToken', token);
  }

  getToken(): string | null {
    if (!this.clientToken) {
      this.clientToken = localStorage.getItem('clientToken');
    }
    return this.clientToken;
  }

  clearToken() {
    this.clientToken = null;
    localStorage.removeItem('clientToken');
  }

  isAuthenticated(): boolean {
    return !!this.getToken();
  }

  // Silent token refresh
  private async refreshTokenSilently(): Promise<string> {
    // Prevent multiple simultaneous refresh requests
    if (this.refreshTokenPromise) {
      return this.refreshTokenPromise;
    }

    this.refreshTokenPromise = this.api.post('/auth/refresh', {
      token: this.clientToken,
    }).then(response => {
      this.refreshTokenPromise = null;
      return response.data.body.token;
    }).catch(error => {
      this.refreshTokenPromise = null;
      throw error;
    });

    return this.refreshTokenPromise;
  }

  // Generic request method
  private async request<T>(endpoint: string, options: Record<string, unknown> = {}): Promise<ApiResponse<T>> {
    const response = await this.api.request({
      url: endpoint,
      ...options,
    });
    return response.data;
  }

  // Authentication endpoints
  /**
   * Sends a one-time sign-in code. Pass `inviteToken` (from an emailed link, which carries the address)
   * or the `email` the person typed. The answer is the same whether or not the address has access.
   */
  async requestSignInCode(input: { email?: string; inviteToken?: string }): Promise<ApiResponse<SignInCodeRequested>> {
    const response = await this.api.post('/auth/otp/request', input);
    return response.data;
  }

  async verifySignInCode(input: { email: string; code: string }): Promise<ApiResponse<{ user: ClientUser; token: string; expiresAt: string }>> {
    const response = await this.api.post('/auth/otp/verify', input);
    return response.data;
  }

  async logout(): Promise<void> {
    try {
      await this.api.post('/auth/logout');
    } catch (error) {
      // Ignore errors during logout
      console.warn('Logout request failed:', error);
    } finally {
      this.clearToken();
    }
  }

  async refreshToken(): Promise<ApiResponse<ClientToken>> {
    const response = await this.api.post('/auth/refresh', {
      token: this.clientToken,
    });
    return response.data;
  }

  async getCurrentUser(): Promise<ApiResponse<ClientUser>> {
    const response = await this.api.get('/profile');
    return response.data;
  }

  // Special method for initialization that bypasses interceptors
  async validateTokenForInit(): Promise<ApiResponse<ClientUser>> {
    try {
      const response = await this.api.get('/profile', {
        // Add a flag to bypass the retry logic in interceptor
        _skipRetry: true
      } as any);
      return response.data;
    } catch (error: any) {
      // A person whose access was ended while they were away should be told why, not dropped on the
      // sign-in page where a code that never arrives looks like a fault.
      if (isAccessRevokedBody(error.response?.data)) {
        signalAccessRemoved(getAccessRemovedReason(error.response?.data));
      }
      // If it's a 401 or 403, return a structured error instead of throwing
      if (error.response?.status === 401 || error.response?.status === 403) {
        return {
          done: false,
          message: 'Token invalid or access forbidden',
          body: null
        } as any;
      }
      throw error;
    }
  }

  // Organizations
  async getOrganizations(): Promise<ApiResponse<{ organizations: any[] }>> {
    const response = await this.api.get('/organizations');
    return response.data;
  }

  async switchOrganization(organizationId: string): Promise<ApiResponse<{ token: string; organizationId: string; clientId: string; expiresAt: string }>> {
    const response = await this.api.post('/organizations/switch', { organizationId });
    return response.data;
  }

  // Invoices
  async getInvoices(params?: { page?: number; limit?: number; status?: string; search?: string }) {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.status) queryParams.append('status', params.status);
    if (params?.search) queryParams.append('search', params.search);
    
    const queryString = queryParams.toString();
    return this.request(`/invoices${queryString ? `?${queryString}` : ''}`);
  }

  async getInvoiceDetails(id: string) {
    return this.request(`/invoices/${id}`);
  }

  async payInvoice(id: string, paymentData: { paymentMethod?: string; transactionId?: string; notes?: string }) {
    return this.request(`/invoices/${id}/pay`, {
      method: 'POST',
      data: paymentData,
    });
  }

  // File uploads and attachments
  async uploadFile(file: File, purpose?: string): Promise<ApiResponse<{ 
    id: string;
    url: string; 
    filename: string; 
    originalName: string; 
    fileType: string; 
    fileExtension: string;
    purpose: string; 
    size: number; 
    storageKey: string;
    uploadedAt: string 
  }>> {
    // Convert file to base64
    const base64 = await this.fileToBase64(file);
    
    const response = await this.api.request({
      url: '/upload',
      method: 'POST',
      data: {
        fileData: base64,
        fileName: file.name,
        fileType: file.type,
        purpose: purpose || 'general'
      },
    });
    
    return response.data;
  }

  private fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  }
}

// Export singleton instance
export const clientPortalAPI = new ClientPortalAPI();
export default clientPortalAPI;
