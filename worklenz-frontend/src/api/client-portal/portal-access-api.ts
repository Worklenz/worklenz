import { clientPortalApi } from './client-portal-api';
import type { ServerEnvelope } from './company-users-api';
import { PORTAL_V2, buildQuery } from './portal-api-utils';
import type {
  AddClientRequest,
  AddClientResult,
  ClientOrganizationsList,
  ClientOrganizationsParams,
  ClientUser,
  ClientUsersList,
  ClientUsersParams,
  ClientWorkspaceOverview,
  PagedParams,
  PortalSettingsV2,
  PortalSettingsV2Response,
  StaffRef,
  UpdateClientUserRequest,
} from '@/types/client-portal/v2';

/** A change to a client user can alter counts, projects' access lists and the audit log. */
const USER_CHANGED_TAGS = [
  'PortalClientUsers',
  'PortalOrganizations',
  'PortalProjects',
  'PortalProjectAccess',
  'PortalCounts',
  'AuditLog',
] as const;

type SettingsPatch = {
  [K in keyof PortalSettingsV2]?: PortalSettingsV2[K] extends object
    ? Partial<PortalSettingsV2[K]>
    : PortalSettingsV2[K];
};

export const portalAccessApi = clientPortalApi.injectEndpoints({
  endpoints: builder => ({
    getPortalSettings: builder.query<ServerEnvelope<PortalSettingsV2Response>, void>({
      query: () => `${PORTAL_V2}/settings`,
      providesTags: ['PortalSettingsV2'],
    }),

    // One Save for all four rebuilt sections; a partial body is fine.
    savePortalSettings: builder.mutation<ServerEnvelope<PortalSettingsV2Response>, SettingsPatch>({
      query: body => ({ url: `${PORTAL_V2}/settings`, method: 'PUT', body }),
      invalidatesTags: ['PortalSettingsV2', 'AuditLog'],
    }),

    getPortalStaff: builder.query<ServerEnvelope<StaffRef[]>, void>({
      query: () => `${PORTAL_V2}/staff`,
      providesTags: ['PortalStaff'],
    }),

    getPortalOrganizations: builder.query<ServerEnvelope<ClientOrganizationsList>, ClientOrganizationsParams | void>({
      query: params => `${PORTAL_V2}/organizations${buildQuery(params ?? undefined)}`,
      providesTags: ['PortalOrganizations'],
    }),

    getOrganizationOverview: builder.query<ServerEnvelope<ClientWorkspaceOverview>, string>({
      query: organizationId => `${PORTAL_V2}/organizations/${organizationId}/overview`,
      providesTags: (_result, _error, id) => [{ type: 'PortalOrganizations', id }],
    }),

    getPortalClientUsers: builder.query<ServerEnvelope<ClientUsersList>, ClientUsersParams | void>({
      query: params => `${PORTAL_V2}/client-users${buildQuery(params ?? undefined)}`,
      providesTags: ['PortalClientUsers'],
    }),

    updatePortalClientUser: builder.mutation<
      ServerEnvelope<ClientUser>,
      { userId: string; body: UpdateClientUserRequest }
    >({
      query: ({ userId, body }) => ({ url: `${PORTAL_V2}/client-users/${userId}`, method: 'PUT', body }),
      invalidatesTags: [...USER_CHANGED_TAGS],
    }),

    assignPortalUserProjects: builder.mutation<
      ServerEnvelope<ClientUser>,
      { userId: string; projectIds: string[] }
    >({
      query: ({ userId, projectIds }) => ({
        url: `${PORTAL_V2}/client-users/${userId}/projects`,
        method: 'PUT',
        body: { project_ids: projectIds },
      }),
      invalidatesTags: [...USER_CHANGED_TAGS],
    }),

    resendPortalInvitation: builder.mutation<
      ServerEnvelope<{ email: string; link: string | null; expiresAt: string; emailSent: boolean }>,
      { userId: string; delivery?: 'email' | 'link' }
    >({
      query: ({ userId, delivery }) => ({
        url: `${PORTAL_V2}/client-users/${userId}/resend`,
        method: 'POST',
        body: delivery ? { delivery } : {},
      }),
      invalidatesTags: [...USER_CHANGED_TAGS],
    }),

    deactivatePortalUser: builder.mutation<
      ServerEnvelope<ClientUser>,
      { userId: string; confirmLastAdmin?: boolean }
    >({
      query: ({ userId, confirmLastAdmin }) => ({
        url: `${PORTAL_V2}/client-users/${userId}/deactivate`,
        method: 'POST',
        // One confirmation covers both warnings the server can raise (last Client Admin, only approver).
        body: { confirm_last_admin: confirmLastAdmin === true, confirm_pending_approvals: confirmLastAdmin === true },
      }),
      invalidatesTags: [...USER_CHANGED_TAGS],
    }),

    reactivatePortalUser: builder.mutation<ServerEnvelope<ClientUser>, string>({
      query: userId => ({ url: `${PORTAL_V2}/client-users/${userId}/reactivate`, method: 'POST', body: {} }),
      invalidatesTags: [...USER_CHANGED_TAGS],
    }),

    removePortalUser: builder.mutation<ServerEnvelope<null>, { userId: string; confirmLastAdmin?: boolean }>({
      query: ({ userId, confirmLastAdmin }) => ({
        url: `${PORTAL_V2}/client-users/${userId}`,
        method: 'DELETE',
        // One confirmation covers both warnings the server can raise (last Client Admin, only approver).
        body: { confirm_last_admin: confirmLastAdmin === true, confirm_pending_approvals: confirmLastAdmin === true },
      }),
      invalidatesTags: [...USER_CHANGED_TAGS],
    }),

    // The two-method Add Client wizard, finished in one transaction on the server.
    addPortalClient: builder.mutation<ServerEnvelope<AddClientResult>, AddClientRequest>({
      query: body => ({ url: `${PORTAL_V2}/add-client`, method: 'POST', body }),
      invalidatesTags: [...USER_CHANGED_TAGS],
    }),
  }),
});

export const {
  useGetPortalSettingsQuery,
  useSavePortalSettingsMutation,
  useGetPortalStaffQuery,
  useGetPortalOrganizationsQuery,
  useGetOrganizationOverviewQuery,
  useGetPortalClientUsersQuery,
  useUpdatePortalClientUserMutation,
  useAssignPortalUserProjectsMutation,
  useResendPortalInvitationMutation,
  useDeactivatePortalUserMutation,
  useReactivatePortalUserMutation,
  useRemovePortalUserMutation,
  useAddPortalClientMutation,
} = portalAccessApi;
