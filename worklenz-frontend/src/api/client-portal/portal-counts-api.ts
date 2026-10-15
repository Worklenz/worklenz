import { clientPortalApi } from './client-portal-api';
import type { ServerEnvelope } from './company-users-api';
import type { ClientRoleDefinition, PortalCounts } from '@/types/client-portal/v2';

export const portalCountsApi = clientPortalApi.injectEndpoints({
  endpoints: builder => ({
    // One query feeds the three sidebar badges (Approvals, Change Req., Discussions).
    getPortalCounts: builder.query<ServerEnvelope<PortalCounts>, void>({
      query: () => '/clients/portal/v2/counts',
      providesTags: ['PortalCounts'],
    }),

    // The matrix shown in Portal Settings is the matrix the backend enforces.
    getClientRoles: builder.query<ServerEnvelope<ClientRoleDefinition[]>, void>({
      query: () => '/clients/portal/v2/roles',
      providesTags: ['PortalRoles'],
    }),
  }),
});

export const { useGetPortalCountsQuery, useGetClientRolesQuery } = portalCountsApi;
