import { clientPortalApi } from './client-portal-api';
import type { ServerEnvelope } from './company-users-api';
import { PORTAL_V2, buildQuery } from './portal-api-utils';
import type {
  AddClientRequest,
  AddClientResult,
  ClientDeletePreview,
  ClientOrganization,
  ClientOrganizationsList,
  ClientOrganizationsParams,
  ClientUser,
  ClientUsersList,
  ClientUsersParams,
  ClientWorkspaceOverview,
  DeleteOrganizationRequest,
  DeleteOrganizationResult,
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

/**
 * Deleting, restoring, deactivating or reactivating a client organization changes everything a user change
 * does, plus the project client pickers and the legacy client details/lists the Edit client modal reads.
 */
const ORGANIZATION_CHANGED_TAGS = [...USER_CHANGED_TAGS, 'Clients', 'ClientProjects'] as const;

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

    // What deleting a client would affect or be blocked by. Never cached: it must reflect right now.
    getOrganizationDeletePreview: builder.query<ServerEnvelope<ClientDeletePreview>, string>({
      query: organizationId => `${PORTAL_V2}/organizations/${organizationId}/delete-preview`,
      keepUnusedDataFor: 0,
    }),

    // Soft delete: the client's users lose access at once, and everything is kept for 30 days.
    deletePortalOrganization: builder.mutation<ServerEnvelope<DeleteOrganizationResult>, DeleteOrganizationRequest>({
      query: ({ organizationId, confirmPendingApprovals, confirmOpenChangeRequests }) => ({
        url: `${PORTAL_V2}/organizations/${organizationId}`,
        method: 'DELETE',
        body: {
          confirm_pending_approvals: confirmPendingApprovals === true,
          confirm_open_change_requests: confirmOpenChangeRequests === true,
        },
      }),
      invalidatesTags: (_result, _error, { organizationId }) => [
        ...ORGANIZATION_CHANGED_TAGS,
        { type: 'Client', id: organizationId },
      ],
    }),

    restorePortalOrganization: builder.mutation<
      ServerEnvelope<ClientOrganization>,
      { organizationId: string; newName?: string }
    >({
      query: ({ organizationId, newName }) => ({
        url: `${PORTAL_V2}/organizations/${organizationId}/restore`,
        method: 'POST',
        body: newName ? { new_name: newName } : {},
      }),
      invalidatesTags: (_result, _error, { organizationId }) => [
        ...ORGANIZATION_CHANGED_TAGS,
        { type: 'Client', id: organizationId },
      ],
    }),

    deactivatePortalOrganization: builder.mutation<ServerEnvelope<ClientOrganization>, string>({
      query: organizationId => ({
        url: `${PORTAL_V2}/organizations/${organizationId}/deactivate`,
        method: 'POST',
        body: {},
      }),
      invalidatesTags: (_result, _error, organizationId) => [
        ...ORGANIZATION_CHANGED_TAGS,
        { type: 'Client', id: organizationId },
      ],
    }),

    reactivatePortalOrganization: builder.mutation<ServerEnvelope<ClientOrganization>, string>({
      query: organizationId => ({
        url: `${PORTAL_V2}/organizations/${organizationId}/reactivate`,
        method: 'POST',
        body: {},
      }),
      invalidatesTags: (_result, _error, organizationId) => [
        ...ORGANIZATION_CHANGED_TAGS,
        { type: 'Client', id: organizationId },
      ],
    }),

    // A person deleted their own account: staff bring it back inside the 30-day window.
    restorePortalAccount: builder.mutation<ServerEnvelope<ClientUser>, string>({
      query: userId => ({ url: `${PORTAL_V2}/client-users/${userId}/restore-account`, method: 'POST', body: {} }),
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
  useGetOrganizationDeletePreviewQuery,
  useDeletePortalOrganizationMutation,
  useRestorePortalOrganizationMutation,
  useDeactivatePortalOrganizationMutation,
  useReactivatePortalOrganizationMutation,
  useRestorePortalAccountMutation,
  useAddPortalClientMutation,
} = portalAccessApi;
