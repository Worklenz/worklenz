import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { ApiResponse, ClientSettings, ClientUser, ClientToken } from '@/types';

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

        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          try {
            // Try to refresh token
            const newToken = await this.refreshTokenSilently();
            this.setToken(newToken);
            originalRequest.headers['x-client-token'] = newToken;
            return this.api(originalRequest);
          } catch (refreshError) {
            // If refresh fails, redirect to login
            this.clearToken();
            window.location.href = '/auth/login';
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
  async login(credentials: { email: string; password: string }): Promise<ApiResponse<{ user: ClientUser; token: string; expiresAt: string }>> {
    const response = await this.api.post('/login', credentials);
    return response.data;
  }

  async logout(): Promise<void> {
    try {
      await this.api.post('/logout');
    } catch (error) {
      // Ignore errors during logout
      console.warn('Logout request failed:', error);
    } finally {
      this.clearToken();
    }
  }

  async validateInvite(token: string): Promise<ApiResponse<{ valid: boolean; email?: string; organizationName?: string; isOrganizationInvite?: boolean; redirectTo?: string }>> {
    // Check if this is an organization invite token by decoding the JWT payload
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      if (payload.type === 'organization_invite') {
        // For organization invites, just validate the token structure and return org info
        // Don't call the backend yet, let the component handle the actual invite processing
        return {
          done: true,
          body: { 
            valid: true, 
            organizationName: payload.organizationName,
            isOrganizationInvite: true
          },
          message: 'Organization invite token is valid',
          title: undefined
        };
      }
    } catch (error) {
      console.log('Could not decode token as organization invite, trying regular invite validation');
    }
    
    // For regular invites, use the existing validation endpoint
    const response = await this.api.get(`/invitation/validate?token=${token}`);
    return response.data;
  }

  async acceptInvite(inviteData: { 
    token: string; 
    name: string; 
    password: string; 
  }): Promise<ApiResponse<{ user: ClientUser; token: string; expiresAt: string }>> {
    // Check if this is an organization invite token
    try {
      const payload = JSON.parse(atob(inviteData.token.split('.')[1]));
      if (payload.type === 'organization_invite') {
        // For organization invites, just handle the invite (user should already be authenticated)
        const response = await this.api.post('/handle-organization-invite', { token: inviteData.token });
        if (response.data.body.redirectTo === 'login') {
          // User needs to login first, redirect them
          window.location.href = '/auth/login';
          return response.data;
        }
        return response.data;
      }
    } catch (error) {
      console.log('Not an organization invite, processing as regular invite');
    }
    
    const response = await this.api.post('/invitation/accept', inviteData);
    return response.data;
  }

  async handleOrganizationInvite(token: string): Promise<ApiResponse<{ redirectTo: string; message: string }>> {
    const response = await this.api.post('/handle-organization-invite', { token });
    return response.data;
  }


  async refreshToken(): Promise<ApiResponse<ClientToken>> {
    const response = await this.api.post('/auth/refresh', {
      token: this.clientToken,
    });
    return response.data;
  }

  async requestPasswordReset(email: string): Promise<ApiResponse<{ message: string }>> {
    const response = await this.api.post('/auth/forgot-password', { email });
    return response.data;
  }

  async resetPassword(resetData: { 
    token: string; 
    password: string; 
  }): Promise<ApiResponse<{ message: string }>> {
    const response = await this.api.post('/auth/reset-password', resetData);
    return response.data;
  }

  async changePassword(passwordData: { 
    currentPassword: string; 
    newPassword: string; 
  }): Promise<ApiResponse<{ message: string }>> {
    const response = await this.api.post('/auth/change-password', passwordData);
    return response.data;
  }

  async getCurrentUser(): Promise<ApiResponse<ClientUser>> {
    const response = await this.api.get('/auth/me');
    return response.data;
  }

  // Dashboard
  async getDashboard() {
    return this.request('/dashboard');
  }

  // Services
  async getServices(params?: { page?: number; limit?: number; status?: string }) {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.status) queryParams.append('status', params.status);
    
    const queryString = queryParams.toString();
    return this.request(`/services${queryString ? `?${queryString}` : ''}`);
  }

  async getServiceDetails(id: string) {
    return this.request(`/services/${id}`);
  }

  // Requests
  async getRequests(params?: { page?: number; limit?: number; status?: string; search?: string }) {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.status) queryParams.append('status', params.status);
    if (params?.search) queryParams.append('search', params.search);
    
    const queryString = queryParams.toString();
    return this.request(`/requests${queryString ? `?${queryString}` : ''}`);
  }

  async createRequest(data: { serviceId: string; requestData?: any; notes?: string }) {
    return this.request('/requests', {
      method: 'POST',
      data,
    });
  }

  async getRequestDetails(id: string) {
    return this.request(`/requests/${id}`);
  }

  async updateRequest(id: string, data: { requestData?: any; notes?: string }) {
    return this.request(`/requests/${id}`, {
      method: 'PUT',
      data,
    });
  }

  async deleteRequest(id: string) {
    return this.request(`/requests/${id}`, {
      method: 'DELETE',
    });
  }

  async getRequestStatusOptions() {
    return this.request('/requests/status-options');
  }

  // Projects
  async getProjects(params?: { page?: number; limit?: number; status?: string; search?: string }) {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.status) queryParams.append('status', params.status);
    if (params?.search) queryParams.append('search', params.search);
    
    const queryString = queryParams.toString();
    return this.request(`/projects${queryString ? `?${queryString}` : ''}`);
  }

  async getProjectDetails(id: string) {
    return this.request(`/projects/${id}`);
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

  async downloadInvoice(id: string, format: string = 'pdf'): Promise<ApiResponse<any>> {
    return this.request(`/invoices/${id}/download?format=${format}`);
  }

  // Chat
  async getChats(params?: { page?: number; limit?: number }): Promise<ApiResponse<any>> {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    
    const queryString = queryParams.toString();
    return this.request<any>(`/chats${queryString ? `?${queryString}` : ''}`);
  }

  async getChatDetails(date: string, params?: { page?: number; limit?: number }) {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    
    const queryString = queryParams.toString();
    return this.request(`/chats/${date}${queryString ? `?${queryString}` : ''}`);
  }

  async sendMessage(messageData: { message: string; messageType?: string; fileUrl?: string }): Promise<ApiResponse<any>> {
    return this.request<any>('/messages', {
      method: 'POST',
      data: messageData,
    });
  }

  async getMessages(params?: { page?: number; limit?: number; since?: string }): Promise<ApiResponse<any>> {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.since) queryParams.append('since', params.since);
    
    const queryString = queryParams.toString();
    return this.request<any>(`/messages${queryString ? `?${queryString}` : ''}`);
  }

  // Settings
  async getSettings() {
    return this.request('/settings');
  }

  async updateSettings(settingsData: Partial<ClientSettings>) {
    return this.request('/settings', {
      method: 'PUT',
      data: settingsData,
    });
  }

  // Profile
  async getProfile() {
    return this.request('/profile');
  }

  async updateProfile(profileData: Partial<ClientUser>) {
    return this.request('/profile', {
      method: 'PUT',
      data: profileData,
    });
  }

  // Notifications
  async getNotifications(params?: { page?: number; limit?: number; unread_only?: boolean }): Promise<ApiResponse<any>> {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.unread_only) queryParams.append('unread_only', params.unread_only.toString());
    
    const queryString = queryParams.toString();
    return this.request<any>(`/notifications${queryString ? `?${queryString}` : ''}`);
  }

  async markNotificationRead(id: string) {
    return this.request(`/notifications/${id}/read`, {
      method: 'PUT',
    });
  }

  async markAllNotificationsRead() {
    return this.request('/notifications/read-all', {
      method: 'PUT',
    });
  }

  // File uploads
  async uploadFile(file: File, purpose?: string): Promise<ApiResponse<{ url: string; filename: string; originalName: string; fileType: string; purpose: string; size: number; uploadedAt: string }>> {
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