import axios from 'axios';
import config from '@/config/env';

/**
 * Dedicated axios client for the PPM client portal.
 * Does NOT use the main apiClient (which injects CSRF tokens and redirects
 * to /auth/login on 401). Portal auth is session-based but separate from
 * the Worklenz internal auth flow.
 */
const portalClient = axios.create({
  baseURL: `${config.apiUrl}/ppm/api/portal`,
  withCredentials: true,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// Types
export interface IPortalUser {
  userId: string;
  email: string;
  clientId: string;
  role: 'viewer' | 'reviewer' | 'admin';
}

export interface IDeliverable {
  id: string;
  title: string;
  description: string | null;
  status: string;
  visibility: string;
  submission_date: string | null;
  revisions_deadline: string | null;
  send_date: string | null;
  due_date: string | null;
  asset_review_link: string | null;
  month_completed: string | null;
  created_at: string;
  updated_at: string;
  type: string | null;
  channel: string | null;
  priority: string | null;
}

export interface IComment {
  id: string;
  action: string;
  actor_type: string;
  details: { comment: string; author_email?: string };
  created_at: string;
}

export interface IBranding {
  name: string;
  branding_config: {
    logo_url?: string;
    primary_color?: string;
    secondary_color?: string;
    font?: string;
  };
}

interface IServerResponse<T> {
  done: boolean;
  body: T | null;
  message: string | null;
}

// API functions
export const portalApi = {
  async requestMagicLink(email: string) {
    const res = await portalClient.post<IServerResponse<{ token: string }>>('/auth/magic-link', { email });
    return res.data;
  },

  async validateMagicLink(token: string) {
    const res = await portalClient.post<IServerResponse<IPortalUser>>('/auth/validate', { token });
    return res.data;
  },

  async getMe() {
    const res = await portalClient.get<IServerResponse<IPortalUser>>('/auth/me');
    return res.data;
  },

  async logout() {
    const res = await portalClient.post<IServerResponse<null>>('/auth/logout');
    return res.data;
  },

  async getBranding() {
    const res = await portalClient.get<IServerResponse<IBranding>>('/branding');
    return res.data;
  },

  async getDeliverables() {
    const res = await portalClient.get<IServerResponse<IDeliverable[]>>('/deliverables');
    return res.data;
  },

  async getDeliverable(id: string) {
    const res = await portalClient.get<IServerResponse<IDeliverable>>(`/deliverables/${id}`);
    return res.data;
  },

  async approveDeliverable(id: string) {
    const res = await portalClient.post<IServerResponse<IDeliverable>>(`/deliverables/${id}/approve`);
    return res.data;
  },

  async rejectDeliverable(id: string, comment: string) {
    const res = await portalClient.post<IServerResponse<IDeliverable>>(`/deliverables/${id}/reject`, { comment });
    return res.data;
  },

  async addComment(id: string, comment: string) {
    const res = await portalClient.post<IServerResponse<IComment>>(`/deliverables/${id}/comment`, { comment });
    return res.data;
  },

  async getComments(id: string) {
    const res = await portalClient.get<IServerResponse<IComment[]>>(`/deliverables/${id}/comments`);
    return res.data;
  },
};
