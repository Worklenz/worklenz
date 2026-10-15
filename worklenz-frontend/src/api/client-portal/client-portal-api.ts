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
  /** Older invoices link to a retired service request; they keep showing it, read-only. */
  requestNumber?: string;
  /** The change request this invoice was started from, e.g. CR-0048. */
  changeRequestNumber?: string | null;
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
  /** Null when the invoice was not started from a change request. */
  changeRequest?: { id: string; number: string; title: string; status: string } | null;
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
    // Client Portal v2
    'PortalCounts',
    'PortalOverview',
    'PortalOverviewLayout',
    'PortalRoles',
    'PortalSettingsV2',
    'PortalProjects',
    'PortalProjectOverview',
    'PortalProjectAccess',
    'Milestones',
    'PortalTasks',
    'PortalFiles',
    'Approvals',
    'ChangeRequests',
    'Threads',
    'AuditLog',
    'PortalPreview',
    'PortalStaff',
    'PortalOrganizations',
    'PortalClientUsers',
    'PortalFileVersions',
  ],
  endpoints: builder => ({
    // Dashboard

    // Services


    // Requests





    // Request Comments (Admin side)


    // Projects
    getClientDetails: builder.query<ClientDetailsResponse, string>({
      query: id => `/clients/portal/clients/${id}/details`,
      providesTags: (result, error, id) => [
        { type: 'Client', id },
        { type: 'ClientStats', id },
        { type: 'ClientProjects', id },
        { type: 'ClientTeam', id },
      ],
    }),
    getProjects: builder.query<ProjectsResponse, void>({
      query: () => '/clients/portal/projects',
      providesTags: ['Projects'],
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
        /** Start from a change request (Approved, In Progress or Completed); it decides the client. */
        changeRequestId?: string;
        /** Without a change request the invoice is standalone and needs `clientId`. */
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
        // A change request lists the invoices created from it, so it must refetch.
        ...(invoiceData.changeRequestId ? (['ChangeRequests'] as const) : []),
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


    deleteInvoice: builder.mutation<void, string>({
      query: id => ({
        url: `/clients/portal/invoices/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Invoices', 'Dashboard'],
    }),

    // Chat (Client Portal Side - uses client token auth)





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


    // Profile


    // Notifications



    // File uploads

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



    // Client Team Management





    // Client Analytics



    // Bulk Operations


    // Organization-side Client Portal Management









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


















    // Team-defined Category / Billing type picklist values (layered on top of each field's
    // built-in options in the UI, same relationship RequestCustomStatuses has to status).



    // Client Invitation Management


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

  // Services

  // Requests

  // Projects
  useGetProjectsQuery,

  // Invoices
  useGetInvoicesQuery,
  useGetInvoiceDetailsQuery,
  useCreateInvoiceMutation,
  useRecordInvoicePaymentMutation,
  useDuplicateInvoiceMutation,
  useUpdateInvoiceMutation,
  useSendInvoiceMutation,
  useDeleteInvoiceMutation,

  // Chat

  // Settings

  // Profile

  // Notifications

  // File uploads

  // Client Management
  useGetClientsQuery,
  useGetClientDetailsQuery,
  useLazyGetClientDetailsQuery,
  useCreateClientMutation,
  useUpdateClientMutation,
  useDeactivateClientMutation,

  // Client Projects
  useGetClientProjectsQuery,

  // Client Team Management

  // Client Analytics

  // Bulk Operations

  // Organization-side Client Portal Management

  useGetClientsLookupQuery,

  // Organization-side Ticketing


  // Organization-side Client Portal Chats
  useGetOrganizationChatsQuery,
  useGetChatConversationsQuery,
  useCreateOrganizationChatMutation,
  useUploadOrganizationChatFileMutation,
  useSendOrganizationMessageMutation,
  useGetOrganizationMessagesQuery,

  // Client Invitation Management
  useHandleOrganizationInviteMutation,
} = clientPortalApi;
