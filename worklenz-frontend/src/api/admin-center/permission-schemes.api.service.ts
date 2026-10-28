import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { API_BASE_URL } from '@/shared/constants';
import { ensureCsrfToken, getCsrfToken } from '@/api/api-client';
import config from '@/config/env';
import { IServerResponse } from '@/types/common.types';
import {
  IGrantUpdateRequest,
  IPermissionGrant,
  IPermissionGroup,
  IPermissionScheme,
  IProjectSchemeAssignment,
  ISchemeRoleMember,
  ISchemeWithRolesAndGrants,
  ITeamProjectScheme,
  OrganizationPermission,
} from '@/types/admin-center/permission-schemes.types';
import { IOrganizationProjectsGetResponse } from '@/types/admin-center/admin-center.types';

const rootUrl = '/admin-center';

export const permissionSchemesApi = createApi({
  reducerPath: 'permissionSchemesApi',
  baseQuery: fetchBaseQuery({
    baseUrl: `${config.apiUrl}${API_BASE_URL}`,
    prepareHeaders: async headers => {
      const token = getCsrfToken() || (await ensureCsrfToken());
      if (token) headers.set('X-CSRF-Token', token);
      headers.set('Content-Type', 'application/json');
      return headers;
    },
    credentials: 'include',
  }),
  tagTypes: ['PermissionSchemes', 'PermissionGroups', 'ProjectScheme', 'MyOrganizationPermissions'],
  endpoints: builder => ({
    // teamId is only a cache key so permissions refetch after switching teams
    getMyOrganizationPermissions: builder.query<OrganizationPermission[], string>({
      query: () => ({ url: `${rootUrl}/my-organization-permissions` }),
      transformResponse: (response: IServerResponse<OrganizationPermission[]>) =>
        response.body ?? [],
      providesTags: ['MyOrganizationPermissions'],
    }),

    // -------------------------------------------------------------------------
    // Schemes
    // -------------------------------------------------------------------------
    listSchemes: builder.query<IPermissionScheme[], void>({
      query: () => ({ url: `${rootUrl}/permission-schemes` }),
      transformResponse: (response: IServerResponse<IPermissionScheme[]>) =>
        response.body ?? [],
      providesTags: ['PermissionSchemes'],
    }),

    getScheme: builder.query<ISchemeWithRolesAndGrants, string>({
      query: id => ({ url: `${rootUrl}/permission-schemes/${id}` }),
      transformResponse: (response: IServerResponse<ISchemeWithRolesAndGrants>) =>
        response.body,
      providesTags: ['PermissionSchemes'],
    }),

    createScheme: builder.mutation<IPermissionScheme, { name: string }>({
      query: body => ({
        url: `${rootUrl}/permission-schemes`,
        method: 'POST',
        body,
      }),
      transformResponse: (response: IServerResponse<IPermissionScheme>) => response.body,
      invalidatesTags: ['PermissionSchemes'],
    }),

    updateScheme: builder.mutation<IPermissionScheme, { id: string; name: string }>({
      query: ({ id, ...body }) => ({
        url: `${rootUrl}/permission-schemes/${id}`,
        method: 'PUT',
        body,
      }),
      transformResponse: (response: IServerResponse<IPermissionScheme>) => response.body,
      invalidatesTags: ['PermissionSchemes'],
    }),

    deleteScheme: builder.mutation<void, string>({
      query: id => ({
        url: `${rootUrl}/permission-schemes/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['PermissionSchemes'],
    }),

    updateGrants: builder.mutation<IPermissionGrant[], { id: string } & IGrantUpdateRequest>({
      query: ({ id, grants }) => ({
        url: `${rootUrl}/permission-schemes/${id}/grants`,
        method: 'PUT',
        body: { grants },
      }),
      transformResponse: (response: IServerResponse<IPermissionGrant[]>) => response.body,
      invalidatesTags: ['PermissionSchemes', 'MyOrganizationPermissions'],
    }),

    addSchemePermissions: builder.mutation<
      IPermissionGrant[],
      { id: string; permissions: string[] }
    >({
      query: ({ id, permissions }) => ({
        url: `${rootUrl}/permission-schemes/${id}/permissions`,
        method: 'POST',
        body: { permissions },
      }),
      transformResponse: (response: IServerResponse<IPermissionGrant[]>) => response.body,
      invalidatesTags: ['PermissionSchemes'],
    }),

    removeSchemePermissions: builder.mutation<
      IPermissionGrant[],
      { id: string; permissions: string[] }
    >({
      query: ({ id, permissions }) => ({
        url: `${rootUrl}/permission-schemes/${id}/permissions/remove`,
        method: 'POST',
        body: { permissions },
      }),
      transformResponse: (response: IServerResponse<IPermissionGrant[]>) => response.body,
      invalidatesTags: ['PermissionSchemes'],
    }),

    // -------------------------------------------------------------------------
    // Groups
    // -------------------------------------------------------------------------
    listGroups: builder.query<IPermissionGroup[], void>({
      query: () => ({ url: `${rootUrl}/permission-groups` }),
      transformResponse: (response: IServerResponse<IPermissionGroup[]>) =>
        response.body ?? [],
      providesTags: ['PermissionGroups'],
    }),

    createGroup: builder.mutation<IPermissionGroup, { name: string; member_ids?: string[] }>({
      query: body => ({
        url: `${rootUrl}/permission-groups`,
        method: 'POST',
        body,
      }),
      transformResponse: (response: IServerResponse<IPermissionGroup>) => response.body,
      invalidatesTags: ['PermissionGroups'],
    }),

    updateGroup: builder.mutation<
      IPermissionGroup,
      { id: string; name?: string; member_ids?: string[] }
    >({
      query: ({ id, ...body }) => ({
        url: `${rootUrl}/permission-groups/${id}`,
        method: 'PUT',
        body,
      }),
      transformResponse: (response: IServerResponse<IPermissionGroup>) => response.body,
      invalidatesTags: ['PermissionGroups'],
    }),

    deleteGroup: builder.mutation<void, string>({
      query: id => ({
        url: `${rootUrl}/permission-groups/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['PermissionGroups'],
    }),

    // -------------------------------------------------------------------------
    // Project scheme assignments
    // -------------------------------------------------------------------------
    getTeamProjectSchemes: builder.query<ITeamProjectScheme[], void>({
      query: () => ({ url: `${rootUrl}/permission-scheme-projects` }),
      transformResponse: (response: IServerResponse<ITeamProjectScheme[]>) =>
        response.body ?? [],
      providesTags: ['ProjectScheme'],
    }),

    getProjectScheme: builder.query<IProjectSchemeAssignment, string>({
      query: projectId => ({ url: `${rootUrl}/projects/${projectId}/scheme` }),
      transformResponse: (response: IServerResponse<IProjectSchemeAssignment>) =>
        response.body,
      providesTags: ['ProjectScheme'],
    }),

    assignProjectScheme: builder.mutation<
      IProjectSchemeAssignment,
      { projectId: string; scheme_id: string | null }
    >({
      query: ({ projectId, scheme_id }) => ({
        url: `${rootUrl}/projects/${projectId}/scheme`,
        method: 'PUT',
        body: { scheme_id },
      }),
      transformResponse: (response: IServerResponse<IProjectSchemeAssignment>) =>
        response.body,
      invalidatesTags: ['ProjectScheme'],
    }),

    addSchemeMember: builder.mutation<
      ISchemeRoleMember,
      {
        projectId: string;
        scheme_id: string;
        role_name: string;
        team_member_id?: string;
        group_id?: string;
      }
    >({
      query: ({ projectId, ...body }) => ({
        url: `${rootUrl}/projects/${projectId}/scheme/members`,
        method: 'POST',
        body,
      }),
      transformResponse: (response: IServerResponse<ISchemeRoleMember>) => response.body,
      invalidatesTags: ['ProjectScheme'],
    }),

    removeSchemeMember: builder.mutation<void, { projectId: string; memberId: string }>({
      query: ({ projectId, memberId }) => ({
        url: `${rootUrl}/projects/${projectId}/scheme/members/${memberId}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['ProjectScheme'],
    }),

    // -------------------------------------------------------------------------
    // Organization projects (reused for the Projects tab in R&P page)
    // -------------------------------------------------------------------------
    getOrganizationProjects: builder.query<IOrganizationProjectsGetResponse, void>({
      query: () => ({ url: '/admin-center/organization/projects' }),
      transformResponse: (response: IServerResponse<IOrganizationProjectsGetResponse>) =>
        response.body ?? { total: 0, data: [] },
    }),
  }),
});

export const {
  useGetMyOrganizationPermissionsQuery,
  useListSchemesQuery,
  useGetSchemeQuery,
  useCreateSchemeMutation,
  useUpdateSchemeMutation,
  useDeleteSchemeMutation,
  useUpdateGrantsMutation,
  useAddSchemePermissionsMutation,
  useRemoveSchemePermissionsMutation,
  useListGroupsQuery,
  useCreateGroupMutation,
  useUpdateGroupMutation,
  useDeleteGroupMutation,
  useGetTeamProjectSchemesQuery,
  useGetProjectSchemeQuery,
  useAssignProjectSchemeMutation,
  useAddSchemeMemberMutation,
  useRemoveSchemeMemberMutation,
  useGetOrganizationProjectsQuery,
} = permissionSchemesApi;
