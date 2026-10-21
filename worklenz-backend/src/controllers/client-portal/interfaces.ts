/**
 * Client Portal Domain Type Definitions
 * Centralized type definitions for all client portal controllers
 */

// ==================== Request/Response DTOs ====================

export interface IServiceDTO {
  id: string;
  name: string;
  description?: string;
  status: string;
  serviceData?: any;
  isPublic: boolean;
  price?: number;
  currency?: string;
  category?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IRequestDTO {
  id: string;
  req_no: string;
  service_id: string;
  service_name?: string;
  service_description?: string;
  status: string;
  request_data?: any;
  notes?: string;
  created_at: Date;
  updated_at: Date;
  completed_at?: Date;
  client_name?: string;
}

export interface ICommentDTO {
  id: string;
  comment: string;
  sender_type: 'client' | 'team';
  sender_id: string;
  sender_name: string;
  created_at: Date;
  updated_at: Date;
}

export interface IProjectDTO {
  id: string;
  name: string;
  description?: string;
  status?: string;
  status_color?: string;
  client_id?: string;
  client_name?: string;
  created_at: Date;
  updated_at: Date;
  start_date?: Date;
  end_date?: Date;
  total_tasks?: number;
  completed_tasks?: number;
}

export interface IInvoiceDTO {
  id: string;
  invoice_number: string;
  request_id?: string;
  request_number?: string;
  amount: number;
  currency: string;
  status: 'pending' | 'paid' | 'overdue' | 'cancelled';
  due_date: Date;
  paid_date?: Date;
  created_at: Date;
  updated_at: Date;
  items?: any;
  notes?: string;
}

export interface IChatDTO {
  id: string;
  client_id: string;
  organization_team_id: string;
  last_message?: string;
  last_message_at?: Date;
  unread_count?: number;
  created_at: Date;
}

export interface IMessageDTO {
  id: string;
  chat_id: string;
  sender_type: 'client' | 'team';
  sender_id: string;
  sender_name: string;
  message: string;
  is_read: boolean;
  created_at: Date;
}

export interface INotificationDTO {
  id: string;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  reference_id?: string;
  reference_number?: string;
  metadata?: any;
  created_at: Date;
}

export interface IClientDTO {
  id: string;
  name: string;
  email: string;
  company_name?: string;
  phone?: string;
  phone_country_code?: string;
  address?: string;
  status: 'active' | 'inactive' | 'pending';
  team_id: string;
  invite_slug?: string;
  created_at: Date;
  updated_at: Date;
}

export interface IClientTeamMemberDTO {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'member';
  status: 'active' | 'pending' | 'inactive';
  client_id: string;
  invited_by?: string;
  invited_at?: Date;
  accepted_at?: Date;
}

// ==================== Settings & Configuration ====================

export interface IOrganizationSettings {
  id: string;
  team_id: string;
  name: string;
  logo_url?: string;
  primary_color?: string;
  secondary_color?: string;
  portal_url?: string;
  contact_email?: string;
  contact_phone?: string;
  address?: string;
  branding_enabled: boolean;
  custom_domain?: string;
  created_at: Date;
  updated_at: Date;
}

// ==================== Invitation Types ====================

export interface IInvitationData {
  token?: string;
  slug?: string;
  email: string;
  name?: string;
  clientId?: string;
  organizationId?: string;
  expiresAt?: Date;
  role?: 'admin' | 'member';
  invitedBy?: string;
}

export interface IClientInvitation {
  id: string;
  client_id: string;
  email: string;
  name?: string;
  role: 'admin' | 'member';
  token: string;
  expires_at: Date;
  invited_by: string;
  status: 'pending' | 'accepted' | 'expired' | 'cancelled';
  created_at: Date;
  accepted_at?: Date;
}

// ==================== Authentication Types ====================

export interface ILoginCredentials {
  email: string;
  password: string;
}

export interface IAuthResponse {
  user: {
    id: string;
    name: string;
    email: string;
    clientId: string;
    organizationId: string;
  };
  token: string;
  refreshToken?: string;
}

export interface IClientProfile {
  id: string;
  name: string;
  email: string;
  clientId: string;
  organizationId: string;
  role: string;
  avatar?: string;
  created_at: Date;
  updated_at: Date;
}

// ==================== Dashboard Types ====================

export interface IDashboardStats {
  totalProjects: number;
  activeProjects: number;
  completedProjects: number;
  totalRequests: number;
  pendingRequests: number;
  acceptedRequests: number;
  inProgressRequests: number;
  completedRequests: number;
  rejectedRequests: number;
  totalInvoices: number;
  unpaidInvoices: number;
  unpaidAmount: number;
}

// ==================== Email Template Data ====================

export interface IInvitationEmailData {
  inviteeName: string;
  inviterName: string;
  clientName: string;
  companyName?: string;
  inviteLink: string;
  expiresAt: Date;
  role: string;
  teamName?: string;
}

export interface IWelcomeEmailData {
  userName: string;
  clientName: string;
  companyName?: string;
  organizationName: string;
  portalLink: string;
  logoUrl?: string | null;
  primaryColor?: string;
}

export interface IOrganizationInvitationEmailData {
  inviteeName: string;
  inviterName: string;
  organizationName: string;
  inviteLink: string;
  expiresAt: Date;
}

// ==================== Pagination Types ====================

export interface IPaginationParams {
  page: number;
  limit: number;
  offset: number;
}

export interface IPaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasMore: boolean;
}

// ==================== Request Status Options ====================

export interface IRequestStatusOption {
  value: string;
  label: string;
  description: string;
  color: string;
}

// ==================== Activity & Export Types ====================

export interface IClientActivity {
  id: string;
  type: string;
  description: string;
  metadata?: any;
  created_at: Date;
  user_id?: string;
  user_name?: string;
}

export interface IClientStats {
  total_projects: number;
  total_requests: number;
  total_invoices: number;
  total_spent: number;
  active_since: Date;
}

export interface IExportFormat {
  format: 'json' | 'csv';
  fields?: string[];
  dateRange?: {
    start: Date;
    end: Date;
  };
}
