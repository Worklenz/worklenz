import { clientPortalApi } from './client-portal-api';
import type { PermissionLevel } from '@/lib/client-portal/client-permissions';

export type CompanyUserPortalStatus = 'active' | 'invited' | 'expired' | 'not_invited' | 'disabled';

export type CompanyUserRole = 'poc' | 'member';

export type InviteDelivery = 'email' | 'link';

export interface CompanyUserProjectAccess {
  project_id: string;
  name: string;
  level: PermissionLevel;
}

export interface CompanyUser {
  id: string;
  client_id: string;
  company_name: string;
  name: string;
  email: string;
  phone: string | null;
  job_title: string | null;
  role: CompanyUserRole;
  /** Whether the person already has a portal login (their email can no longer change). */
  has_login: boolean;
  last_login_at: string | null;
  invited_at: string | null;
  created_at: string;
  portal_status: {
    status: CompanyUserPortalStatus;
    label: string;
    color: string;
  };
  project_count: number;
  projects: CompanyUserProjectAccess[];
}

export interface ServerEnvelope<T> {
  done: boolean;
  body: T;
  title: string | null;
  message: string | null;
}

export interface CompanyUsersListParams {
  page?: number;
  limit?: number;
  search?: string;
  /** One status, or several separated by commas. */
  status?: string;
  client_id?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface CompanyUsersList {
  users: CompanyUser[];
  total: number;
  page: number;
  limit: number;
}

export interface CompanyUsersStats {
  total: number;
  pocs: number;
  companies_without_poc: number;
  disabled: number;
}

export interface UpdateCompanyUserRequest {
  name?: string;
  email?: string;
  phone?: string | null;
  job_title?: string | null;
}

export interface CompanyUserInviteResult {
  email: string;
  delivery: InviteDelivery;
  email_sent: boolean;
  /** Present for delivery "link", or when the email could not be sent. */
  link: string | null;
  expires_at: string;
}

/** What happened to the invitation the wizard was asked to send after saving the record. */
export interface InviteOutcome {
  requested: boolean;
  delivery: InviteDelivery;
  email_sent: boolean;
  /** Set for delivery "link", or when the email could not be sent, so it can still be shared. */
  link: string | null;
  expires_at: string | null;
  /** Why the invitation failed. The record itself was still saved. */
  error: string | null;
}

export interface OnboardClientRequest {
  company_name?: string;
  first_name: string;
  last_name?: string;
  email: string;
  phone?: string;
  job_title?: string;
  send_invite: boolean;
  delivery: InviteDelivery;
  /** Posted to the client's Messages by the person adding them. */
  welcome_message?: string | null;
}

export interface OnboardClientResult {
  client: { id: string; name: string; company_name: string | null };
  user: CompanyUser | null;
  invite: InviteOutcome;
  welcome_message_posted: boolean;
}

export interface AddCompanyUserRequest {
  first_name: string;
  last_name?: string;
  email: string;
  phone?: string;
  job_title?: string;
  role: CompanyUserRole;
  project_access: Array<{ project_id: string; level: PermissionLevel }>;
  send_invite: boolean;
  delivery: InviteDelivery;
}

export interface AddCompanyUserResult {
  user: CompanyUser | null;
  invite: InviteOutcome;
}

export interface ImportRowInput {
  company: string;
  first_name: string;
  last_name: string;
  email: string;
}

/** Machine-readable, so each is shown in the user's language. */
export type ImportRowErrorCode =
  | 'missing_first_name'
  | 'missing_email'
  | 'invalid_email'
  | 'duplicate_in_file'
  | 'email_in_use'
  | 'company_name_too_long'
  | 'client_name_taken'
  | 'import_failed';

export interface ImportRowResult {
  /** 1-based, counting data rows (not the header). */
  row: number;
  status: 'ok' | 'error';
  errors: ImportRowErrorCode[];
  name: string;
  email: string;
  company: string;
  /** True when the company is already a client, so the row is added as a member. */
  company_exists: boolean;
}

export interface ImportValidation {
  summary: {
    total: number;
    valid: number;
    invalid: number;
    new_companies: number;
    existing_companies: number;
  };
  rows: ImportRowResult[];
}

export interface ImportOutcome {
  created_companies: number;
  added_users: number;
  skipped: number;
  rows: ImportRowResult[];
}

/** A project of a company, as listed by GET /clients/portal/clients/:id/projects. */
export interface ClientProjectRow {
  id: string;
  name: string;
  description: string | null;
  status: string | null;
  status_color: string | null;
  /** When the project is due, if it has an end date. */
  end_date: string | null;
  health_name: string | null;
  health_color: string | null;
  created_at: string;
  updated_at: string;
  total_tasks: number;
  completed_tasks: number;
}

export interface ClientProjectsList {
  projects: ClientProjectRow[];
  total: number;
  page: number;
  limit: number;
}

const USER_TAGS = ['CompanyUsers', 'CompanyUsersStats', 'Clients'] as const;

export const companyUsersApi = clientPortalApi.injectEndpoints({
  endpoints: builder => ({
    getCompanyUsers: builder.query<ServerEnvelope<CompanyUsersList>, CompanyUsersListParams>({
      query: params => ({ url: '/clients/portal/company-users', params }),
      providesTags: ['CompanyUsers'],
    }),

    getCompanyUsersStats: builder.query<ServerEnvelope<CompanyUsersStats>, void>({
      query: () => '/clients/portal/company-users/stats',
      providesTags: ['CompanyUsersStats'],
    }),

    updateCompanyUser: builder.mutation<
      ServerEnvelope<CompanyUser>,
      { id: string; data: UpdateCompanyUserRequest }
    >({
      query: ({ id, data }) => ({
        url: `/clients/portal/company-users/${id}`,
        method: 'PUT',
        body: data,
      }),
      invalidatesTags: [...USER_TAGS],
    }),

    setCompanyUserRole: builder.mutation<
      ServerEnvelope<CompanyUser>,
      { id: string; role: CompanyUserRole }
    >({
      query: ({ id, role }) => ({
        url: `/clients/portal/company-users/${id}/role`,
        method: 'PUT',
        body: { role },
      }),
      invalidatesTags: [...USER_TAGS],
    }),

    setCompanyUserDisabled: builder.mutation<
      ServerEnvelope<CompanyUser>,
      { id: string; disabled: boolean }
    >({
      query: ({ id, disabled }) => ({
        url: `/clients/portal/company-users/${id}/status`,
        method: 'PUT',
        body: { disabled },
      }),
      invalidatesTags: [...USER_TAGS],
    }),

    setCompanyUserProjects: builder.mutation<
      ServerEnvelope<CompanyUser>,
      { id: string; projects: Array<{ project_id: string; level: PermissionLevel }> }
    >({
      query: ({ id, projects }) => ({
        url: `/clients/portal/company-users/${id}/projects`,
        method: 'PUT',
        body: { projects },
      }),
      invalidatesTags: ['CompanyUsers'],
    }),

    inviteCompanyUser: builder.mutation<
      ServerEnvelope<CompanyUserInviteResult>,
      { id: string; delivery?: InviteDelivery }
    >({
      query: ({ id, delivery = 'email' }) => ({
        url: `/clients/portal/company-users/${id}/invite`,
        method: 'POST',
        body: { delivery },
      }),
      invalidatesTags: [...USER_TAGS],
    }),

    removeCompanyUser: builder.mutation<ServerEnvelope<null>, string>({
      query: id => ({
        url: `/clients/portal/company-users/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: [...USER_TAGS],
    }),

    // Add Client wizard
    onboardClient: builder.mutation<ServerEnvelope<OnboardClientResult>, OnboardClientRequest>({
      query: body => ({ url: '/clients/portal/clients/onboard', method: 'POST', body }),
      invalidatesTags: [...USER_TAGS],
    }),

    addCompanyUserToClient: builder.mutation<
      ServerEnvelope<AddCompanyUserResult>,
      { clientId: string; body: AddCompanyUserRequest }
    >({
      query: ({ clientId, body }) => ({
        url: `/clients/portal/clients/${clientId}/company-users`,
        method: 'POST',
        body,
      }),
      invalidatesTags: [...USER_TAGS],
    }),

    // A dry run: checks each row and writes nothing, so it does not invalidate anything.
    validateClientImport: builder.mutation<
      ServerEnvelope<ImportValidation>,
      { rows: ImportRowInput[] }
    >({
      query: body => ({ url: '/clients/portal/clients/import/validate', method: 'POST', body }),
    }),

    importClients: builder.mutation<ServerEnvelope<ImportOutcome>, { rows: ImportRowInput[] }>({
      query: body => ({ url: '/clients/portal/clients/import', method: 'POST', body }),
      invalidatesTags: [...USER_TAGS],
    }),

    // The projects a company user can be given access to are the company's own projects.
    getClientProjectsList: builder.query<
      ServerEnvelope<ClientProjectsList>,
      { clientId: string; limit?: number }
    >({
      query: ({ clientId, limit = 100 }) => ({
        url: `/clients/portal/clients/${clientId}/projects`,
        params: { page: 1, limit },
      }),
      providesTags: (_result, _error, { clientId }) => [{ type: 'ClientProjects', id: clientId }],
    }),
  }),
});

export const {
  useGetCompanyUsersQuery,
  useGetCompanyUsersStatsQuery,
  useUpdateCompanyUserMutation,
  useSetCompanyUserRoleMutation,
  useSetCompanyUserDisabledMutation,
  useSetCompanyUserProjectsMutation,
  useInviteCompanyUserMutation,
  useRemoveCompanyUserMutation,
  useOnboardClientMutation,
  useAddCompanyUserToClientMutation,
  useValidateClientImportMutation,
  useImportClientsMutation,
  useGetClientProjectsListQuery,
} = companyUsersApi;
