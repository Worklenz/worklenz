// PPM-OVERRIDE: Phase 2 — Admin API client for PPM partner dashboard
import apiClient from '@/api/api-client';

interface IServerResponse<T> {
  done: boolean;
  body: T | null;
  message: string | null;
}

// Types
export interface IPPMClient {
  id: string;
  name: string;
  branding_config: Record<string, any> | null;
  is_active: boolean;
  created_at: string;
  primary_partner_name?: string;
  active_tasks?: number;
  utilization?: number;
}

export interface IPPMClientUser {
  id: string;
  email: string;
  display_name: string | null;
  role: 'viewer' | 'reviewer' | 'admin';
  deactivated_at: string | null;
  last_login_at: string | null;
}

export interface IPPMPartner {
  partner_id: string;
  name: string;
  email: string;
  role: string;
}

export interface IPPMClientProject {
  id: string;
  project_id: string;
  project_name: string;
  is_primary: boolean;
  incoming_status_id: string | null;
}

export interface IDashboardStats {
  total_clients: number;
  active_deliverables: number;
  pending_approvals: number;
  overdue_items: number;
}

export interface IClientHealth {
  id: string;
  name: string;
  primary_partner: string | null;
  active_tasks: number;
  utilization: number | null;
}

export interface IPipelineItem {
  id: string;
  title: string;
  status: string;
  client_name: string;
  client_id: string;
  assignee_name: string | null;
  priority: string | null;
  type: string | null;
  due_date: string | null;
  created_at: string;
}

export interface IApprovalItem {
  id: string;
  title: string;
  description: string | null;
  client_name: string;
  client_id: string;
  submitted_by: string | null;
  created_at: string;
  return_count: number;
  worklenz_task_id: string | null;
}

export interface IFeedbackReason {
  id: string;
  label: string;
}

const BASE = '/ppm/api/admin';

// Admin CSRF token — fetched once, attached to all write requests
let adminCsrfToken: string | null = null;

async function ensureAdminCsrf() {
  if (adminCsrfToken) return;
  const res = await apiClient.get<IServerResponse<{ csrf_token: string }>>(`${BASE}/csrf-token`);
  if (res.data.done && res.data.body) {
    adminCsrfToken = res.data.body.csrf_token;
  }
}

// Intercept write requests to attach CSRF token
apiClient.interceptors.request.use(async (config) => {
  if (config.url?.startsWith(BASE) && config.method && ['post', 'put', 'delete'].includes(config.method)) {
    await ensureAdminCsrf();
    if (adminCsrfToken) {
      config.headers['X-CSRF-Token'] = adminCsrfToken;
    }
  }
  return config;
});

// Handle admin CSRF errors: clear cached token so next request re-fetches
apiClient.interceptors.response.use(undefined, async (error) => {
  const url = error.config?.url || '';
  if (
    url.startsWith(BASE) &&
    error.response?.status === 403 &&
    !error.config?._adminCsrfRetry
  ) {
    // Clear cached token and retry once
    adminCsrfToken = null;
    await ensureAdminCsrf();
    if (adminCsrfToken) {
      error.config.headers['X-CSRF-Token'] = adminCsrfToken;
      error.config._adminCsrfRetry = true;
      return apiClient(error.config);
    }
  }
  return Promise.reject(error);
});

export const adminApi = {
  // Dashboard
  async getStats() {
    const res = await apiClient.get<IServerResponse<IDashboardStats>>(`${BASE}/dashboard`);
    return res.data;
  },

  async getClientHealth() {
    const res = await apiClient.get<IServerResponse<IClientHealth[]>>(`${BASE}/dashboard/clients`);
    return res.data;
  },

  async getPipeline(params?: { client_id?: string; assignee_id?: string; type_id?: string }) {
    const res = await apiClient.get<IServerResponse<IPipelineItem[]>>(`${BASE}/pipeline`, { params });
    return res.data;
  },

  // Approval queue
  async getApprovals() {
    const res = await apiClient.get<IServerResponse<IApprovalItem[]>>(`${BASE}/approval-queue`);
    return res.data;
  },

  async getApprovalCount() {
    const res = await apiClient.get<IServerResponse<{ count: number }>>(`${BASE}/approval-queue/count`);
    return res.data;
  },

  async approveTask(deliverableId: string) {
    const res = await apiClient.post<IServerResponse<null>>(`${BASE}/approval-queue/${deliverableId}/approve`);
    return res.data;
  },

  async returnTask(deliverableId: string, data: { reason_id: string; comment?: string }) {
    const res = await apiClient.post<IServerResponse<null>>(`${BASE}/approval-queue/${deliverableId}/return`, data);
    return res.data;
  },

  async getFeedbackReasons() {
    const res = await apiClient.get<IServerResponse<IFeedbackReason[]>>(`${BASE}/feedback-reasons`);
    return res.data;
  },

  // Client management
  async getClients() {
    const res = await apiClient.get<IServerResponse<IPPMClient[]>>(`${BASE}/clients`);
    return res.data;
  },

  async getClient(id: string) {
    const res = await apiClient.get<IServerResponse<IPPMClient>>(`${BASE}/clients/${id}`);
    return res.data;
  },

  async createClient(data: { name: string; branding_config?: Record<string, any> }) {
    const res = await apiClient.post<IServerResponse<IPPMClient>>(`${BASE}/clients`, data);
    return res.data;
  },

  // Client users
  async getClientUsers(clientId: string) {
    const res = await apiClient.get<IServerResponse<IPPMClientUser[]>>(`${BASE}/clients/${clientId}/users`);
    return res.data;
  },

  async addClientUser(clientId: string, data: { email: string; display_name?: string; role?: string }) {
    const res = await apiClient.post<IServerResponse<IPPMClientUser>>(`${BASE}/clients/${clientId}/users`, data);
    return res.data;
  },

  async updateClientUser(clientId: string, userId: string, data: { display_name?: string; role?: string }) {
    const res = await apiClient.put<IServerResponse<IPPMClientUser>>(`${BASE}/clients/${clientId}/users/${userId}`, data);
    return res.data;
  },

  async removeClientUser(clientId: string, userId: string) {
    const res = await apiClient.delete<IServerResponse<null>>(`${BASE}/clients/${clientId}/users/${userId}`);
    return res.data;
  },

  // Client partners
  async getClientPartners(clientId: string) {
    const res = await apiClient.get<IServerResponse<IPPMPartner[]>>(`${BASE}/clients/${clientId}/partners`);
    return res.data;
  },

  async addClientPartner(clientId: string, data: { partner_id: string; role?: string }) {
    const res = await apiClient.post<IServerResponse<null>>(`${BASE}/clients/${clientId}/partners`, data);
    return res.data;
  },

  async removeClientPartner(clientId: string, partnerId: string) {
    const res = await apiClient.delete<IServerResponse<null>>(`${BASE}/clients/${clientId}/partners/${partnerId}`);
    return res.data;
  },

  // Client projects
  async getClientProjects(clientId: string) {
    const res = await apiClient.get<IServerResponse<IPPMClientProject[]>>(`${BASE}/clients/${clientId}/projects`);
    return res.data;
  },

  async linkProject(clientId: string, data: { project_id: string; is_primary?: boolean }) {
    const res = await apiClient.post<IServerResponse<null>>(`${BASE}/clients/${clientId}/projects`, data);
    return res.data;
  },

  async unlinkProject(clientId: string, projectId: string) {
    const res = await apiClient.delete<IServerResponse<null>>(`${BASE}/clients/${clientId}/projects/${projectId}`);
    return res.data;
  },

  async setPrimaryProject(clientId: string, projectId: string) {
    const res = await apiClient.put<IServerResponse<null>>(`${BASE}/clients/${clientId}/projects/${projectId}/primary`);
    return res.data;
  },
};
