import { clientPortalApi } from './client-portal-api';
import type { ServerEnvelope } from './company-users-api';
import { PORTAL_V2, buildQuery } from './portal-api-utils';
import type {
  CompleteMilestoneRequest,
  FileDownloadResult,
  FileVersion,
  Milestone,
  PortalFile,
  PortalFilesParams,
  PortalProject,
  PortalProjectsList,
  PortalProjectsParams,
  PortalTask,
  PortalTasksList,
  PortalTasksParams,
  PresignFileRequest,
  PresignFileResult,
  PresignVersionResult,
  ProjectAccess,
  ProjectOverview,
  ProjectUpdate,
  SaveMilestoneRequest,
  SetPortalResult,
  UpdatePortalTaskRequest,
  UpdateProjectOverviewRequest,
  BulkUpdatePortalTaskVisibilityRequest,
  BulkUpdatePortalTaskVisibilityResult,
} from '@/types/client-portal/v2';

export const portalProjectsApi = clientPortalApi.injectEndpoints({
  endpoints: builder => ({
    getPortalProjects: builder.query<ServerEnvelope<PortalProjectsList>, PortalProjectsParams | void>({
      query: params => `${PORTAL_V2}/projects${buildQuery(params ?? undefined)}`,
      providesTags: ['PortalProjects'],
    }),

    getPortalProject: builder.query<ServerEnvelope<PortalProject>, string>({
      query: projectId => `${PORTAL_V2}/projects/${projectId}`,
      providesTags: (_result, _error, id) => [{ type: 'PortalProjects', id }],
    }),

    // Switching the portal off needs a confirmation that names how many users lose access.
    setPortalProjectPortal: builder.mutation<
      ServerEnvelope<SetPortalResult>,
      { projectId: string; enabled: boolean }
    >({
      query: ({ projectId, enabled }) => ({
        url: `${PORTAL_V2}/projects/${projectId}/portal`,
        method: 'PUT',
        body: { enabled },
      }),
      invalidatesTags: ['PortalProjects', 'PortalOrganizations', 'PortalClientUsers', 'AuditLog'],
    }),

    getProjectOverview: builder.query<ServerEnvelope<ProjectOverview>, string>({
      query: projectId => `${PORTAL_V2}/projects/${projectId}/overview`,
      providesTags: (_result, _error, id) => [{ type: 'PortalProjectOverview', id }],
    }),

    saveProjectOverview: builder.mutation<
      ServerEnvelope<ProjectOverview>,
      { projectId: string; body: UpdateProjectOverviewRequest }
    >({
      query: ({ projectId, body }) => ({
        url: `${PORTAL_V2}/projects/${projectId}/overview`,
        method: 'PUT',
        body,
      }),
      invalidatesTags: (_result, _error, { projectId }) => [
        { type: 'PortalProjectOverview', id: projectId },
        // Switching the milestone source changes the milestone list too.
        { type: 'Milestones', id: projectId },
        'PortalProjects',
      ],
    }),

    publishProjectUpdate: builder.mutation<ServerEnvelope<ProjectUpdate>, { projectId: string; body: string }>({
      query: ({ projectId, body }) => ({
        url: `${PORTAL_V2}/projects/${projectId}/updates`,
        method: 'POST',
        body: { body },
      }),
      invalidatesTags: (_result, _error, { projectId }) => [{ type: 'PortalProjectOverview', id: projectId }],
    }),

    getProjectAccess: builder.query<ServerEnvelope<ProjectAccess>, string>({
      query: projectId => `${PORTAL_V2}/projects/${projectId}/access`,
      providesTags: (_result, _error, id) => [{ type: 'PortalProjectAccess', id }],
    }),

    assignProjectUser: builder.mutation<ServerEnvelope<ProjectAccess>, { projectId: string; userId: string }>({
      query: ({ projectId, userId }) => ({
        url: `${PORTAL_V2}/projects/${projectId}/access`,
        method: 'POST',
        body: { user_id: userId },
      }),
      invalidatesTags: (_result, _error, { projectId }) => [
        { type: 'PortalProjectAccess', id: projectId },
        'PortalProjects',
        'PortalClientUsers',
        'AuditLog',
      ],
    }),

    removeProjectUser: builder.mutation<ServerEnvelope<ProjectAccess>, { projectId: string; userId: string }>({
      query: ({ projectId, userId }) => ({
        url: `${PORTAL_V2}/projects/${projectId}/access/${userId}`,
        method: 'DELETE',
      }),
      invalidatesTags: (_result, _error, { projectId }) => [
        { type: 'PortalProjectAccess', id: projectId },
        'PortalProjects',
        'PortalClientUsers',
        'AuditLog',
      ],
    }),

    linkProjectToClient: builder.mutation<ServerEnvelope<PortalProject>, { projectId: string; organizationId: string }>({
      query: ({ projectId, organizationId }) => ({
        url: `${PORTAL_V2}/projects/${projectId}/link-client`,
        method: 'POST',
        body: { organization_id: organizationId },
      }),
      invalidatesTags: (_result, _error, { projectId }) => [
        { type: 'PortalProjectAccess', id: projectId },
        'PortalProjects',
        'PortalOrganizations',
        'AuditLog',
      ],
    }),

    // ─── Milestones ─────────────────────────────────────────────────────────

    getProjectMilestones: builder.query<ServerEnvelope<Milestone[]>, string>({
      query: projectId => `${PORTAL_V2}/projects/${projectId}/milestones`,
      providesTags: (_result, _error, id) => [{ type: 'Milestones', id }],
    }),

    createMilestone: builder.mutation<ServerEnvelope<Milestone>, { projectId: string; body: SaveMilestoneRequest }>({
      query: ({ projectId, body }) => ({
        url: `${PORTAL_V2}/projects/${projectId}/milestones`,
        method: 'POST',
        body,
      }),
      invalidatesTags: (_result, _error, { projectId }) => [{ type: 'Milestones', id: projectId }, 'PortalProjects', 'AuditLog'],
    }),

    updateMilestone: builder.mutation<
      ServerEnvelope<Milestone>,
      { projectId: string; milestoneId: string; body: Partial<SaveMilestoneRequest> }
    >({
      query: ({ milestoneId, body }) => ({ url: `${PORTAL_V2}/milestones/${milestoneId}`, method: 'PUT', body }),
      invalidatesTags: (_result, _error, { projectId }) => [{ type: 'Milestones', id: projectId }, 'PortalProjects', 'AuditLog'],
    }),

    completeMilestone: builder.mutation<
      ServerEnvelope<Milestone>,
      { projectId: string; milestoneId: string; body: CompleteMilestoneRequest }
    >({
      query: ({ milestoneId, body }) => ({
        url: `${PORTAL_V2}/milestones/${milestoneId}/complete`,
        method: 'POST',
        body,
      }),
      invalidatesTags: (_result, _error, { projectId }) => [{ type: 'Milestones', id: projectId }, 'PortalProjects'],
    }),

    deleteMilestone: builder.mutation<ServerEnvelope<null>, { projectId: string; milestoneId: string }>({
      query: ({ milestoneId }) => ({ url: `${PORTAL_V2}/milestones/${milestoneId}`, method: 'DELETE' }),
      invalidatesTags: (_result, _error, { projectId }) => [{ type: 'Milestones', id: projectId }, 'PortalProjects', 'AuditLog'],
    }),

    // ─── Tasks ──────────────────────────────────────────────────────────────

    getProjectTasks: builder.query<
      ServerEnvelope<PortalTasksList>,
      { projectId: string; params?: PortalTasksParams }
    >({
      query: ({ projectId, params }) => `${PORTAL_V2}/projects/${projectId}/tasks${buildQuery(params)}`,
      providesTags: (_result, _error, { projectId }) => [{ type: 'PortalTasks', id: projectId }],
    }),

    updatePortalTask: builder.mutation<
      ServerEnvelope<PortalTask>,
      { projectId: string; taskId: string; body: UpdatePortalTaskRequest }
    >({
      query: ({ taskId, body }) => ({ url: `${PORTAL_V2}/tasks/${taskId}`, method: 'PUT', body }),
      invalidatesTags: (_result, _error, { projectId }) => [
        { type: 'PortalTasks', id: projectId },
        { type: 'Milestones', id: projectId },
        'PortalSettingsV2',
        'Threads',
        'AuditLog',
      ],
    }),

    bulkUpdatePortalTaskVisibility: builder.mutation<
      ServerEnvelope<BulkUpdatePortalTaskVisibilityResult>,
      {
        projectId: string;
        body: BulkUpdatePortalTaskVisibilityRequest;
      }
    >({
      query: ({ projectId, body }) => ({
        url: `${PORTAL_V2}/projects/${projectId}/tasks/visibility`,
        method: 'PUT',
        body,
      }),
      invalidatesTags: (_result, _error, { projectId }) => [
        { type: 'PortalTasks', id: projectId },
        { type: 'Milestones', id: projectId },
        'PortalSettingsV2',
        'Threads',
        'AuditLog',
      ],
    }),

    // ─── Files ──────────────────────────────────────────────────────────────

    getProjectFiles: builder.query<
      ServerEnvelope<PortalFile[]>,
      { projectId: string; params?: PortalFilesParams }
    >({
      query: ({ projectId, params }) => `${PORTAL_V2}/projects/${projectId}/files${buildQuery(params)}`,
      providesTags: (_result, _error, { projectId }) => [{ type: 'PortalFiles', id: projectId }],
    }),

    // Step 1 of an upload: creates a pending record and returns a presigned URL.
    presignPortalFile: builder.mutation<
      ServerEnvelope<PresignFileResult>,
      { projectId: string; body: PresignFileRequest }
    >({
      query: ({ projectId, body }) => ({
        url: `${PORTAL_V2}/projects/${projectId}/files/presign`,
        method: 'POST',
        body,
      }),
    }),

    // Step 3: verifies the object landed and makes the file visible.
    confirmPortalFile: builder.mutation<ServerEnvelope<PortalFile>, { projectId: string; fileId: string }>({
      query: ({ projectId, fileId }) => ({
        url: `${PORTAL_V2}/projects/${projectId}/files/confirm`,
        method: 'POST',
        body: { file_id: fileId },
      }),
      invalidatesTags: (_result, _error, { projectId }) => [{ type: 'PortalFiles', id: projectId }, 'PortalSettingsV2', 'AuditLog'],
    }),

    updatePortalFile: builder.mutation<
      ServerEnvelope<PortalFile>,
      { projectId: string; fileId: string; body: { category?: string; visibility?: string } }
    >({
      query: ({ fileId, body }) => ({ url: `${PORTAL_V2}/files/${fileId}`, method: 'PUT', body }),
      invalidatesTags: (_result, _error, { projectId }) => [
        { type: 'PortalFiles', id: projectId },
        'PortalSettingsV2',
        'Approvals',
        'Threads',
        'AuditLog',
      ],
    }),

    getFileVersions: builder.query<ServerEnvelope<FileVersion[]>, string>({
      query: fileId => `${PORTAL_V2}/files/${fileId}/versions`,
      providesTags: (_result, _error, id) => [{ type: 'PortalFileVersions', id }],
    }),

    presignFileVersion: builder.mutation<
      ServerEnvelope<PresignVersionResult>,
      { fileId: string; body: Pick<PresignFileRequest, 'filename' | 'size' | 'mime_type'> }
    >({
      query: ({ fileId, body }) => ({
        url: `${PORTAL_V2}/files/${fileId}/versions/presign`,
        method: 'POST',
        body,
      }),
    }),

    confirmFileVersion: builder.mutation<
      ServerEnvelope<PortalFile>,
      { projectId: string; fileId: string; versionId: string }
    >({
      query: ({ fileId, versionId }) => ({
        url: `${PORTAL_V2}/files/${fileId}/versions/confirm`,
        method: 'POST',
        body: { version_id: versionId },
      }),
      invalidatesTags: (_result, _error, { projectId, fileId }) => [
        { type: 'PortalFiles', id: projectId },
        { type: 'PortalFileVersions', id: fileId },
        'Approvals',
        'AuditLog',
      ],
    }),

    // A short-lived link for staff; requested on demand, so it is a mutation, not a cached query.
    getFileDownloadLink: builder.mutation<ServerEnvelope<FileDownloadResult>, { fileId: string; version?: number }>({
      query: ({ fileId, version }) => `${PORTAL_V2}/files/${fileId}/download${buildQuery({ version })}`,
    }),
  }),
});

export const {
  useGetPortalProjectsQuery,
  useGetPortalProjectQuery,
  useSetPortalProjectPortalMutation,
  useGetProjectOverviewQuery,
  useSaveProjectOverviewMutation,
  usePublishProjectUpdateMutation,
  useGetProjectAccessQuery,
  useAssignProjectUserMutation,
  useRemoveProjectUserMutation,
  useLinkProjectToClientMutation,
  useGetProjectMilestonesQuery,
  useCreateMilestoneMutation,
  useUpdateMilestoneMutation,
  useCompleteMilestoneMutation,
  useDeleteMilestoneMutation,
  useGetProjectTasksQuery,
  useUpdatePortalTaskMutation,
  useGetProjectFilesQuery,
  usePresignPortalFileMutation,
  useConfirmPortalFileMutation,
  useUpdatePortalFileMutation,
  useGetFileVersionsQuery,
  usePresignFileVersionMutation,
  useConfirmFileVersionMutation,
  useGetFileDownloadLinkMutation,
  useBulkUpdatePortalTaskVisibilityMutation,  
} = portalProjectsApi;
