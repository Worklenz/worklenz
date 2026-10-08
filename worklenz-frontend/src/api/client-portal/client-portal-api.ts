import {
  BaseQueryFn,
  FetchArgs,
  FetchBaseQueryError,
  createApi,
  fetchBaseQuery,
} from '@reduxjs/toolkit/query/react';
import { API_BASE_URL } from '@/shared/constants';
import { ensureCsrfToken, getCsrfToken, refreshCsrfToken } from '../api-client';
import config from '@/config/env';

export interface ClientPortalDashboardData {
  stats: {
    totalRequests: number;
    pendingRequests: number;
    totalProjects: number;
    activeProjects: number;
    totalInvoices: number;
    unpaidInvoices: number;
    unreadMessages: number;
  };
  recentActivity: any[];
}

export interface ClientPortalService {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  status: string;
  category: string;
}

export interface ClientPortalRequest {
  id: string;
  // snake_case from backend
  req_no: string;
  service_id: string;
  service_name: string;
  service_description?: string;
  client_id?: string;
  client_name: string;
  client_email?: string;
  status: string;
  request_data?: {
    title?: string;
    priority?: string;
    description?: string;
    attachments?: Array<{
      id: string;
      url: string;
      size: string;
      filename: string;
      originalName: string;
    }>;
    attachmentIds?: string[];
    [key: string]: any;
  };
  notes?: string;
  created_at: string;
  updated_at: string;
  completed_at?: string;
  assigned_to?: string;
  assigned_to_name?: string;
}

export interface ClientPortalProject {
  id: string;
  name: string;
  description: string;
  status: string;
  totalTasks: number;
  completedTasks: number;
  lastUpdated: string;
  members: string[];
}

export interface ClientPortalInvoice {
  // List fields (from getInvoices)
  id: string;
  invoiceNumber: string;
  amount: number;
  currency: string;
  status: string;
  dueDate: string;
  sentAt?: string;
  paidAt?: string;
  createdAt: string;
  updatedAt: string;
  requestNumber?: string;
  serviceName?: string;
  clientId?: string;
  clientName?: string;
  isOverdue?: boolean;
  /** Payment progress, independent of the document `status`. */
  paymentStatus?: 'unpaid' | 'partially_paid' | 'paid';
  /** Always within [0, amount]. */
  paidAmount?: number;
  projectName?: string | null;
}

export interface ClientPortalInvoiceLineItem {
  id?: string;
  description: string;
  quantity: number;
  rate: number;
  amount: number;
}

/** Organization-wide sums for the Invoices stat cards (not just the visible page). */
export interface ClientPortalInvoiceTotals {
  totalInvoiced: number;
  totalPaid: number;
  totalOutstanding: number;
}

export interface ClientPortalInvoiceDetails extends ClientPortalInvoice {
  notes?: string;
  lineItems?: ClientPortalInvoiceLineItem[];
  paymentProofUrl?: string | null;
  taxRate?: number;
  taxAmount?: number;
  discountType?: string;
  discountValue?: number;
  discountAmount?: number;
  subtotal?: number;
  request: {
    id: string;
    requestNumber: string;
    requestData: any;
    notes?: string;
    service: {
      id: string;
      name: string;
      description?: string;
    };
  } | null;
  client: {
    id?: string;
    name: string;
    companyName?: string | null;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
    contactPerson?: string | null;
  };
  createdBy: {
    name: string;
  } | null;
  organization?: {
    name: string | null;
    logoUrl: string | null;
    primaryColor: string | null;
    email: string | null;
    phone: string | null;
    addressLine1: string | null;
    addressLine2: string | null;
    city: string | null;
    state: string | null;
    zipCode: string | null;
    country: string | null;
    invoiceFooterMessage: string | null;
    templateStyle?: 'classic' | 'modern';
    showLogo?: boolean;
  };
}

// Invoice mutation request/response interfaces
export interface UpdateInvoiceRequest {
  amount?: number;
  currency?: string;
  /** `null` clears the due date. */
  dueDate?: string | null;
  notes?: string;
  status?: string;
  projectName?: string;
  lineItems?: Array<Omit<ClientPortalInvoiceLineItem, 'id'>>;
  taxRate?: number;
  taxAmount?: number;
  discountType?: string;
  discountValue?: number;
  discountAmount?: number;
  subtotal?: number;
}

export interface UpdateInvoiceResponseBody {
  id: string;
  invoice_no: string;
  amount: number;
  currency: string;
  status: string;
  due_date: string | null;
  sent_at: string | null;
  paid_at: string | null;
  updated_at: string;
}

export interface UpdateInvoiceResponse {
  done: boolean;
  body: UpdateInvoiceResponseBody;
  message: string;
  title: string | null;
}

export interface SendInvoiceResponseBody {
  id: string;
  invoice_no: string;
  status: string;
  sent_at: string;
}

export interface SendInvoiceResponse {
  done: boolean;
  body: SendInvoiceResponseBody;
  message: string;
  title: string | null;
}

export interface MarkInvoiceAsPaidResponseBody {
  id: string;
  invoice_no: string;
  status: string;
  paid_at: string;
}

export interface MarkInvoiceAsPaidResponse {
  done: boolean;
  body: MarkInvoiceAsPaidResponseBody;
  message: string;
  title: string | null;
}

export interface ClientPortalChat {
  id: string;
  title: string;
  participants: string[];
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
}

/** A client's whole conversation, as listed in the global Chats inbox (`id` is the client id). */
export interface ClientPortalChatConversation {
  id: string;
  clientId: string;
  name: string;
  projectsCount: number;
  portalStatus: {
    status: 'active' | 'invited' | 'not_invited' | 'expired';
    label: string;
    color: string;
  };
  /** Client-sent messages the team has not opened yet. */
  unreadCount: number;
  lastMessage: string | null;
  lastMessageAt: string | null;
  lastSenderType: 'team_member' | 'client' | null;
  lastSenderName: string | null;
}

export interface ClientPortalSettings {
  company_name: string;
  contact_person: string;
  email: string;
  phone: string;
  address: string;
  email_notifications: boolean;
  project_updates: boolean;
  invoice_notifications: boolean;
  request_updates: boolean;
}

export interface ClientPortalProfile {
  id: string;
  company_name: string;
  contact_person: string;
  email: string;
  phone: string;
  address: string;
  created_at: string;
  updated_at: string;
}

export interface ClientPortalNotification {
  id: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  created_at: string;
}

export interface ClientPortalMessage {
  id: string;
  content: string;
  sender_id: string;
  sender_name: string;
  created_at: string;
  updated_at: string;
  attachments?: any[];
}

// Client Management Interfaces
export interface ClientPortalClient {
  id: string;
  name: string;
  email: string;
  company_name?: string;
  phone?: string;
  phone_country_code?: string;
  address?: string;
  address_line_1?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  country?: string;
  contact_person?: string;
  /** Names of the company's POCs (a company can have zero, one or several). */
  poc_names?: string[];
  /** How many company users (people with, or waiting for, portal access) the company has. */
  company_users_count?: number;
  assigned_projects_count: number;
  projects: ClientPortalProject[];
  team_members: ClientPortalTeamMember[];
  status: 'active' | 'inactive' | 'pending';
  created_at: string;
  updated_at: string;
  // Portal access fields
  has_portal_access?: boolean;
  invitation_sent_at?: string | null;
  invitation_accepted?: boolean;
  last_login_at?: string | null;
  portal_status?: {
    status: 'active' | 'invited' | 'not_invited' | 'expired';
    label: string;
    color: string;
  };
}

export interface ClientsStats {
  total: number;
  active: number;
  invited: number;
  expired: number;
  not_invited: number;
  unanswered_messages: number;
}

export interface ClientsStatsResponse {
  done: boolean;
  body: ClientsStats;
  title: string | null;
  message: string | null;
}

export interface ClientPortalTeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar?: string;
  status: 'active' | 'inactive';
  accepted_at?: string | null;
}

export interface CreateClientRequest {
  name: string;
  email: string;
  company_name: string;
  phone?: string;
  phone_country_code?: string;
  address?: string;
  address_line_1?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  country?: string;
  contact_person: string;
  status?: 'active' | 'inactive' | 'pending';
}

export interface UpdateClientRequest {
  name?: string;
  email?: string;
  company_name?: string;
  phone?: string;
  phone_country_code?: string | null;
  address?: string;
  address_line_1?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  country?: string;
  contact_person?: string;
  status?: 'active' | 'inactive' | 'pending';
}

export interface InviteTeamMemberRequest {
  email: string;
  name: string;
  role?: string;
}

export interface ClientProjectsResponse {
  projects: ClientPortalProject[];
  total: number;
  page: number;
  limit: number;
}

export interface ClientTeamResponse {
  team_members: ClientPortalTeamMember[];
  total: number;
  page: number;
  limit: number;
}

export interface ClientsResponse {
  done: boolean;
  body: {
    clients: ClientPortalClient[];
    total: number;
    page: number;
    limit: number;
  };
  title: string | null;
  message: string | null;
}

export interface ClientDetailsResponse {
  done: boolean;
  body: ClientPortalClient & {
    stats: ClientStats;
    projects: ClientPortalProject[];
    team_members: ClientPortalTeamMember[];
  };
  title: string | null;
  message: string | null;
}

export interface ProjectsResponse {
  done: boolean;
  body: {
    projects: ClientPortalProject[];
    total: number;
    page: number;
    limit: number;
  };
  title: string | null;
  message: string | null;
}

export interface ClientStats {
  totalProjects: number;
  activeProjects: number;
  completedProjects: number;
  totalTeamMembers: number;
  activeTeamMembers: number;
  totalRequests: number;
  pendingRequests: number;
  totalInvoices: number;
  unpaidInvoices: number;
}

export interface ClientActivity {
  activities: any[];
  total: number;
  page: number;
  limit: number;
}

export interface BulkUpdateRequest {
  client_ids: string[];
  name?: string;
  email?: string;
  company_name?: string;
  phone?: string;
  address?: string;
  status?: 'active' | 'inactive' | 'pending';
}

export interface BulkDeleteRequest {
  client_ids: string[];
}

const rawBaseQuery = fetchBaseQuery({
  baseUrl: `${config.apiUrl}${API_BASE_URL}`,
  prepareHeaders: async headers => {
    let token = getCsrfToken();

    if (!token) {
      try {
        token = await ensureCsrfToken();
      } catch (error) {
        console.error('[CSRF] Failed to refresh CSRF token:', error);
      }
    }

    if (token) {
      headers.set('X-CSRF-Token', token);
    } else {
      console.warn('[CSRF] No CSRF token available - request may fail');
    }

    headers.set('Content-Type', 'application/json');
    return headers;
  },
  credentials: 'include',
});

const isCsrfError = (error?: FetchBaseQueryError): boolean => {
  if (!error || error.status !== 403 || !('data' in error)) {
    return false;
  }

  const errorData = error.data;

  if (typeof errorData === 'string') {
    const normalizedMessage = errorData.toLowerCase();
    return normalizedMessage.includes('csrf') || normalizedMessage.includes('security token');
  }

  if (typeof errorData === 'object' && errorData !== null && 'message' in errorData) {
    const message = errorData.message;
    if (typeof message === 'string') {
      const normalizedMessage = message.toLowerCase();
      return normalizedMessage.includes('csrf') || normalizedMessage.includes('security token');
    }
  }

  return false;
};

const baseQueryWithCsrfRetry: BaseQueryFn<
  string | FetchArgs,
  unknown,
  FetchBaseQueryError
> = async (args, api, extraOptions) => {
  let result = await rawBaseQuery(args, api, extraOptions);

  if (isCsrfError(result.error)) {
    const refreshedToken = await refreshCsrfToken();

    if (refreshedToken) {
      result = await rawBaseQuery(args, api, extraOptions);
    }
  }

  return result;
};

// RTK Query API
export const clientPortalApi = createApi({
  reducerPath: 'clientPortalApi',
  baseQuery: baseQueryWithCsrfRetry,
  tagTypes: [
    'Client',
    'Clients',
    'CompanyUsers',
    'CompanyUsersStats',
    'ClientTeam',
    'ClientStats',
    'ClientActivity',
    'ClientProjects',
    'Dashboard',
    'Services',
    'ServiceOptionValues',
    'Requests',
    'RequestCustomStatuses',
    'Tickets',
    'TicketCustomStatuses',
    'TicketAttachments',
    'Projects',
    'Invoices',
    'Quotes',
    'Chats',
    'Settings',
    'Profile',
    'Notifications',
  ],
  endpoints: builder => ({
    // Dashboard
    getDashboard: builder.query<ClientPortalDashboardData, void>({
      query: () => '/clients/portal/dashboard',
      providesTags: ['Dashboard'],
    }),

    // Services
    getServices: builder.query<ClientPortalService[], void>({
      query: () => '/clients/portal/services',
      providesTags: ['Services'],
    }),

    getServiceDetails: builder.query<ClientPortalService, string>({
      query: id => `/clients/portal/services/${id}`,
      providesTags: (result, error, id) => [{ type: 'Services', id }],
    }),

    // Requests
    getRequests: builder.query<
      {
        done: boolean;
        body: {
          requests: ClientPortalRequest[];
          total: number;
          page: number;
          limit: number;
        };
        message: string;
      },
      void
    >({
      query: () => '/clients/portal/requests',
      providesTags: ['Requests'],
    }),

    createRequest: builder.mutation<ClientPortalRequest, Partial<ClientPortalRequest>>({
      query: requestData => ({
        url: '/clients/portal/requests',
        method: 'POST',
        body: requestData,
      }),
      invalidatesTags: ['Requests', 'Dashboard'],
    }),

    getRequestDetails: builder.query<
      {
        done: boolean;
        body: ClientPortalRequest;
        message: string;
      },
      string
    >({
      query: id => `/clients/portal/requests/${id}`,
      providesTags: (result, error, id) => [{ type: 'Requests', id }],
    }),

    updateRequest: builder.mutation<
      ClientPortalRequest,
      { id: string; data: Partial<ClientPortalRequest> }
    >({
      query: ({ id, data }) => ({
        url: `/clients/portal/requests/${id}`,
        method: 'PUT',
        body: data,
      }),
      invalidatesTags: (result, error, { id }) => [
        { type: 'Requests', id },
        'Requests',
        'Dashboard',
      ],
    }),

    deleteRequest: builder.mutation<void, string>({
      query: id => ({
        url: `/clients/portal/requests/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Requests', 'Dashboard'],
    }),

    // Request Comments (Admin side)
    getRequestComments: builder.query<
      {
        done: boolean;
        body:
          | {
              comments: Array<{
                id: string;
                comment: string;
                sender_type: 'client' | 'team_member';
                sender_id: string;
                sender_name: string;
                created_at: string;
                updated_at: string;
              }>;
              totalCount: number;
              newCommentsCount: number;
            }
          | Array<{
              id: string;
              comment: string;
              sender_type: 'client' | 'team_member';
              sender_id: string;
              sender_name: string;
              created_at: string;
              updated_at: string;
            }>; // Support both old format (array) and new format (object)
        message: string;
      },
      string
    >({
      query: id => `/clients/portal/requests/${id}/comments`,
      providesTags: (result, error, id) => [{ type: 'Requests', id: `${id}-comments` }],
    }),

    addRequestComment: builder.mutation<
      {
        done: boolean;
        body: {
          id: string;
          comment: string;
          sender_type: 'client' | 'team_member';
          sender_id: string;
          sender_name: string;
          created_at: string;
          updated_at: string;
        };
        message: string;
      },
      { id: string; comment: string }
    >({
      query: ({ id, comment }) => ({
        url: `/clients/portal/requests/${id}/comments`,
        method: 'POST',
        body: { comment },
      }),
      invalidatesTags: (result, error, { id }) => [
        { type: 'Requests', id: `${id}-comments` },
        { type: 'Requests', id },
      ],
    }),

    // Projects
    getProjects: builder.query<ProjectsResponse, void>({
      query: () => '/clients/portal/projects',
      providesTags: ['Projects'],
    }),

    getProjectDetails: builder.query<ClientPortalProject, string>({
      query: id => `/clients/portal/projects/${id}`,
      providesTags: (result, error, id) => [{ type: 'Projects', id }],
    }),

    // Invoices
    getInvoices: builder.query<
      {
        done: boolean;
        body: {
          invoices: ClientPortalInvoice[];
          total: number;
          page: number;
          limit: number;
          totals?: ClientPortalInvoiceTotals;
        };
        message: string;
      },
      {
        page?: number;
        limit?: number;
        status?: string;
        paymentStatus?: string;
        search?: string;
        sortBy?: string;
        sortOrder?: 'asc' | 'desc';
        /** Only this client's invoices (the client workspace's Billing tab). */
        clientId?: string;
      } | void
    >({
      query: params => {
        const searchParams = new URLSearchParams();
        if (params && params.page) searchParams.set('page', String(params.page));
        if (params && params.limit) searchParams.set('limit', String(params.limit));
        if (params && params.status) searchParams.set('status', params.status);
        if (params && params.paymentStatus) searchParams.set('paymentStatus', params.paymentStatus);
        if (params && params.search) searchParams.set('search', params.search);
        if (params && params.sortBy) searchParams.set('sortBy', params.sortBy);
        if (params && params.sortOrder) searchParams.set('sortOrder', params.sortOrder);
        if (params && params.clientId) searchParams.set('clientId', params.clientId);

        const queryString = searchParams.toString();
        const url = `/clients/portal/invoices${queryString ? `?${queryString}` : ''}`;
        return url;
      },
      providesTags: ['Invoices'],
    }),

    getInvoiceDetails: builder.query<
      {
        done: boolean;
        body: ClientPortalInvoiceDetails;
        message: string;
      },
      string
    >({
      query: id => `/clients/portal/invoices/${id}`,
      providesTags: (result, error, id) => [{ type: 'Invoices', id }],
    }),

    getInvoicesByRequest: builder.query<
      {
        done: boolean;
        body: {
          invoices: ClientPortalInvoice[];
          count: number;
        };
        message: string;
      },
      string
    >({
      query: requestId => `/clients/portal/invoices/request/${requestId}`,
      providesTags: (result, error, requestId) => [
        { type: 'Invoices', id: 'LIST' },
        { type: 'Requests', id: requestId },
      ],
    }),

    payInvoice: builder.mutation<any, { id: string; paymentData: any }>({
      query: ({ id, paymentData }) => ({
        url: `/clients/portal/invoices/${id}/pay`,
        method: 'POST',
        body: paymentData,
      }),
      invalidatesTags: (result, error, { id }) => [
        { type: 'Invoices', id },
        'Invoices',
        'Dashboard',
      ],
    }),

    downloadInvoice: builder.query<Blob, string>({
      query: id => ({
        url: `/clients/portal/invoices/${id}/download`,
        responseHandler: response => response.blob(),
      }),
    }),

    createInvoice: builder.mutation<
      {
        done: boolean;
        body: {
          id: string;
          invoiceNumber: string;
          amount: number;
          currency: string;
          status: string;
          dueDate: string | null;
          createdAt: string;
          clientName: string;
          serviceName: string;
        };
        message: string;
      },
      {
        /** Optional: an invoice without a request is a standalone invoice and needs `clientId`. */
        requestId?: string;
        clientId?: string;
        projectName?: string;
        amount: number;
        currency?: string;
        dueDate?: string | null;
        notes?: string;
        status?: string;
        lineItems?: Array<Omit<ClientPortalInvoiceLineItem, 'id'>>;
        taxRate?: number;
        taxAmount?: number;
        discountType?: string;
        discountValue?: number;
        discountAmount?: number;
        subtotal?: number;
      }
    >({
      query: invoiceData => ({
        url: '/clients/portal/invoices',
        method: 'POST',
        body: invoiceData,
      }),
      invalidatesTags: (result, error, invoiceData) => [
        'Invoices',
        'Dashboard',
        ...(invoiceData.requestId ? [{ type: 'Requests' as const, id: invoiceData.requestId }] : []),
      ],
    }),

    // Record Payment: sets payment status + paid amount and optionally attaches a proof file
    // (sent as a base64 data URL, like the other client portal uploads).
    recordInvoicePayment: builder.mutation<
      { done: boolean; body: ClientPortalInvoice; message: string },
      {
        id: string;
        paymentStatus: 'unpaid' | 'partially_paid' | 'paid';
        paidAmount?: number;
        proof?: { fileName: string; fileType: string; fileData: string } | null;
      }
    >({
      query: ({ id, ...body }) => ({
        url: `/clients/portal/invoices/${id}/payment`,
        method: 'PUT',
        body,
      }),
      invalidatesTags: (result, error, { id }) => [
        { type: 'Invoices', id },
        'Invoices',
        'Dashboard',
      ],
    }),

    // Copies an invoice as a fresh draft: unpaid, nothing paid, issued today.
    duplicateInvoice: builder.mutation<
      { done: boolean; body: { id: string; invoiceNumber: string }; message: string },
      string
    >({
      query: id => ({
        url: `/clients/portal/invoices/${id}/duplicate`,
        method: 'POST',
      }),
      invalidatesTags: ['Invoices', 'Dashboard'],
    }),

    updateInvoice: builder.mutation<
      UpdateInvoiceResponse,
      { id: string; data: UpdateInvoiceRequest }
    >({
      query: ({ id, data }) => ({
        url: `/clients/portal/invoices/${id}`,
        method: 'PUT',
        body: data,
      }),
      invalidatesTags: (result, error, { id }) => [
        { type: 'Invoices', id },
        'Invoices',
        'Dashboard',
      ],
    }),

    sendInvoice: builder.mutation<SendInvoiceResponse, string>({
      query: id => ({
        url: `/clients/portal/invoices/${id}/send`,
        method: 'POST',
      }),
      invalidatesTags: (result, error, id) => [{ type: 'Invoices', id }, 'Invoices', 'Dashboard'],
    }),

    markInvoiceAsPaid: builder.mutation<MarkInvoiceAsPaidResponse, string>({
      query: id => ({
        url: `/clients/portal/invoices/${id}/mark-paid`,
        method: 'POST',
      }),
      invalidatesTags: (result, error, id) => [{ type: 'Invoices', id }, 'Invoices', 'Dashboard'],
    }),

    deleteInvoice: builder.mutation<void, string>({
      query: id => ({
        url: `/clients/portal/invoices/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Invoices', 'Dashboard'],
    }),

    // Chat (Client Portal Side - uses client token auth)
    getChats: builder.query<ClientPortalChat[], void>({
      query: () => ({
        url: `${config.apiUrl}/api/client-portal/chats`,
        method: 'GET',
      }),
      providesTags: ['Chats'],
    }),

    getChatDetails: builder.query<ClientPortalChat, string>({
      query: id => ({
        url: `${config.apiUrl}/api/client-portal/chats/${id}`,
        method: 'GET',
      }),
      providesTags: (result, error, id) => [{ type: 'Chats', id }],
    }),

    createChat: builder.mutation<
      { chatId: string; message: string },
      {
        recipientType: 'client' | 'team';
        recipientId: string;
        subject: string;
        message: string;
      }
    >({
      query: chatData => ({
        url: `${config.apiUrl}/api/client-portal/chats`,
        method: 'POST',
        body: chatData,
      }),
      invalidatesTags: ['Chats'],
    }),

    sendMessage: builder.mutation<
      any,
      { chatId: string; messageData: { content: string; attachments?: any[] } }
    >({
      query: ({ chatId, messageData }) => ({
        url: `${config.apiUrl}/api/client-portal/chats/${chatId}/messages`,
        method: 'POST',
        body: messageData,
      }),
      invalidatesTags: (result, error, { chatId }) => [{ type: 'Chats', id: chatId }, 'Chats'],
    }),

    getMessages: builder.query<ClientPortalMessage[], string>({
      query: chatId => ({
        url: `${config.apiUrl}/api/client-portal/chats/${chatId}/messages`,
        method: 'GET',
      }),
      providesTags: (result, error, chatId) => [{ type: 'Chats', id: chatId }],
    }),

    // Organization-side Client Portal Chats Management (for admin/organization users)
    getOrganizationChats: builder.query<
      | ClientPortalChat[]
      | { chats: ClientPortalChat[]; total: number; page: number; limit: number },
      { clientId?: string; page?: number; limit?: number }
    >({
      query: ({ clientId, page, limit }) => ({
        url: '/clients/portal/chats',
        params: clientId ? { clientId, page, limit } : { page, limit },
      }),
      transformResponse: (response: any) => {
        // Handle ServerResponse wrapper
        if (response && response.body) {
          // If body has chats array, return it; otherwise return the whole body
          if (response.body.chats && Array.isArray(response.body.chats)) {
            return response.body;
          }
          return response.body;
        }
        return response;
      },
      providesTags: ['Chats'],
    }),

    // One row per client (with at least one project) for the global Chats inbox
    getChatConversations: builder.query<ClientPortalChatConversation[], void>({
      query: () => '/clients/portal/chats/conversations',
      transformResponse: (response: any) => response?.body?.conversations ?? [],
      providesTags: ['Chats'],
    }),

    getOrganizationChatById: builder.query<ClientPortalChat, { id: string; clientId: string }>({
      query: ({ id, clientId }) => ({
        url: `/clients/portal/chats/${id}`,
        params: { clientId },
      }),
      providesTags: (result, error, { id }) => [{ type: 'Chats', id }],
    }),

    createOrganizationChat: builder.mutation<
      { chatId: string; message: string },
      {
        clientId: string;
        recipientType: 'client' | 'team';
        recipientId: string;
        subject: string;
        message: string;
      }
    >({
      query: ({ clientId, ...chatData }) => ({
        url: '/clients/portal/chats',
        method: 'POST',
        body: { ...chatData, clientId },
      }),
      transformResponse: (response: any) => {
        // Handle ServerResponse wrapper
        if (response && response.body) {
          return response.body;
        }
        return response;
      },
      invalidatesTags: ['Chats'],
    }),

    uploadOrganizationChatFile: builder.mutation<
      { url: string; fileName: string },
      { fileData: string; fileName: string; fileType: string; clientId?: string }
    >({
      query: body => ({
        url: '/clients/portal/chats/upload',
        method: 'POST',
        body,
      }),
      transformResponse: (response: any) => {
        if (response?.body) return response.body;
        return response;
      },
    }),

    sendOrganizationMessage: builder.mutation<
      any,
      { chatId: string; clientId: string; messageData: { content: string; attachments?: any[] } }
    >({
      query: ({ chatId, clientId, messageData }) => ({
        url: `/clients/portal/chats/${chatId}/messages`,
        method: 'POST',
        body: messageData,
        params: { clientId },
      }),
      invalidatesTags: (result, error, { chatId }) => [{ type: 'Chats', id: chatId }, 'Chats'],
    }),

    getOrganizationMessages: builder.query<
      | {
          messages: ClientPortalMessage[];
          date: string;
          total: number;
          page: number;
          limit: number;
        }
      | ClientPortalMessage[],
      { chatId: string; clientId: string }
    >({
      query: ({ chatId, clientId }) => ({
        url: `/clients/portal/chats/${chatId}/messages`,
        params: { clientId },
      }),
      transformResponse: (response: any) => {
        // Handle ServerResponse wrapper
        if (response && response.body) {
          return response.body;
        }
        return response;
      },
      providesTags: (result, error, { chatId }) => [{ type: 'Chats', id: chatId }],
    }),

    // Settings
    getSettings: builder.query<ClientPortalSettings, void>({
      query: () => '/client-portal/settings',
      providesTags: ['Settings'],
    }),

    updateSettings: builder.mutation<ClientPortalSettings, Partial<ClientPortalSettings>>({
      query: settingsData => ({
        url: '/client-portal/settings',
        method: 'PUT',
        body: settingsData,
      }),
      invalidatesTags: ['Settings'],
    }),

    // Profile
    getProfile: builder.query<ClientPortalProfile, void>({
      query: () => '/client-portal/profile',
      providesTags: ['Profile'],
    }),

    updateProfile: builder.mutation<ClientPortalProfile, Partial<ClientPortalProfile>>({
      query: profileData => ({
        url: '/client-portal/profile',
        method: 'PUT',
        body: profileData,
      }),
      invalidatesTags: ['Profile'],
    }),

    // Notifications
    getNotifications: builder.query<ClientPortalNotification[], void>({
      query: () => '/client-portal/notifications',
      providesTags: ['Notifications'],
    }),

    markNotificationRead: builder.mutation<void, string>({
      query: id => ({
        url: `/client-portal/notifications/${id}/read`,
        method: 'PUT',
      }),
      invalidatesTags: ['Notifications'],
    }),

    markAllNotificationsRead: builder.mutation<void, void>({
      query: () => ({
        url: '/client-portal/notifications/read-all',
        method: 'PUT',
      }),
      invalidatesTags: ['Notifications'],
    }),

    // File uploads
    uploadFile: builder.mutation<{ url: string; filename: string }, File>({
      query: file => {
        const formData = new FormData();
        formData.append('file', file);
        return {
          url: '/client-portal/upload',
          method: 'POST',
          body: formData,
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        };
      },
    }),

    // Client Management APIs (Organization-side endpoints)
    getClients: builder.query<
      ClientsResponse,
      {
        page?: number;
        limit?: number;
        search?: string;
        status?: string;
        sortBy?: string;
        sortOrder?: 'asc' | 'desc';
      }
    >({
      query: params => ({
        url: '/clients/portal/clients',
        params,
      }),
      providesTags: ['Clients'],
    }),

    getClientsStats: builder.query<ClientsStatsResponse, void>({
      query: () => '/clients/portal/clients/stats',
      providesTags: ['Clients'],
    }),

    getClientById: builder.query<ClientPortalClient, string>({
      query: id => `/clients/portal/clients/${id}`,
      providesTags: (result, error, id) => [{ type: 'Client', id }],
    }),

    getClientDetails: builder.query<ClientDetailsResponse, string>({
      query: id => `/clients/portal/clients/${id}/details`,
      providesTags: (result, error, id) => [
        { type: 'Client', id },
        { type: 'ClientStats', id },
        { type: 'ClientProjects', id },
        { type: 'ClientTeam', id },
      ],
    }),

    createClient: builder.mutation<ClientPortalClient, CreateClientRequest>({
      query: clientData => ({
        url: '/clients/portal/clients',
        method: 'POST',
        body: clientData,
      }),
      invalidatesTags: ['Clients'],
    }),

    updateClient: builder.mutation<ClientPortalClient, { id: string; data: UpdateClientRequest }>({
      query: ({ id, data }) => ({
        url: `/clients/portal/clients/${id}`,
        method: 'PUT',
        body: data,
      }),
      invalidatesTags: (result, error, { id }) => [
        { type: 'Client', id },
        { type: 'ClientStats', id },
        { type: 'ClientProjects', id },
        { type: 'ClientTeam', id },
        'Clients',
      ],
    }),

    deactivateClient: builder.mutation<void, string>({
      query: id => ({
        url: `/clients/portal/clients/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Clients'],
      // Optimistically mark the client as inactive so the Activate/Deactivate
      // menu item flips immediately without waiting for the refetch round-trip.
      onQueryStarted: async (id, { dispatch, queryFulfilled, getState }) => {
        const patches: ReturnType<typeof dispatch>[] = [];
        const state = getState() as any;
        const queryKeys = Object.keys(state?.clientPortalApi?.queries || {});
        for (const key of queryKeys) {
          if (!key.startsWith('getClients')) continue;
          const args = state.clientPortalApi.queries[key]?.originalArgs;
          const patch = dispatch(
            clientPortalApi.util.updateQueryData('getClients', args, draft => {
              const clients: any[] = (draft as any)?.body?.clients ?? [];
              const target = clients.find((c: any) => c.id === id);
              if (target) {
                target.status = 'inactive';
                target.has_portal_access = false;
              }
            })
          );
          patches.push(patch);
        }
        try {
          await queryFulfilled;
        } catch {
          patches.forEach(p => (p as any).undo?.());
        }
      },
    }),

    // Client Projects
    getClientProjects: builder.query<
      ClientProjectsResponse,
      { clientId: string; params?: { page?: number; limit?: number; status?: string } }
    >({
      query: ({ clientId, params }) => ({
        url: `/clients/portal/clients/${clientId}/projects`,
        params,
      }),
      providesTags: (result, error, { clientId }) => [{ type: 'ClientProjects', id: clientId }],
    }),

    assignProjectToClient: builder.mutation<void, { clientId: string; projectId: string }>({
      query: ({ clientId, projectId }) => ({
        url: `/clients/portal/clients/${clientId}/projects`,
        method: 'POST',
        body: { project_id: projectId },
      }),
      invalidatesTags: (result, error, { clientId }) => [{ type: 'ClientProjects', id: clientId }],
    }),

    removeProjectFromClient: builder.mutation<void, { clientId: string; projectId: string }>({
      query: ({ clientId, projectId }) => ({
        url: `/clients/portal/clients/${clientId}/projects/${projectId}`,
        method: 'DELETE',
      }),
      invalidatesTags: (result, error, { clientId }) => [{ type: 'ClientProjects', id: clientId }],
    }),

    // Client Team Management
    getClientTeam: builder.query<
      ClientTeamResponse,
      { clientId: string; params?: { page?: number; limit?: number; status?: string } }
    >({
      query: ({ clientId, params }) => ({
        url: `/clients/portal/clients/${clientId}/team`,
        params,
      }),
      providesTags: (result, error, { clientId }) => [{ type: 'ClientTeam', id: clientId }],
    }),

    inviteTeamMember: builder.mutation<
      ClientPortalTeamMember,
      { clientId: string; memberData: InviteTeamMemberRequest }
    >({
      query: ({ clientId, memberData }) => ({
        url: `/clients/portal/clients/${clientId}/team`,
        method: 'POST',
        body: memberData,
      }),
      invalidatesTags: (result, error, { clientId }) => [{ type: 'ClientTeam', id: clientId }],
    }),

    updateTeamMember: builder.mutation<
      ClientPortalTeamMember,
      { clientId: string; memberId: string; memberData: Partial<ClientPortalTeamMember> }
    >({
      query: ({ clientId, memberId, memberData }) => ({
        url: `/clients/portal/clients/${clientId}/team/${memberId}`,
        method: 'PUT',
        body: memberData,
      }),
      invalidatesTags: (result, error, { clientId }) => [{ type: 'ClientTeam', id: clientId }],
    }),

    removeTeamMember: builder.mutation<void, { clientId: string; memberId: string }>({
      query: ({ clientId, memberId }) => ({
        url: `/clients/portal/clients/${clientId}/team/${memberId}`,
        method: 'DELETE',
      }),
      invalidatesTags: (result, error, { clientId }) => [{ type: 'ClientTeam', id: clientId }],
    }),

    resendTeamInvitation: builder.mutation<void, { clientId: string; memberId: string }>({
      query: ({ clientId, memberId }) => ({
        url: `/clients/portal/clients/${clientId}/team/${memberId}/resend-invitation`,
        method: 'POST',
      }),
    }),

    // Client Analytics
    getClientStats: builder.query<ClientStats, string>({
      query: clientId => `/clients/portal/clients/${clientId}/stats`,
      providesTags: (result, error, clientId) => [{ type: 'ClientStats', id: clientId }],
    }),

    getClientActivity: builder.query<
      ClientActivity,
      { clientId: string; params?: { page?: number; limit?: number; type?: string } }
    >({
      query: ({ clientId, params }) => ({
        url: `/clients/portal/clients/${clientId}/activity`,
        params,
      }),
      providesTags: (result, error, { clientId }) => [{ type: 'ClientActivity', id: clientId }],
    }),

    exportClientData: builder.query<Blob, { clientId: string; format?: 'csv' | 'pdf' | 'excel' }>({
      query: ({ clientId, format = 'csv' }) => ({
        url: `/clients/portal/clients/${clientId}/export`,
        params: { format },
        responseHandler: response => response.blob(),
      }),
    }),

    // Bulk Operations
    bulkUpdateClients: builder.mutation<ClientPortalClient[], BulkUpdateRequest>({
      query: bulkData => ({
        url: '/clients/portal/clients/bulk-update',
        method: 'PUT',
        body: bulkData,
      }),
      invalidatesTags: ['Clients'],
    }),

    bulkDeactivateClients: builder.mutation<void, BulkDeleteRequest>({
      query: bulkData => ({
        url: '/clients/portal/clients/bulk-delete',
        method: 'DELETE',
        body: bulkData,
      }),
      invalidatesTags: ['Clients'],
    }),

    // Organization-side Client Portal Management
    getOrganizationRequests: builder.query<
      any,
      {
        page?: number;
        limit?: number;
        search?: string;
        status?: string;
        client_id?: string;
        service_id?: string;
        assigned_to?: string;
        sortBy?: string;
        sortOrder?: 'asc' | 'desc';
      }
    >({
      query: params => ({
        url: '/clients/portal/requests',
        params,
      }),
      providesTags: ['Requests'],
    }),

    getOrganizationRequestById: builder.query<any, string>({
      query: id => `/clients/portal/requests/${id}`,
      providesTags: (result, error, id) => [{ type: 'Requests', id }],
    }),

    updateOrganizationRequestStatus: builder.mutation<
      any,
      { id: string; status: string; notes?: string; assigned_to?: string }
    >({
      query: ({ id, ...data }) => ({
        url: `/clients/portal/requests/${id}/status`,
        method: 'PUT',
        body: data,
      }),
      invalidatesTags: (result, error, { id }) => [{ type: 'Requests', id }, 'Requests'],
    }),

    assignOrganizationRequest: builder.mutation<any, { id: string; assigned_to: string }>({
      query: ({ id, assigned_to }) => ({
        url: `/clients/portal/requests/${id}/assign`,
        method: 'PUT',
        body: { assigned_to },
      }),
      invalidatesTags: (result, error, { id }) => [{ type: 'Requests', id }, 'Requests'],
    }),

    getOrganizationRequestsStats: builder.query<any, void>({
      query: () => '/clients/portal/requests/stats',
      providesTags: ['Requests'],
    }),

    deleteOrganizationRequest: builder.mutation<any, string>({
      query: id => ({
        url: `/clients/portal/requests/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Requests'],
    }),

    getRequestCustomStatuses: builder.query<
      { done: boolean; body: { id: string; name: string; color: string }[] },
      void
    >({
      query: () => '/clients/portal/request-custom-statuses',
      providesTags: ['RequestCustomStatuses'],
    }),

    createRequestCustomStatus: builder.mutation<any, { name: string; color: string }>({
      query: data => ({
        url: '/clients/portal/request-custom-statuses',
        method: 'POST',
        body: data,
      }),
      invalidatesTags: ['RequestCustomStatuses'],
    }),

    deleteRequestCustomStatus: builder.mutation<any, string>({
      query: id => ({
        url: `/clients/portal/request-custom-statuses/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['RequestCustomStatuses'],
    }),

    // Lightweight {id, name} list of every client on the team, for filter dropdowns
    // (e.g. the Ticketing List view's Client column filter).
    getClientsLookup: builder.query<
      { done: boolean; body: { id: string; name: string }[] },
      void
    >({
      query: () => '/clients/lookup',
      providesTags: ['Clients'],
    }),

    // Organization-side Ticketing (admin queue only)
    getTickets: builder.query<
      any,
      {
        page?: number;
        limit?: number;
        search?: string;
        status?: string;
        client_id?: string;
        priority?: string;
        sortBy?: string;
        sortOrder?: 'asc' | 'desc';
      }
    >({
      query: params => ({
        url: '/clients/portal/tickets',
        params,
      }),
      providesTags: ['Tickets'],
    }),

    getTicketsStats: builder.query<any, void>({
      query: () => '/clients/portal/tickets/stats',
      providesTags: ['Tickets'],
    }),

    getTicketById: builder.query<any, string>({
      query: id => `/clients/portal/tickets/${id}`,
      providesTags: (result, error, id) => [{ type: 'Tickets', id }],
    }),

    updateTicketStatus: builder.mutation<any, { id: string; status: string }>({
      query: ({ id, status }) => ({
        url: `/clients/portal/tickets/${id}/status`,
        method: 'PUT',
        body: { status },
      }),
      invalidatesTags: (result, error, { id }) => [{ type: 'Tickets', id }, 'Tickets'],
    }),

    getTicketComments: builder.query<any, string>({
      query: id => `/clients/portal/tickets/${id}/comments`,
      providesTags: (result, error, id) => [{ type: 'Tickets', id: `${id}-comments` }],
    }),

    addTicketComment: builder.mutation<any, { id: string; comment: string }>({
      query: ({ id, comment }) => ({
        url: `/clients/portal/tickets/${id}/comments`,
        method: 'POST',
        body: { comment },
      }),
      invalidatesTags: (result, error, { id }) => [{ type: 'Tickets', id: `${id}-comments` }],
    }),

    convertTicketToTask: builder.mutation<
      { done: boolean; body: { task_id: string; project_id: string }; message: string | null },
      { id: string; project_id: string }
    >({
      query: ({ id, project_id }) => ({
        url: `/clients/portal/tickets/${id}/convert-to-task`,
        method: 'POST',
        body: { project_id },
      }),
      invalidatesTags: (result, error, { id }) => [{ type: 'Tickets', id }, 'Tickets'],
    }),

    getTicketCustomStatuses: builder.query<
      { done: boolean; body: { id: string; name: string; color: string }[] },
      void
    >({
      query: () => '/clients/portal/ticket-custom-statuses',
      providesTags: ['TicketCustomStatuses'],
    }),

    createTicketCustomStatus: builder.mutation<any, { name: string; color: string }>({
      query: data => ({
        url: '/clients/portal/ticket-custom-statuses',
        method: 'POST',
        body: data,
      }),
      invalidatesTags: ['TicketCustomStatuses'],
    }),

    deleteTicketCustomStatus: builder.mutation<any, string>({
      query: id => ({
        url: `/clients/portal/ticket-custom-statuses/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['TicketCustomStatuses'],
    }),

    getTicketAttachments: builder.query<any, string>({
      query: id => `/clients/portal/tickets/${id}/attachments`,
      providesTags: (result, error, id) => [{ type: 'TicketAttachments', id }],
    }),

    uploadTicketAttachment: builder.mutation<
      any,
      { id: string; fileData: string; fileName: string; fileType: string }
    >({
      query: ({ id, ...data }) => ({
        url: `/clients/portal/tickets/${id}/attachments`,
        method: 'POST',
        body: data,
      }),
      invalidatesTags: (result, error, { id }) => [{ type: 'TicketAttachments', id }],
    }),

    deleteTicketAttachment: builder.mutation<any, { id: string; attachmentId: string }>({
      query: ({ id, attachmentId }) => ({
        url: `/clients/portal/tickets/${id}/attachments/${attachmentId}`,
        method: 'DELETE',
      }),
      invalidatesTags: (result, error, { id }) => [{ type: 'TicketAttachments', id }],
    }),

    getOrganizationServices: builder.query<
      {
        done: boolean;
        body: {
          data: any[];
          total: number;
        };
        title: string | null;
        message: string | null;
      },
      {
        page?: number;
        limit?: number;
        search?: string;
        status?: string;
        sortBy?: string;
        sortOrder?: 'asc' | 'desc';
      }
    >({
      query: params => ({
        url: '/clients/portal/services',
        params,
      }),
      providesTags: ['Services'],
    }),

    getOrganizationServiceById: builder.query<any, string>({
      query: id => `/clients/portal/services/${id}`,
      providesTags: (result, error, id) => [{ type: 'Services', id }],
    }),

    createOrganizationService: builder.mutation<
      any,
      {
        name: string;
        description?: string;
        service_data?: any;
        is_public?: boolean;
        allowed_client_ids?: string[];
        price?: number | null;
        currency?: string;
        category?: string;
        billing_type?: string;
        imageData?: string;
        imageName?: string;
        imageType?: string;
      }
    >({
      query: serviceData => ({
        url: '/clients/portal/services',
        method: 'POST',
        body: serviceData,
      }),
      invalidatesTags: ['Services'],
    }),

    updateOrganizationService: builder.mutation<
      any,
      {
        id: string;
        data: {
          name?: string;
          description?: string;
          service_data?: any;
          is_public?: boolean;
          allowed_client_ids?: string[];
          status?: string;
          price?: number | null;
          currency?: string;
          category?: string;
          billing_type?: string;
          imageData?: string;
          imageName?: string;
          imageType?: string;
        };
      }
    >({
      query: ({ id, data }) => ({
        url: `/clients/portal/services/${id}`,
        method: 'PUT',
        body: data,
      }),
      invalidatesTags: (result, error, { id }) => [{ type: 'Services', id }, 'Services'],
    }),

    deleteOrganizationService: builder.mutation<void, string>({
      query: id => ({
        url: `/clients/portal/services/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Services'],
    }),

    // Team-defined Category / Billing type picklist values (layered on top of each field's
    // built-in options in the UI, same relationship RequestCustomStatuses has to status).
    getServiceOptionValues: builder.query<
      { done: boolean; body: { id: string; kind: 'category' | 'billing_type'; value: string }[] },
      'category' | 'billing_type'
    >({
      query: kind => ({
        url: '/clients/portal/service-option-values',
        params: { kind },
      }),
      providesTags: ['ServiceOptionValues'],
    }),

    createServiceOptionValue: builder.mutation<
      any,
      { kind: 'category' | 'billing_type'; value: string }
    >({
      query: data => ({
        url: '/clients/portal/service-option-values',
        method: 'POST',
        body: data,
      }),
      invalidatesTags: ['ServiceOptionValues'],
    }),

    deleteServiceOptionValue: builder.mutation<any, string>({
      query: id => ({
        url: `/clients/portal/service-option-values/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['ServiceOptionValues'],
    }),

    // Client Invitation Management
    generateClientInvitationLink: builder.mutation<any, { clientId: string }>({
      query: ({ clientId }) => ({
        url: '/clients/portal/generate-invitation-link',
        method: 'POST',
        body: { clientId },
      }),
      // A generated invitation moves the client to "Invited", so the list and stats must refresh.
      invalidatesTags: ['Clients'],
    }),

    resendClientInvitation: builder.mutation<
      {
        done: boolean;
        body: {
          invitationLink: string;
          clientName: string;
          clientEmail: string;
          expiresAt: string;
          emailSent: boolean;
        };
        message: string;
      },
      { clientId: string }
    >({
      query: ({ clientId }) => ({
        url: `/clients/portal/clients/${clientId}/resend-invitation`,
        method: 'POST',
      }),
      invalidatesTags: ['Clients'],
    }),

    // Handle organization invitation
    handleOrganizationInvite: builder.mutation<
      { redirectTo: string; message: string },
      { token: string }
    >({
      query: ({ token }) => ({
        url: '/client-portal/handle-organization-invite',
        method: 'POST',
        body: { token },
      }),
    }),
  }),
});

// Export hooks
export const {
  // Dashboard
  useGetDashboardQuery,

  // Services
  useGetServicesQuery,
  useGetServiceDetailsQuery,

  // Requests
  useGetRequestsQuery,
  useCreateRequestMutation,
  useGetRequestDetailsQuery,
  useUpdateRequestMutation,
  useDeleteRequestMutation,
  useGetRequestCommentsQuery,
  useAddRequestCommentMutation,

  // Projects
  useGetProjectsQuery,
  useGetProjectDetailsQuery,

  // Invoices
  useGetInvoicesQuery,
  useGetInvoiceDetailsQuery,
  useGetInvoicesByRequestQuery,
  usePayInvoiceMutation,
  useDownloadInvoiceQuery,
  useCreateInvoiceMutation,
  useRecordInvoicePaymentMutation,
  useDuplicateInvoiceMutation,
  useUpdateInvoiceMutation,
  useSendInvoiceMutation,
  useMarkInvoiceAsPaidMutation,
  useDeleteInvoiceMutation,

  // Chat
  useGetChatsQuery,
  useGetChatDetailsQuery,
  useCreateChatMutation,
  useSendMessageMutation,
  useGetMessagesQuery,

  // Settings
  useGetSettingsQuery,
  useUpdateSettingsMutation,

  // Profile
  useGetProfileQuery,
  useUpdateProfileMutation,

  // Notifications
  useGetNotificationsQuery,
  useMarkNotificationReadMutation,
  useMarkAllNotificationsReadMutation,

  // File uploads
  useUploadFileMutation,

  // Client Management
  useGetClientsQuery,
  useGetClientsStatsQuery,
  useGetClientByIdQuery,
  useGetClientDetailsQuery,
  useLazyGetClientDetailsQuery,
  useCreateClientMutation,
  useUpdateClientMutation,
  useDeactivateClientMutation,

  // Client Projects
  useGetClientProjectsQuery,
  useAssignProjectToClientMutation,
  useRemoveProjectFromClientMutation,

  // Client Team Management
  useGetClientTeamQuery,
  useInviteTeamMemberMutation,
  useUpdateTeamMemberMutation,
  useRemoveTeamMemberMutation,
  useResendTeamInvitationMutation,

  // Client Analytics
  useGetClientStatsQuery,
  useGetClientActivityQuery,
  useExportClientDataQuery,

  // Bulk Operations
  useBulkUpdateClientsMutation,
  useBulkDeactivateClientsMutation,

  // Organization-side Client Portal Management
  useGetOrganizationRequestsQuery,
  useGetOrganizationRequestByIdQuery,
  useUpdateOrganizationRequestStatusMutation,
  useAssignOrganizationRequestMutation,
  useGetOrganizationRequestsStatsQuery,
  useDeleteOrganizationRequestMutation,
  useGetRequestCustomStatusesQuery,
  useCreateRequestCustomStatusMutation,
  useDeleteRequestCustomStatusMutation,

  useGetClientsLookupQuery,

  // Organization-side Ticketing
  useGetTicketsQuery,
  useGetTicketsStatsQuery,
  useGetTicketByIdQuery,
  useUpdateTicketStatusMutation,
  useGetTicketCommentsQuery,
  useAddTicketCommentMutation,
  useConvertTicketToTaskMutation,
  useGetTicketCustomStatusesQuery,
  useCreateTicketCustomStatusMutation,
  useDeleteTicketCustomStatusMutation,
  useGetTicketAttachmentsQuery,
  useUploadTicketAttachmentMutation,
  useDeleteTicketAttachmentMutation,

  useGetOrganizationServicesQuery,
  useGetOrganizationServiceByIdQuery,
  useCreateOrganizationServiceMutation,
  useUpdateOrganizationServiceMutation,
  useDeleteOrganizationServiceMutation,
  useGetServiceOptionValuesQuery,
  useCreateServiceOptionValueMutation,
  useDeleteServiceOptionValueMutation,

  // Organization-side Client Portal Chats
  useGetOrganizationChatsQuery,
  useGetChatConversationsQuery,
  useGetOrganizationChatByIdQuery,
  useCreateOrganizationChatMutation,
  useUploadOrganizationChatFileMutation,
  useSendOrganizationMessageMutation,
  useGetOrganizationMessagesQuery,

  // Client Invitation Management
  useGenerateClientInvitationLinkMutation,
  useResendClientInvitationMutation,
  useHandleOrganizationInviteMutation,
} = clientPortalApi;
