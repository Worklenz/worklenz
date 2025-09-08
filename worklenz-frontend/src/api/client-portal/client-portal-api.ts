import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { API_BASE_URL } from '@/shared/constants';
import { getCsrfToken, refreshCsrfToken } from '../api-client';
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
  requestNumber: string;
  serviceId: string;
  serviceName: string;
  serviceDescription?: string;
  status: string;
  requestData?: any;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  clientName: string;
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
  id: string;
  invoice_no: string;
  amount: number;
  currency: string;
  status: string;
  due_date: string;
  created_at: string;
  sent_at?: string;
  paid_at?: string;
}

export interface ClientPortalChat {
  id: string;
  title: string;
  participants: string[];
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
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
  address?: string;
  assigned_projects_count: number;
  projects: ClientPortalProject[];
  team_members: ClientPortalTeamMember[];
  status: 'active' | 'inactive' | 'pending';
  created_at: string;
  updated_at: string;
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
  company_name?: string;
  phone?: string;
  address?: string;
}

export interface UpdateClientRequest {
  name?: string;
  email?: string;
  company_name?: string;
  phone?: string;
  address?: string;
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

// RTK Query API
export const clientPortalApi = createApi({
  reducerPath: 'clientPortalApi',
  baseQuery: fetchBaseQuery({
    baseUrl: `${config.apiUrl}${API_BASE_URL}`,
    prepareHeaders: async headers => {
      // Get CSRF token, refresh if needed
      let token = getCsrfToken();
      if (!token) {
        token = await refreshCsrfToken();
      }

      if (token) {
        headers.set('X-CSRF-Token', token);
      }

      headers.set('Content-Type', 'application/json');
      return headers;
    },
    credentials: 'include',
  }),
  tagTypes: [
    'Client',
    'Clients',
    'ClientTeam',
    'ClientStats',
    'ClientActivity',
    'ClientProjects',
    'Dashboard',
    'Services',
    'Requests',
    'Projects',
    'Invoices',
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

    getRequestDetails: builder.query<ClientPortalRequest, string>({
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
    getInvoices: builder.query<ClientPortalInvoice[], void>({
      query: () => '/clients/portal/invoices',
      providesTags: ['Invoices'],
    }),

    getInvoiceDetails: builder.query<ClientPortalInvoice, string>({
      query: id => `/clients/portal/invoices/${id}`,
      providesTags: (result, error, id) => [{ type: 'Invoices', id }],
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

    // Chat
    getChats: builder.query<ClientPortalChat[], void>({
      query: () => '/clients/portal/chats',
      providesTags: ['Chats'],
    }),

    getChatDetails: builder.query<ClientPortalChat, string>({
      query: id => `/clients/portal/chats/${id}`,
      providesTags: (result, error, id) => [{ type: 'Chats', id }],
    }),

    sendMessage: builder.mutation<
      any,
      { chatId: string; messageData: { content: string; attachments?: any[] } }
    >({
      query: ({ chatId, messageData }) => ({
        url: `/clients/portal/chats/${chatId}/messages`,
        method: 'POST',
        body: messageData,
      }),
      invalidatesTags: (result, error, { chatId }) => [{ type: 'Chats', id: chatId }, 'Chats'],
    }),

    getMessages: builder.query<ClientPortalMessage[], string>({
      query: chatId => `/clients/portal/chats/${chatId}/messages`,
      providesTags: (result, error, chatId) => [{ type: 'Chats', id: chatId }],
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
      invalidatesTags: (result, error, { id }) => [{ type: 'Client', id }, 'Clients'],
    }),

    deleteClient: builder.mutation<void, string>({
      query: id => ({
        url: `/clients/portal/clients/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Clients'],
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

    bulkDeleteClients: builder.mutation<void, BulkDeleteRequest>({
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

    getOrganizationServices: builder.query<
      any,
      {
        page?: number;
        limit?: number;
        search?: string;
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
      }
    >({
      query: serviceData => ({
        url: '/clients/portal/services',
        method: 'POST',
        body: serviceData,
      }),
      invalidatesTags: ['Services'],
    }),

    updateOrganizationService: builder.mutation<any, { id: string; data: any }>({
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

    // Client Invitation Management
    generateClientInvitationLink: builder.mutation<any, { clientId: string }>({
      query: ({ clientId }) => ({
        url: '/clients/portal/generate-invitation-link',
        method: 'POST',
        body: { clientId },
      }),
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

  // Projects
  useGetProjectsQuery,
  useGetProjectDetailsQuery,

  // Invoices
  useGetInvoicesQuery,
  useGetInvoiceDetailsQuery,
  usePayInvoiceMutation,
  useDownloadInvoiceQuery,

  // Chat
  useGetChatsQuery,
  useGetChatDetailsQuery,
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
  useGetClientByIdQuery,
  useGetClientDetailsQuery,
  useCreateClientMutation,
  useUpdateClientMutation,
  useDeleteClientMutation,

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
  useBulkDeleteClientsMutation,

  // Organization-side Client Portal Management
  useGetOrganizationRequestsQuery,
  useGetOrganizationRequestByIdQuery,
  useUpdateOrganizationRequestStatusMutation,
  useAssignOrganizationRequestMutation,
  useGetOrganizationRequestsStatsQuery,
  useGetOrganizationServicesQuery,
  useGetOrganizationServiceByIdQuery,
  useCreateOrganizationServiceMutation,
  useUpdateOrganizationServiceMutation,
  useDeleteOrganizationServiceMutation,

  // Client Invitation Management
  useGenerateClientInvitationLinkMutation,
  useHandleOrganizationInviteMutation,
} = clientPortalApi;
