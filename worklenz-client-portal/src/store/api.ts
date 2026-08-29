import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type { BaseQueryFn, FetchArgs, FetchBaseQueryError } from '@reduxjs/toolkit/query';
import {
  ApiResponse,
  ClientRequest,
  ClientSettings,
  ClientUser,
  ClientService,
  ClientProject,
  ClientInvoice,
  ClientChat,
  ClientNotification,
  DashboardStats,
  PaginatedResponse
} from '@/types';

const rawBaseQuery = fetchBaseQuery({
  baseUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api/client-portal',
  prepareHeaders: (headers) => {
    const token = localStorage.getItem('clientToken');
    if (token) {
      headers.set('x-client-token', token);
    }
    return headers;
  },
});

// Wrap the base query to handle 403 deactivation responses.
// fetchBaseQuery doesn't go through the ApiService axios interceptor, so RTK Query
// requests that receive "account is deactivated" 403s would otherwise be silently
// swallowed — the already-logged-in client could keep browsing indefinitely.
const baseQuery: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (
  args,
  api,
  extraOptions
) => {
  const result = await rawBaseQuery(args, api, extraOptions);
  if (result.error?.status === 403) {
    const message: string =
      (result.error.data as any)?.message || '';
    const isDeactivated =
      message.toLowerCase().includes('deactivated') ||
      message.toLowerCase().includes('portal access is disabled');
    if (isDeactivated) {
      localStorage.removeItem('clientToken');
      localStorage.removeItem('clientTokenExpiry');
      window.dispatchEvent(new CustomEvent('client-deactivated'));
    }
  }
  return result;
};

// Create the API slice
export const clientPortalApi = createApi({
  reducerPath: 'clientPortalApi',
  baseQuery,
  tagTypes: [
    'Dashboard',
    'Services',
    'Requests',
    'Projects',
    'Invoices',
    'Chats',
    'Settings',
    'Profile',
    'Notifications',
    'Organizations'
  ],
  endpoints: (builder) => ({
    // Dashboard
    getDashboard: builder.query<ApiResponse<DashboardStats>, void>({
      query: () => '/dashboard',
      providesTags: ['Dashboard'],
    }),

    // Services
    getServices: builder.query<ApiResponse<ClientService[]>, void>({
      query: () => '/services',
      providesTags: ['Services'],
    }),

    getServiceDetails: builder.query<ApiResponse<ClientService>, string>({
      query: (id) => `/services/${id}`,
      providesTags: (_result, _error, id) => [{ type: 'Services', id }],
    }),

    // Requests
    getRequests: builder.query<ApiResponse<PaginatedResponse<ClientRequest>>, { page?: number; limit?: number }>({
      query: (params) => ({
        url: '/requests',
        params,
      }),
      providesTags: ['Requests'],
    }),

    createRequest: builder.mutation<
      ApiResponse<ClientRequest>,
      { serviceId: string; requestData?: any; notes?: string }
    >({
      query: (data) => ({
        url: '/requests',
        method: 'POST',
        body: data,
      }),
      invalidatesTags: ['Requests', 'Dashboard'],
    }),

    getRequestDetails: builder.query<ApiResponse<ClientRequest>, string>({
      query: (id) => `/requests/${id}`,
      providesTags: (_result, _error, id) => [{ type: 'Requests', id }],
    }),

    getRequestStatusHistory: builder.query<ApiResponse<Array<{
      id: string;
      previous_status: string | null;
      new_status: string;
      notes: string | null;
      changed_at: string;
      changed_by_name: string | null;
      changed_by_client_name: string | null;
    }>>, string>({
      query: (id) => `/requests/${id}/history`,
      providesTags: (_result, _error, id) => [{ type: 'Requests', id }],
    }),

    getRequestComments: builder.query<ApiResponse<Array<{
      id: string;
      comment: string;
      sender_type: 'client' | 'team_member';
      sender_id: string;
      sender_name: string;
      created_at: string;
      updated_at: string;
    }>>, string>({
      query: (id) => `/requests/${id}/comments`,
      providesTags: (_result, _error, id) => [{ type: 'Requests', id: `${id}-comments` }],
    }),

    addRequestComment: builder.mutation<ApiResponse<{
      id: string;
      comment: string;
      sender_type: 'client' | 'team_member';
      sender_id: string;
      sender_name: string;
      created_at: string;
      updated_at: string;
    }>, { id: string; comment: string }>({
      query: ({ id, comment }) => ({
        url: `/requests/${id}/comments`,
        method: 'POST',
        body: { comment },
      }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'Requests', id: `${id}-comments` },
        { type: 'Requests', id },
      ],
    }),

    updateRequest: builder.mutation<ApiResponse<ClientRequest>, { id: string; data: Partial<ClientRequest> }>({
      query: ({ id, data }) => ({
        url: `/requests/${id}`,
        method: 'PUT',
        body: data,
      }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'Requests', id },
        'Requests',
        'Dashboard'
      ],
    }),

    deleteRequest: builder.mutation<ApiResponse<void>, string>({
      query: (id) => ({
        url: `/requests/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Requests', 'Dashboard'],
    }),

    // Projects
    getProjects: builder.query<ApiResponse<PaginatedResponse<ClientProject>>, { page?: number; limit?: number }>({
      query: (params) => ({
        url: '/projects',
        params,
      }),
      providesTags: ['Projects'],
    }),

    getProjectDetails: builder.query<ApiResponse<ClientProject>, string>({
      query: (id) => `/projects/${id}`,
      providesTags: (_result, _error, id) => [{ type: 'Projects', id }],
    }),

    // Invoices
    getInvoices: builder.query<ApiResponse<PaginatedResponse<ClientInvoice>>, { page?: number; limit?: number }>({
      query: (params) => ({
        url: '/invoices',
        params,
      }),
      providesTags: ['Invoices'],
    }),

    getInvoiceDetails: builder.query<ApiResponse<ClientInvoice>, string>({
      query: (id) => `/invoices/${id}`,
      providesTags: (_result, _error, id) => [{ type: 'Invoices', id }],
    }),

    payInvoice: builder.mutation<ApiResponse<void>, { id: string; paymentData: unknown }>({
      query: ({ id, paymentData }) => ({
        url: `/invoices/${id}/pay`,
        method: 'POST',
        body: paymentData,
      }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'Invoices', id },
        'Invoices',
        'Dashboard'
      ],
    }),

    downloadInvoice: builder.query<Blob, string>({
      query: (id) => ({
        url: `/invoices/${id}/download`,
        responseHandler: (response) => response.blob(),
      }),
    }),

    // Chats
    getChats: builder.query<ApiResponse<ClientChat[]>, void>({
      query: () => '/chats',
      providesTags: ['Chats'],
    }),

    getChatDetails: builder.query<ApiResponse<ClientChat>, string>({
      query: (id) => `/chats/${id}`,
      providesTags: (_result, _error, id) => [{ type: 'Chats', id }],
    }),

    sendMessage: builder.mutation<ApiResponse<void>, { chatId: string; messageData: { content: string; attachments?: string[] } }>({
      query: ({ chatId, messageData }) => ({
        url: `/chats/${chatId}/messages`,
        method: 'POST',
        body: messageData,
      }),
      invalidatesTags: (_result, _error, { chatId }) => [
        { type: 'Chats', chatId },
        'Chats'
      ],
    }),

    getMessages: builder.query<ApiResponse<unknown[]>, string>({
      query: (chatId) => `/chats/${chatId}/messages`,
      providesTags: (_result, _error, chatId) => [{ type: 'Chats', id: chatId }],
    }),

    // Settings (organization-side - requires team_id)
    getSettings: builder.query<ApiResponse<ClientSettings>, void>({
      query: () => '/settings',
      providesTags: ['Settings'],
    }),

    updateSettings: builder.mutation<ApiResponse<ClientSettings>, Partial<ClientSettings>>({
      query: (settingsData) => ({
        url: '/settings',
        method: 'PUT',
        body: settingsData,
      }),
      invalidatesTags: ['Settings'],
    }),

    // Organization Settings (client-side - uses organizationId from token)
    getOrganizationSettings: builder.query<ApiResponse<ClientSettings>, void>({
      query: () => '/organization-settings',
      providesTags: ['Settings'],
    }),

    // Profile
    getProfile: builder.query<ApiResponse<ClientUser>, void>({
      query: () => '/profile',
      providesTags: ['Profile'],
    }),

    updateProfile: builder.mutation<ApiResponse<ClientUser>, Partial<ClientUser>>({
      query: (profileData) => ({
        url: '/profile',
        method: 'PUT',
        body: profileData,
      }),
      invalidatesTags: ['Profile'],
    }),

    // Notifications
    getNotifications: builder.query<ApiResponse<PaginatedResponse<ClientNotification>>, { page?: number; limit?: number }>({
      query: (params) => ({
        url: '/notifications',
        params,
      }),
      providesTags: ['Notifications'],
    }),

    markNotificationRead: builder.mutation<ApiResponse<void>, string>({
      query: (id) => ({
        url: `/notifications/${id}/read`,
        method: 'PUT',
      }),
      invalidatesTags: ['Notifications', 'Dashboard'],
    }),

    markAllNotificationsRead: builder.mutation<ApiResponse<void>, void>({
      query: () => ({
        url: '/notifications/read-all',
        method: 'PUT',
      }),
      invalidatesTags: ['Notifications', 'Dashboard'],
    }),

    // File upload
    uploadFile: builder.mutation<{ url: string; filename: string }, File>({
      query: (file) => {
        const formData = new FormData();
        formData.append('file', file);
        return {
          url: '/upload',
          method: 'POST',
          body: formData,
        };
      },
    }),

    // Organizations
    getOrganizations: builder.query<ApiResponse<{ organizations: any[] }>, void>({
      query: () => '/organizations',
      providesTags: ['Organizations'],
    }),

    switchOrganization: builder.mutation<ApiResponse<{ token: string; organizationId: string; clientId: string; expiresAt: string }>, string>({
      query: (organizationId) => ({
        url: '/organizations/switch',
        method: 'POST',
        body: { organizationId },
      }),
      // Invalidate all tags when switching organizations to refetch all data
      invalidatesTags: ['Dashboard', 'Services', 'Requests', 'Projects', 'Invoices', 'Chats', 'Settings', 'Profile', 'Notifications'],
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
  useGetRequestStatusHistoryQuery,
  useGetRequestCommentsQuery,
  useAddRequestCommentMutation,
  useUpdateRequestMutation,
  useDeleteRequestMutation,
  
  // Projects
  useGetProjectsQuery,
  useGetProjectDetailsQuery,
  
  // Invoices
  useGetInvoicesQuery,
  useGetInvoiceDetailsQuery,
  usePayInvoiceMutation,
  useLazyDownloadInvoiceQuery,
  
  // Chats
  useGetChatsQuery,
  useGetChatDetailsQuery,
  useSendMessageMutation,
  useGetMessagesQuery,
  
  // Settings
  useGetSettingsQuery,
  useUpdateSettingsMutation,
  useGetOrganizationSettingsQuery,
  
  // Profile
  useGetProfileQuery,
  useUpdateProfileMutation,
  
  // Notifications
  useGetNotificationsQuery,
  useMarkNotificationReadMutation,
  useMarkAllNotificationsReadMutation,
  
  // File upload
  useUploadFileMutation,

  // Organizations
  useGetOrganizationsQuery,
  useSwitchOrganizationMutation,
} = clientPortalApi; 
