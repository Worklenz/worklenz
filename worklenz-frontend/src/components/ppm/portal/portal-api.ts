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

// PPM-OVERRIDE: Phase 2 — CSRF token injection for portal write requests
let csrfToken: string | null = null;

portalClient.interceptors.request.use((cfg) => {
  if (csrfToken && cfg.method && ['post', 'put', 'delete', 'patch'].includes(cfg.method)) {
    cfg.headers['X-CSRF-Token'] = csrfToken;
  }
  return cfg;
});

export function setPortalCSRFToken(token: string) {
  csrfToken = token;
}

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

// Phase 2 types
export interface IPortalTask {
  id: string;
  deliverable_id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string | null;
  type: string | null;
  channel: string | null;
  due_date: string | null;
  created_at: string;
  updated_at: string;
  comment_count: number;
  worklenz_task_id: string | null;
}

export interface IPortalComment {
  id: string;
  body: string;
  author_type: 'client' | 'partner' | 'system';
  author_name: string | null;
  created_at: string;
}

export interface IPortalAttachment {
  id: string;
  name: string;
  size: string;
  type: string;
  created_at: string;
  url?: string;
}

export interface IPortalFeedback {
  details: { reason_id: string; comment?: string | null };
  returned_by: string | null;
  created_at: string;
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
  // Auth
  async requestMagicLink(email: string) {
    const res = await portalClient.post<IServerResponse<{ token: string }>>('/auth/magic-link', { email });
    return res.data;
  },

  async validateMagicLink(token: string) {
    const res = await portalClient.post<IServerResponse<IPortalUser>>('/auth/validate', { token });
    return res.data;
  },

  async getMe() {
    const res = await portalClient.get<IServerResponse<IPortalUser & { csrf_token?: string }>>('/auth/me');
    // Phase 2: capture CSRF token from session
    if (res.data.done && res.data.body?.csrf_token) {
      setPortalCSRFToken(res.data.body.csrf_token);
    }
    return res.data;
  },

  async logout() {
    const res = await portalClient.post<IServerResponse<null>>('/auth/logout');
    csrfToken = null;
    return res.data;
  },

  async getBranding() {
    const res = await portalClient.get<IServerResponse<IBranding>>('/branding');
    return res.data;
  },

  // Legacy deliverables (Phase 1)
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

  // Phase 2: Portal tasks
  async getTasks(params?: { status?: string; page?: number }) {
    const res = await portalClient.get<IServerResponse<IPortalTask[]>>('/tasks', { params });
    return res.data;
  },

  async getTask(id: string) {
    const res = await portalClient.get<IServerResponse<IPortalTask & { comments: IPortalComment[]; feedback: IPortalFeedback[] }>>(`/tasks/${id}`);
    return res.data;
  },

  async createTask(data: { title: string; description?: string; priority?: string; type_id?: string; channel_id?: string }) {
    const res = await portalClient.post<IServerResponse<IPortalTask>>('/tasks', data);
    return res.data;
  },

  async getTaskComments(taskId: string) {
    const res = await portalClient.get<IServerResponse<IPortalComment[]>>(`/tasks/${taskId}/comments`);
    return res.data;
  },

  async addTaskComment(taskId: string, content: string) {
    const res = await portalClient.post<IServerResponse<IPortalComment>>(`/tasks/${taskId}/comments`, { body: content });
    return res.data;
  },

  // Phase 2: Attachments
  async uploadAttachment(data: { file: string; file_name: string; task_id: string; size?: number; type?: string }) {
    const res = await portalClient.post<IServerResponse<IPortalAttachment>>('/attachments/tasks', data);
    return res.data;
  },

  async getAttachments(taskId: string) {
    const res = await portalClient.get<IServerResponse<IPortalAttachment[]>>(`/attachments/tasks/${taskId}`);
    return res.data;
  },

  async getDownloadUrl(attachmentId: string) {
    const res = await portalClient.get<IServerResponse<{ url: string }>>('/attachments/download', { params: { id: attachmentId } });
    return res.data;
  },
};
