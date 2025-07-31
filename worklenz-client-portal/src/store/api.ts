import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
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

// Base query with authentication
const baseQuery = fetchBaseQuery({
  baseUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api',
  prepareHeaders: (headers) => {
    const token = localStorage.getItem('clientToken');
    if (token) {
      headers.set('x-client-token', token);
    }
    return headers;
  },
});

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
    'Notifications'
  ],
  endpoints: (builder) => ({
    // Dashboard
    getDashboard: builder.query<ApiResponse<DashboardStats>, void>({
      query: () => '/client-portal/dashboard',
      providesTags: ['Dashboard'],
    }),

    // Services
    getServices: builder.query<ApiResponse<ClientService[]>, void>({
      query: () => '/client-portal/services',
      providesTags: ['Services'],
    }),

    getServiceDetails: builder.query<ApiResponse<ClientService>, string>({
      query: (id) => `/client-portal/services/${id}`,
      providesTags: (_result, _error, id) => [{ type: 'Services', id }],
    }),

    // Requests
    getRequests: builder.query<ApiResponse<PaginatedResponse<ClientRequest>>, { page?: number; limit?: number }>({
      query: (params) => ({
        url: '/client-portal/requests',
        params,
      }),
      providesTags: ['Requests'],
    }),

    createRequest: builder.mutation<ApiResponse<ClientRequest>, Partial<ClientRequest>>({
      query: (data) => ({
        url: '/client-portal/requests',
        method: 'POST',
        body: data,
      }),
      invalidatesTags: ['Requests', 'Dashboard'],
    }),

    getRequestDetails: builder.query<ApiResponse<ClientRequest>, string>({
      query: (id) => `/client-portal/requests/${id}`,
      providesTags: (_result, _error, id) => [{ type: 'Requests', id }],
    }),

    updateRequest: builder.mutation<ApiResponse<ClientRequest>, { id: string; data: Partial<ClientRequest> }>({
      query: ({ id, data }) => ({
        url: `/client-portal/requests/${id}`,
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
        url: `/client-portal/requests/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Requests', 'Dashboard'],
    }),

    // Projects
    getProjects: builder.query<ApiResponse<PaginatedResponse<ClientProject>>, { page?: number; limit?: number }>({
      query: (params) => ({
        url: '/client-portal/projects',
        params,
      }),
      providesTags: ['Projects'],
    }),

    getProjectDetails: builder.query<ApiResponse<ClientProject>, string>({
      query: (id) => `/client-portal/projects/${id}`,
      providesTags: (_result, _error, id) => [{ type: 'Projects', id }],
    }),

    // Invoices
    getInvoices: builder.query<ApiResponse<PaginatedResponse<ClientInvoice>>, { page?: number; limit?: number }>({
      query: (params) => ({
        url: '/client-portal/invoices',
        params,
      }),
      providesTags: ['Invoices'],
    }),

    getInvoiceDetails: builder.query<ApiResponse<ClientInvoice>, string>({
      query: (id) => `/client-portal/invoices/${id}`,
      providesTags: (_result, _error, id) => [{ type: 'Invoices', id }],
    }),

    payInvoice: builder.mutation<ApiResponse<void>, { id: string; paymentData: unknown }>({
      query: ({ id, paymentData }) => ({
        url: `/client-portal/invoices/${id}/pay`,
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
        url: `/client-portal/invoices/${id}/download`,
        responseHandler: (response) => response.blob(),
      }),
    }),

    // Chats
    getChats: builder.query<ApiResponse<ClientChat[]>, void>({
      query: () => '/client-portal/chats',
      providesTags: ['Chats'],
    }),

    getChatDetails: builder.query<ApiResponse<ClientChat>, string>({
      query: (id) => `/client-portal/chats/${id}`,
      providesTags: (_result, _error, id) => [{ type: 'Chats', id }],
    }),

    sendMessage: builder.mutation<ApiResponse<void>, { chatId: string; messageData: { content: string; attachments?: string[] } }>({
      query: ({ chatId, messageData }) => ({
        url: `/client-portal/chats/${chatId}/messages`,
        method: 'POST',
        body: messageData,
      }),
      invalidatesTags: (_result, _error, { chatId }) => [
        { type: 'Chats', chatId },
        'Chats'
      ],
    }),

    getMessages: builder.query<ApiResponse<unknown[]>, string>({
      query: (chatId) => `/client-portal/chats/${chatId}/messages`,
      providesTags: (_result, _error, chatId) => [{ type: 'Chats', id: chatId }],
    }),

    // Settings
    getSettings: builder.query<ApiResponse<ClientSettings>, void>({
      query: () => '/client-portal/settings',
      providesTags: ['Settings'],
    }),

    updateSettings: builder.mutation<ApiResponse<ClientSettings>, Partial<ClientSettings>>({
      query: (settingsData) => ({
        url: '/client-portal/settings',
        method: 'PUT',
        body: settingsData,
      }),
      invalidatesTags: ['Settings'],
    }),

    // Profile
    getProfile: builder.query<ApiResponse<ClientUser>, void>({
      query: () => '/client-portal/profile',
      providesTags: ['Profile'],
    }),

    updateProfile: builder.mutation<ApiResponse<ClientUser>, Partial<ClientUser>>({
      query: (profileData) => ({
        url: '/client-portal/profile',
        method: 'PUT',
        body: profileData,
      }),
      invalidatesTags: ['Profile'],
    }),

    // Notifications
    getNotifications: builder.query<ApiResponse<PaginatedResponse<ClientNotification>>, { page?: number; limit?: number }>({
      query: (params) => ({
        url: '/client-portal/notifications',
        params,
      }),
      providesTags: ['Notifications'],
    }),

    markNotificationRead: builder.mutation<ApiResponse<void>, string>({
      query: (id) => ({
        url: `/client-portal/notifications/${id}/read`,
        method: 'PUT',
      }),
      invalidatesTags: ['Notifications', 'Dashboard'],
    }),

    markAllNotificationsRead: builder.mutation<ApiResponse<void>, void>({
      query: () => ({
        url: '/client-portal/notifications/read-all',
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
          url: '/client-portal/upload',
          method: 'POST',
          body: formData,
        };
      },
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
  useLazyDownloadInvoiceQuery,
  
  // Chats
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
  
  // File upload
  useUploadFileMutation,
} = clientPortalApi; 