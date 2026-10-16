import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type { BaseQueryFn, FetchArgs, FetchBaseQueryError } from '@reduxjs/toolkit/query';
import {
  ApiResponse,
  ClientSettings,
  ClientInvoice,
  ClientOrganization,
  PaginatedResponse
} from '@/types';
import { isAccessRemovedResponse, signalAccessRemoved } from '@/utils/accessRemoved';

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

// Wrap the base query to handle "your access has been removed" responses.
// fetchBaseQuery doesn't go through the ApiService axios interceptor, so RTK Query
// requests that receive these would otherwise be silently swallowed — the already-logged-in
// client could keep browsing indefinitely. A 404 is NOT access removal: it stays a per-page
// "unavailable" state so the portal never says whether an item exists.
const baseQuery: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (
  args,
  api,
  extraOptions
) => {
  const result = await rawBaseQuery(args, api, extraOptions);
  if (result.error && isAccessRemovedResponse(result.error.status, result.error.data)) {
    signalAccessRemoved();
  }
  return result;
};

// Create the API slice. The v2 endpoints are injected from `api-v2.ts`; what stays here is the
// shared base query, invoices, the operator's branding settings and organization switching.
// (Services, Requests, Chats, v1 dashboard/projects/notifications/profile were retired in v2.)
export const clientPortalApi = createApi({
  reducerPath: 'clientPortalApi',
  baseQuery,
  // 'V2Dashboard' is declared here because paying an invoice changes the dashboard's unpaid amount.
  tagTypes: ['Invoices', 'Settings', 'Organizations', 'V2Dashboard'],
  endpoints: (builder) => ({
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
        'V2Dashboard',
      ],
    }),

    downloadInvoice: builder.query<Blob, string>({
      query: (id) => ({
        url: `/invoices/${id}/download`,
        responseHandler: (response) => response.blob(),
      }),
    }),

    // Organization Settings (client-side - uses organizationId from token)
    getOrganizationSettings: builder.query<ApiResponse<ClientSettings>, void>({
      query: () => '/organization-settings',
      providesTags: ['Settings'],
    }),

    // Organizations
    // The teams (workspaces) this login can act in, read live so a revoked team drops out.
    getOrganizations: builder.query<ApiResponse<{ organizations: ClientOrganization[] }>, void>({
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
      invalidatesTags: ['Invoices', 'Settings', 'Organizations'],
    }),

    // An invitation link opened while already signed in: joins that portal with no sign-in code.
    acceptInvite: builder.mutation<
      ApiResponse<{ token: string; organizationId: string; clientId: string; organizationName: string | null; expiresAt: string }>,
      string
    >({
      query: (inviteToken) => ({
        url: '/organizations/accept-invite',
        method: 'POST',
        body: { inviteToken },
      }),
    }),
  }),
});

// Export hooks
export const {
  // Invoices
  useGetInvoicesQuery,
  useGetInvoiceDetailsQuery,
  usePayInvoiceMutation,
  useLazyDownloadInvoiceQuery,

  // Operator branding (logo, colour, portal title)
  useGetOrganizationSettingsQuery,

  // Organizations
  useGetOrganizationsQuery,
  useSwitchOrganizationMutation,
  useAcceptInviteMutation,
} = clientPortalApi;
