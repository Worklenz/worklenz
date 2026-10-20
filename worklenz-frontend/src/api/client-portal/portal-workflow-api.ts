import { clientPortalApi } from './client-portal-api';
import type { ServerEnvelope } from './company-users-api';
import { PORTAL_V2, buildQuery } from './portal-api-utils';
import type {
  Approval,
  ApprovalOptions,
  ApprovalsList,
  ApprovalsParams,
  UpdateApprovalRequest,
  AuditList,
  AuditParams,
  BillableChangeRequest,
  ChangeRequest,
  ChangeRequestAction,
  ChangeRequestsList,
  ChangeRequestsParams,
  ConvertToWorkRequest,
  CreateApprovalRequest,
  LinkableTask,
  PostMessageRequest,
  PostMessageResult,
  PreviewProjectResponse,
  PreviewResponse,
  PreviewUser,
  ResubmitApprovalRequest,
  StartThreadRequest,
  Thread,
  ThreadOptions,
  ThreadsList,
  ThreadsParams,
  UpdateChangeRequestRequest,
} from '@/types/client-portal/v2';

export const portalWorkflowApi = clientPortalApi.injectEndpoints({
  endpoints: builder => ({
    // ─── Approvals ──────────────────────────────────────────────────────────

    getApprovals: builder.query<ServerEnvelope<ApprovalsList>, ApprovalsParams | void>({
      query: params => `${PORTAL_V2}/approvals${buildQuery(params ?? undefined)}`,
      providesTags: ['Approvals'],
    }),

    getApproval: builder.query<ServerEnvelope<Approval>, string>({
      query: approvalId => `${PORTAL_V2}/approvals/${approvalId}`,
      providesTags: (_result, _error, id) => [{ type: 'Approvals', id }],
    }),

    // Client Visible items and eligible approvers for a project (only Active Client Admins on it).
    getApprovalOptions: builder.query<ServerEnvelope<ApprovalOptions>, string>({
      query: projectId => `${PORTAL_V2}/projects/${projectId}/approval-options`,
      providesTags: ['Approvals', 'PortalTasks', 'PortalFiles', 'Milestones'],
    }),

    createApproval: builder.mutation<ServerEnvelope<Approval>, CreateApprovalRequest>({
      query: body => ({ url: `${PORTAL_V2}/approvals`, method: 'POST', body }),
      invalidatesTags: ['Approvals', 'PortalCounts', 'PortalProjects', 'PortalOrganizations', 'AuditLog'],
    }),

    sendApproval: builder.mutation<ServerEnvelope<Approval>, string>({
      query: approvalId => ({ url: `${PORTAL_V2}/approvals/${approvalId}/send`, method: 'POST', body: {} }),
      invalidatesTags: ['Approvals', 'PortalCounts', 'PortalProjects', 'PortalOrganizations', 'AuditLog'],
    }),

    // Edit or delete only while the client has not reacted (Draft or Awaiting); the server enforces it.
    updateApproval: builder.mutation<ServerEnvelope<Approval>, { approvalId: string; body: UpdateApprovalRequest }>({
      query: ({ approvalId, body }) => ({ url: `${PORTAL_V2}/approvals/${approvalId}`, method: 'PATCH', body }),
      invalidatesTags: ['Approvals', 'PortalCounts', 'PortalProjects', 'PortalOrganizations', 'AuditLog'],
    }),

    deleteApproval: builder.mutation<ServerEnvelope<null>, string>({
      query: approvalId => ({ url: `${PORTAL_V2}/approvals/${approvalId}`, method: 'DELETE' }),
      invalidatesTags: ['Approvals', 'PortalCounts', 'PortalProjects', 'PortalOrganizations', 'AuditLog'],
    }),

    cancelApproval: builder.mutation<ServerEnvelope<Approval>, string>({
      query: approvalId => ({ url: `${PORTAL_V2}/approvals/${approvalId}/cancel`, method: 'POST', body: {} }),
      invalidatesTags: ['Approvals', 'PortalCounts', 'PortalProjects', 'PortalOrganizations', 'AuditLog'],
    }),

    resubmitApproval: builder.mutation<
      ServerEnvelope<Approval>,
      { approvalId: string; body?: ResubmitApprovalRequest }
    >({
      query: ({ approvalId, body }) => ({
        url: `${PORTAL_V2}/approvals/${approvalId}/resubmit`,
        method: 'POST',
        body: body ?? {},
      }),
      invalidatesTags: ['Approvals', 'PortalCounts', 'PortalProjects', 'PortalOrganizations', 'AuditLog'],
    }),

    // ─── Change requests ────────────────────────────────────────────────────

    getChangeRequests: builder.query<ServerEnvelope<ChangeRequestsList>, ChangeRequestsParams | void>({
      query: params => `${PORTAL_V2}/change-requests${buildQuery(params ?? undefined)}`,
      providesTags: ['ChangeRequests'],
    }),

    getChangeRequest: builder.query<ServerEnvelope<ChangeRequest>, string>({
      query: id => `${PORTAL_V2}/change-requests/${id}`,
      providesTags: (_result, _error, id) => [{ type: 'ChangeRequests', id }],
    }),

    // Requests a quote or invoice can start from (Approved, In Progress, Completed).
    getBillableChangeRequests: builder.query<
      ServerEnvelope<BillableChangeRequest[]>,
      { organization_id?: string; search?: string } | void
    >({
      query: params => `${PORTAL_V2}/change-requests/billable${buildQuery(params ?? undefined)}`,
      providesTags: ['ChangeRequests'],
    }),

    // Status only moves through these explicit actions, never an inline dropdown.
    applyChangeRequestAction: builder.mutation<ServerEnvelope<ChangeRequest>, { id: string; body: ChangeRequestAction }>({
      query: ({ id, body }) => ({ url: `${PORTAL_V2}/change-requests/${id}/actions`, method: 'POST', body }),
      invalidatesTags: ['ChangeRequests', 'PortalCounts', 'PortalProjects', 'PortalOrganizations', 'AuditLog'],
    }),

    updateChangeRequest: builder.mutation<ServerEnvelope<ChangeRequest>, { id: string; body: UpdateChangeRequestRequest }>({
      query: ({ id, body }) => ({ url: `${PORTAL_V2}/change-requests/${id}`, method: 'PUT', body }),
      invalidatesTags: (_result, _error, { id }) => [{ type: 'ChangeRequests', id }, 'ChangeRequests'],
    }),

    convertChangeRequest: builder.mutation<ServerEnvelope<ChangeRequest>, { id: string; body: ConvertToWorkRequest }>({
      query: ({ id, body }) => ({ url: `${PORTAL_V2}/change-requests/${id}/convert`, method: 'POST', body }),
      invalidatesTags: ['ChangeRequests', 'PortalTasks', 'PortalCounts', 'AuditLog'],
    }),

    getLinkableTasks: builder.query<ServerEnvelope<LinkableTask[]>, string>({
      query: projectId => `${PORTAL_V2}/projects/${projectId}/linkable-tasks`,
      providesTags: ['ChangeRequests', 'PortalTasks'],
    }),

    // ─── Discussions ────────────────────────────────────────────────────────

    getThreads: builder.query<ServerEnvelope<ThreadsList>, ThreadsParams | void>({
      query: params => `${PORTAL_V2}/threads${buildQuery(params ?? undefined)}`,
      providesTags: ['Threads'],
    }),

    // Opening a thread clears its unread flag for the signed-in staff member.
    getThread: builder.query<ServerEnvelope<Thread>, string>({
      query: threadId => `${PORTAL_V2}/threads/${threadId}`,
      providesTags: (_result, _error, id) => [{ type: 'Threads', id }],
    }),

    getThreadOptions: builder.query<ServerEnvelope<ThreadOptions>, string>({
      query: projectId => `${PORTAL_V2}/projects/${projectId}/thread-options`,
      providesTags: ['PortalTasks', 'PortalFiles', 'Approvals', 'PortalClientUsers'],
    }),

    startThread: builder.mutation<ServerEnvelope<Thread>, StartThreadRequest>({
      query: body => ({ url: `${PORTAL_V2}/threads`, method: 'POST', body }),
      invalidatesTags: ['Threads', 'PortalCounts'],
    }),

    postThreadMessage: builder.mutation<
      ServerEnvelope<PostMessageResult>,
      { threadId: string; body: PostMessageRequest }
    >({
      query: ({ threadId, body }) => ({ url: `${PORTAL_V2}/threads/${threadId}/messages`, method: 'POST', body }),
      invalidatesTags: (_result, _error, { threadId }) => [{ type: 'Threads', id: threadId }, 'Threads', 'PortalCounts'],
    }),

    // ─── Audit log ──────────────────────────────────────────────────────────

    getAuditLog: builder.query<ServerEnvelope<AuditList>, AuditParams | void>({
      query: params => `${PORTAL_V2}/audit${buildQuery(params ?? undefined)}`,
      providesTags: ['AuditLog'],
    }),

    // ─── Preview as client ──────────────────────────────────────────────────

    getPreviewUsers: builder.query<ServerEnvelope<PreviewUser[]>, void>({
      query: () => `${PORTAL_V2}/preview/users`,
      providesTags: ['PortalPreview', 'PortalClientUsers'],
    }),

    getPreview: builder.query<ServerEnvelope<PreviewResponse>, string>({
      query: contactId => `${PORTAL_V2}/preview/${contactId}`,
      providesTags: ['PortalPreview'],
    }),

    getPreviewProject: builder.query<ServerEnvelope<PreviewProjectResponse>, { contactId: string; projectId: string }>({
      query: ({ contactId, projectId }) => `${PORTAL_V2}/preview/${contactId}/projects/${projectId}`,
      providesTags: ['PortalPreview'],
    }),
  }),
});

export const {
  useGetApprovalsQuery,
  useGetApprovalQuery,
  useGetApprovalOptionsQuery,
  useCreateApprovalMutation,
  useSendApprovalMutation,
  useUpdateApprovalMutation,
  useDeleteApprovalMutation,
  useCancelApprovalMutation,
  useResubmitApprovalMutation,
  useGetChangeRequestsQuery,
  useGetChangeRequestQuery,
  useGetBillableChangeRequestsQuery,
  useApplyChangeRequestActionMutation,
  useUpdateChangeRequestMutation,
  useConvertChangeRequestMutation,
  useGetLinkableTasksQuery,
  useGetThreadsQuery,
  useGetThreadQuery,
  useGetThreadOptionsQuery,
  useStartThreadMutation,
  usePostThreadMessageMutation,
  useGetAuditLogQuery,
  useGetPreviewUsersQuery,
  useGetPreviewQuery,
  useGetPreviewProjectQuery,
} = portalWorkflowApi;
