import { clientPortalApi } from '@/store/api';
import type { ApiResponse } from '@/types';
import type {
  ClientApprovalDetailV2,
  ClientApprovalV2,
  ClientChangeRequestDetailV2,
  ClientChangeRequestV2,
  ClientDashboardV2,
  DashboardLayoutResponse,
  DashboardLayoutV2,
  ClientFileV2,
  ClientMe,
  ClientMilestoneV2,
  ClientNotificationsResponse,
  ClientOrgUserProjectsV2,
  ClientOrgUserV2,
  ClientProjectMembersV2,
  ClientProjectV2,
  ClientProjectsPageV2,
  ClientProjectsQuery,
  ClientTaskV2,
  ClientThreadV2,
  MentionOptionV2,
  ClientTimezoneV2,
  NotificationPrefs,
  ChangeRequestPriority,
  ClientRole,
} from '@/types/v2';

// Client Portal v2 endpoints (`/api/client-portal/v2`). Every response is `{ done, body, message }`;
// we hand pages just the body. Errors keep RTK's shape: `error.status` is the HTTP status and
// `error.data.body.code` the portal error code (NOT_FOUND, ROLE_FORBIDDEN, ...).
const unwrap = <T,>(response: ApiResponse<T>): T => response.body;

const V2_TAGS = ['V2Me', 'V2Dashboard', 'V2Projects', 'V2ProjectMembers', 'V2Milestones', 'V2Tasks', 'V2Files', 'V2Approvals', 'V2ChangeRequests', 'V2Threads', 'V2Notifications', 'V2OrgUsers', 'V2Prefs', 'V2DashboardLayout'] as const;

export interface DecideApprovalInput {
  id: string;
  outcome: 'approved' | 'changes_requested';
  comment?: string;
  /** The user chose "Request changes without a comment". */
  confirmEmpty?: boolean;
}

export interface SubmitChangeRequestInput {
  project_id: string;
  title: string;
  description: string;
  notes?: string;
  priority: ChangeRequestPriority;
  attachment_file_ids?: string[];
}

export interface PostCommentInput {
  thread_id?: string;
  project_id?: string;
  context?: { type: 'project' | 'task' | 'file' | 'approval' | 'change_request'; ref_id?: string | null };
  text: string;
  /** `client_only` hides the message from the team. Only on an existing discussion. */
  visibility?: 'client' | 'client_only';
  /** Users whose @mention chip is in the message. */
  mention_ids?: string[];
  /** Files already uploaded to the project for this message. */
  attachment_file_ids?: string[];
  /** The message being replied to. A reply to a client-only message is client-only too. */
  parent_message_id?: string;
}

export interface EditMessageInput {
  messageId: string;
  text: string;
  mention_ids?: string[];
}

export interface UpdateMeInput {
  name?: string;
  job_title?: string;
  language?: string;
  timezone?: string | null;
}

export interface AccountDeletionResult {
  scheduled_deletion_date: string;
}

export interface PresignUploadInput {
  projectId: string;
  filename: string;
  size: number;
  mime_type: string;
  category: string;
}

export const clientPortalV2Api = clientPortalApi
  .enhanceEndpoints({ addTagTypes: V2_TAGS })
  .injectEndpoints({
    endpoints: builder => ({
      getMe: builder.query<ClientMe, void>({
        query: () => '/v2/me',
        transformResponse: unwrap<ClientMe>,
        providesTags: ['V2Me'],
      }),
      updateMe: builder.mutation<ClientMe, UpdateMeInput>({
        query: body => ({ url: '/v2/me', method: 'PUT', body }),
        transformResponse: unwrap<ClientMe>,
        invalidatesTags: ['V2Me'],
      }),
      // Soft-deletes the whole login; support purges it after 30 days. Signs the person out on the next request.
      requestAccountDeletion: builder.mutation<AccountDeletionResult, { confirmation: string }>({
        query: body => ({ url: '/v2/me/account-deletion', method: 'POST', body }),
        transformResponse: unwrap<AccountDeletionResult>,
      }),
      getTimezones: builder.query<ClientTimezoneV2[], void>({
        query: () => '/v2/timezones',
        transformResponse: unwrap<ClientTimezoneV2[]>,
      }),

      getDashboardV2: builder.query<ClientDashboardV2, void>({
        query: () => '/v2/dashboard',
        transformResponse: unwrap<ClientDashboardV2>,
        providesTags: ['V2Dashboard'],
      }),

      getProjectsV2: builder.query<ClientProjectV2[], void>({
        query: () => '/v2/projects',
        transformResponse: unwrap<ClientProjectV2[]>,
        providesTags: ['V2Projects'],
      }),
      /** One page of the projects list; the server filters, orders and pages. */
      getProjectsPage: builder.query<ClientProjectsPageV2, ClientProjectsQuery>({
        query: ({ page, size, search, sort, order, status, phase }) => ({
          url: '/v2/projects',
          params: {
            page,
            size,
            search: search || undefined,
            sort,
            order: sort ? order : undefined,
            status: status?.length ? status.join(',') : undefined,
            phase: phase?.length ? phase.join(',') : undefined,
          },
        }),
        transformResponse: unwrap<ClientProjectsPageV2>,
        providesTags: ['V2Projects'],
      }),
      getProjectMembers: builder.query<ClientProjectMembersV2, string>({
        query: projectId => `/v2/projects/${projectId}/members`,
        transformResponse: unwrap<ClientProjectMembersV2>,
        providesTags: ['V2ProjectMembers'],
      }),
      setProjectMembers: builder.mutation<ClientProjectMembersV2, { projectId: string; add?: string[]; remove?: string[] }>({
        query: ({ projectId, ...body }) => ({ url: `/v2/projects/${projectId}/members`, method: 'PUT', body }),
        transformResponse: unwrap<ClientProjectMembersV2>,
        invalidatesTags: ['V2ProjectMembers', 'V2OrgUsers', 'V2Projects', 'V2Dashboard'],
      }),
      getProject: builder.query<ClientProjectV2, string>({
        query: id => `/v2/projects/${id}`,
        transformResponse: unwrap<ClientProjectV2>,
        providesTags: (_r, _e, id) => [{ type: 'V2Projects', id }],
      }),
      getMilestones: builder.query<ClientMilestoneV2[], string>({
        query: projectId => `/v2/projects/${projectId}/milestones`,
        transformResponse: unwrap<ClientMilestoneV2[]>,
        providesTags: ['V2Milestones'],
      }),
      getTasks: builder.query<ClientTaskV2[], string>({
        query: projectId => `/v2/projects/${projectId}/tasks`,
        transformResponse: unwrap<ClientTaskV2[]>,
        providesTags: ['V2Tasks'],
      }),
      getFiles: builder.query<ClientFileV2[], string>({
        query: projectId => `/v2/projects/${projectId}/files`,
        transformResponse: unwrap<ClientFileV2[]>,
        providesTags: ['V2Files'],
      }),
      /** A short-lived link, authorized on every call. 404 means "no longer shared with you". */
      getFileAccess: builder.mutation<{ url: string; expires_in: number; name: string; version: number }, { fileId: string; action: 'preview' | 'download'; version?: number }>({
        query: ({ fileId, action, version }) => ({ url: `/v2/files/${fileId}/access`, params: { action, version } }),
        transformResponse: unwrap<{ url: string; expires_in: number; name: string; version: number }>,
      }),
      presignUpload: builder.mutation<{ file_id: string; upload_url: string; expires_in: number }, PresignUploadInput>({
        query: ({ projectId, ...body }) => ({ url: `/v2/projects/${projectId}/files/presign`, method: 'POST', body }),
        transformResponse: unwrap<{ file_id: string; upload_url: string; expires_in: number }>,
      }),
      confirmUpload: builder.mutation<ClientFileV2, { projectId: string; file_id: string }>({
        query: ({ projectId, ...body }) => ({ url: `/v2/projects/${projectId}/files/confirm`, method: 'POST', body }),
        transformResponse: unwrap<ClientFileV2>,
        invalidatesTags: ['V2Files', 'V2Projects', 'V2Dashboard'],
      }),

      getApprovals: builder.query<ClientApprovalV2[], void>({
        query: () => '/v2/approvals',
        transformResponse: unwrap<ClientApprovalV2[]>,
        providesTags: ['V2Approvals'],
      }),
      getApproval: builder.query<ClientApprovalDetailV2, string>({
        query: id => `/v2/approvals/${id}`,
        transformResponse: unwrap<ClientApprovalDetailV2>,
        providesTags: (_r, _e, id) => [{ type: 'V2Approvals', id }],
      }),
      decideApproval: builder.mutation<{ recorded: boolean }, DecideApprovalInput>({
        query: ({ id, outcome, comment, confirmEmpty }) => ({
          url: `/v2/approvals/${id}/decision`,
          method: 'POST',
          body: { outcome, comment: comment ?? '', confirm_empty: confirmEmpty === true },
        }),
        transformResponse: unwrap<{ recorded: boolean }>,
        invalidatesTags: ['V2Approvals', 'V2Dashboard', 'V2Notifications', 'V2Projects'],
      }),

      getChangeRequests: builder.query<ClientChangeRequestV2[], void>({
        query: () => '/v2/change-requests',
        transformResponse: unwrap<ClientChangeRequestV2[]>,
        providesTags: ['V2ChangeRequests'],
      }),
      getChangeRequest: builder.query<ClientChangeRequestDetailV2, string>({
        query: id => `/v2/change-requests/${id}`,
        transformResponse: unwrap<ClientChangeRequestDetailV2>,
        providesTags: (_r, _e, id) => [{ type: 'V2ChangeRequests', id }],
      }),
      submitChangeRequest: builder.mutation<{ id: string; cr_no: string }, SubmitChangeRequestInput>({
        query: body => ({ url: '/v2/change-requests', method: 'POST', body }),
        transformResponse: unwrap<{ id: string; cr_no: string }>,
        invalidatesTags: ['V2ChangeRequests', 'V2Dashboard', 'V2Projects'],
      }),
      replyChangeRequest: builder.mutation<null, { id: string; text: string }>({
        query: ({ id, text }) => ({ url: `/v2/change-requests/${id}/replies`, method: 'POST', body: { text } }),
        transformResponse: unwrap<null>,
        invalidatesTags: ['V2ChangeRequests', 'V2Dashboard', 'V2Threads'],
      }),
      cancelChangeRequest: builder.mutation<null, string>({
        query: id => ({ url: `/v2/change-requests/${id}/cancel`, method: 'POST' }),
        transformResponse: unwrap<null>,
        invalidatesTags: ['V2ChangeRequests', 'V2Dashboard', 'V2Projects'],
      }),

      getThreads: builder.query<ClientThreadV2[], { projectId?: string } | void>({
        query: arg => ({ url: '/v2/threads', params: arg && arg.projectId ? { project_id: arg.projectId } : undefined }),
        transformResponse: unwrap<ClientThreadV2[]>,
        providesTags: ['V2Threads'],
      }),
      markThreadRead: builder.mutation<null, string>({
        query: id => ({ url: `/v2/threads/${id}/read`, method: 'POST' }),
        transformResponse: unwrap<null>,
        invalidatesTags: ['V2Threads'],
      }),
      postComment: builder.mutation<{ thread_id: string }, PostCommentInput>({
        query: body => ({ url: '/v2/threads/comments', method: 'POST', body }),
        transformResponse: unwrap<{ thread_id: string }>,
        invalidatesTags: ['V2Threads', 'V2ChangeRequests'],
      }),
      editMessage: builder.mutation<{ thread_id: string }, EditMessageInput>({
        query: ({ messageId, ...body }) => ({ url: `/v2/threads/messages/${messageId}`, method: 'PATCH', body }),
        transformResponse: unwrap<{ thread_id: string }>,
        invalidatesTags: ['V2Threads'],
      }),
      deleteMessage: builder.mutation<{ thread_id: string }, string>({
        query: messageId => ({ url: `/v2/threads/messages/${messageId}`, method: 'DELETE' }),
        transformResponse: unwrap<{ thread_id: string }>,
        invalidatesTags: ['V2Threads'],
      }),

      getMentionOptions: builder.query<MentionOptionV2[], string>({
        query: projectId => `/v2/projects/${projectId}/mention-options`,
        transformResponse: unwrap<MentionOptionV2[]>,
        providesTags: ['V2ProjectMembers'],
      }),

      getNotificationsV2: builder.query<ClientNotificationsResponse, void>({
        query: () => '/v2/notifications',
        transformResponse: unwrap<ClientNotificationsResponse>,
        providesTags: ['V2Notifications'],
      }),
      setNotificationRead: builder.mutation<null, { id: string; read: boolean }>({
        query: ({ id, read }) => ({ url: `/v2/notifications/${id}/${read ? 'read' : 'unread'}`, method: 'PUT' }),
        transformResponse: unwrap<null>,
        invalidatesTags: ['V2Notifications'],
      }),
      markAllNotificationsReadV2: builder.mutation<null, void>({
        query: () => ({ url: '/v2/notifications/read-all', method: 'PUT' }),
        transformResponse: unwrap<null>,
        invalidatesTags: ['V2Notifications'],
      }),
      getNotificationPrefs: builder.query<NotificationPrefs, void>({
        query: () => '/v2/me/notification-prefs',
        transformResponse: unwrap<NotificationPrefs>,
        providesTags: ['V2Prefs'],
      }),
      updateNotificationPrefs: builder.mutation<NotificationPrefs, Partial<NotificationPrefs>>({
        query: body => ({ url: '/v2/me/notification-prefs', method: 'PUT', body }),
        transformResponse: unwrap<NotificationPrefs>,
        invalidatesTags: ['V2Prefs'],
      }),

      getDashboardLayout: builder.query<DashboardLayoutResponse, void>({
        query: () => '/v2/me/dashboard-layout',
        transformResponse: unwrap<DashboardLayoutResponse>,
        providesTags: ['V2DashboardLayout'],
      }),
      saveDashboardLayout: builder.mutation<DashboardLayoutResponse, DashboardLayoutV2>({
        query: layout => ({ url: '/v2/me/dashboard-layout', method: 'PUT', body: { layout } }),
        transformResponse: unwrap<DashboardLayoutResponse>,
        invalidatesTags: ['V2DashboardLayout'],
      }),
      resetDashboardLayout: builder.mutation<DashboardLayoutResponse, void>({
        query: () => ({ url: '/v2/me/dashboard-layout', method: 'DELETE' }),
        transformResponse: unwrap<DashboardLayoutResponse>,
        invalidatesTags: ['V2DashboardLayout'],
      }),

      getOrgUsers: builder.query<ClientOrgUserV2[], void>({
        query: () => '/v2/organization/users',
        transformResponse: unwrap<ClientOrgUserV2[]>,
        providesTags: ['V2OrgUsers'],
      }),
      createInviteLink: builder.mutation<{ link: string | null; expires_in_days: number; email: string; emailed: boolean }, { email: string; send_email?: boolean }>({
        query: body => ({ url: '/v2/organization/users/invite-link', method: 'POST', body }),
        transformResponse: unwrap<{ link: string | null; expires_in_days: number; email: string; emailed: boolean }>,
        invalidatesTags: ['V2OrgUsers'],
      }),
      updateOrgUser: builder.mutation<ClientOrgUserV2, { id: string; name?: string; job_title?: string; role?: ClientRole }>({
        query: ({ id, ...body }) => ({ url: `/v2/organization/users/${id}`, method: 'PATCH', body }),
        transformResponse: unwrap<ClientOrgUserV2>,
        invalidatesTags: ['V2OrgUsers'],
      }),
      /** A fresh link for someone already invited. `send_email` also emails it to them. */
      resendInvite: builder.mutation<{ link: string | null; expires_in_days: number; email: string }, { id: string; send_email: boolean }>({
        query: ({ id, ...body }) => ({ url: `/v2/organization/users/${id}/invite-link`, method: 'POST', body }),
        transformResponse: unwrap<{ link: string | null; expires_in_days: number; email: string }>,
      }),
      getOrgUserProjects: builder.query<ClientOrgUserProjectsV2, string>({
        query: id => `/v2/organization/users/${id}/projects`,
        transformResponse: unwrap<ClientOrgUserProjectsV2>,
        providesTags: ['V2OrgUsers'],
      }),
      setOrgUserProjects: builder.mutation<ClientOrgUserProjectsV2, { id: string; project_ids: string[] }>({
        query: ({ id, ...body }) => ({ url: `/v2/organization/users/${id}/projects`, method: 'PUT', body }),
        transformResponse: unwrap<ClientOrgUserProjectsV2>,
        invalidatesTags: ['V2OrgUsers', 'V2Projects', 'V2Dashboard'],
      }),
      removeOrgUser: builder.mutation<null, string>({
        query: id => ({ url: `/v2/organization/users/${id}`, method: 'DELETE' }),
        transformResponse: unwrap<null>,
        invalidatesTags: ['V2OrgUsers'],
      }),
    }),
  });

export const {
  useGetMeQuery,
  useUpdateMeMutation,
  useRequestAccountDeletionMutation,
  useGetTimezonesQuery,
  useGetDashboardV2Query,
  useGetProjectsV2Query,
  useGetProjectsPageQuery,
  useGetProjectMembersQuery,
  useSetProjectMembersMutation,
  useGetProjectQuery,
  useGetMilestonesQuery,
  useGetTasksQuery,
  useGetFilesQuery,
  useGetFileAccessMutation,
  usePresignUploadMutation,
  useConfirmUploadMutation,
  useGetApprovalsQuery,
  useGetApprovalQuery,
  useDecideApprovalMutation,
  useGetChangeRequestsQuery,
  useGetChangeRequestQuery,
  useSubmitChangeRequestMutation,
  useReplyChangeRequestMutation,
  useCancelChangeRequestMutation,
  useGetThreadsQuery,
  useGetMentionOptionsQuery,
  useMarkThreadReadMutation,
  usePostCommentMutation,
  useEditMessageMutation,
  useDeleteMessageMutation,
  useGetNotificationsV2Query,
  useSetNotificationReadMutation,
  useMarkAllNotificationsReadV2Mutation,
  useGetNotificationPrefsQuery,
  useUpdateNotificationPrefsMutation,
  useGetDashboardLayoutQuery,
  useSaveDashboardLayoutMutation,
  useResetDashboardLayoutMutation,
  useGetOrgUsersQuery,
  useCreateInviteLinkMutation,
  useUpdateOrgUserMutation,
  useGetOrgUserProjectsQuery,
  useSetOrgUserProjectsMutation,
  useResendInviteMutation,
  useRemoveOrgUserMutation,
} = clientPortalV2Api;
