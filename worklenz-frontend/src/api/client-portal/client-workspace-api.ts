import { clientPortalApi } from './client-portal-api';
import type { ServerEnvelope } from './company-users-api';

/** The company record shown in the workspace header and rail (GET /clients/portal/clients/:id). */
export interface ClientWorkspaceProfile {
  id: string;
  name: string;
  email: string | null;
  company_name: string | null;
  phone: string | null;
  contact_person: string | null;
  status: 'active' | 'inactive' | 'pending';
  assigned_projects_count: number;
  created_at: string;
  updated_at: string;
}

export type WorkspacePortalStatus = 'active' | 'invited' | 'not_invited' | 'expired';

export interface OutstandingAmount {
  currency: string;
  amount: number;
}

/** Real per-client numbers (GET /clients/portal/clients/:id/stats). */
export interface ClientWorkspaceStats {
  totalProjects: number;
  activeProjects: number;
  completedProjects: number;
  tasksOpen: number;
  invoicesDue: number;
  unansweredMessages: number;
  /** Owed on sent invoices, per currency, largest first. Currencies are never added together. */
  outstanding: OutstandingAmount[];
  totalTeamMembers: number;
  lastLoginAt: string | null;
  hasSignedIn: boolean;
  /** When the latest invitation was sent, for a client that has not signed in yet. */
  invitedAt: string | null;
  portalStatus: { status: WorkspacePortalStatus; label: string; color: string };
}

export type ClientActivityCategory = 'project' | 'request' | 'invoice' | 'chat';

export interface ClientActivityItem {
  id: string;
  type: string;
  category: ClientActivityCategory;
  referenceId: string;
  referenceName: string;
  description: string;
  status: string | null;
  activityDate: string;
}

export interface ClientActivityFeed {
  activities: ClientActivityItem[];
  total: number;
  page: number;
  limit: number;
}

export const clientWorkspaceApi = clientPortalApi.injectEndpoints({
  endpoints: builder => ({
    getClientWorkspaceProfile: builder.query<ServerEnvelope<ClientWorkspaceProfile>, string>({
      query: id => `/clients/portal/clients/${id}`,
      // The project count in the rail follows projects being assigned or removed.
      providesTags: (_result, _error, id) => [
        { type: 'Client', id },
        { type: 'ClientProjects', id },
      ],
    }),

    getClientWorkspaceStats: builder.query<ServerEnvelope<ClientWorkspaceStats>, string>({
      query: id => `/clients/portal/clients/${id}/stats`,
      providesTags: (_result, _error, id) => [{ type: 'ClientStats', id }],
    }),

    getClientActivityFeed: builder.query<
      ServerEnvelope<ClientActivityFeed>,
      { clientId: string; limit?: number }
    >({
      query: ({ clientId, limit = 10 }) => ({
        url: `/clients/portal/clients/${clientId}/activity`,
        params: { page: 1, limit },
      }),
      providesTags: (_result, _error, { clientId }) => [{ type: 'ClientActivity', id: clientId }],
    }),
  }),
});

export const {
  useGetClientWorkspaceProfileQuery,
  useGetClientWorkspaceStatsQuery,
  useGetClientActivityFeedQuery,
} = clientWorkspaceApi;
