import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { API_BASE_URL } from '@/shared/constants';
import { IProjectViewModel } from '@/types/project/projectViewModel.types';
import { IProjectCategory } from '@/types/project/projectCategory.types';
import { IProjectsViewModel } from '@/types/project/projectsViewModel.types';
import { IServerResponse } from '@/types/common.types';
import { IProjectMembersViewModel } from '@/types/projectMember.types';
import { getCsrfToken, ensureCsrfToken } from '../api-client';
import config from '@/config/env';

const rootUrl = '/projects';

export const projectsApi = createApi({
  reducerPath: 'projectsApi',
  baseQuery: fetchBaseQuery({
    baseUrl: `${config.apiUrl}${API_BASE_URL}`,
    prepareHeaders: async headers => {
      let token = getCsrfToken();
      if (!token) {
        try {
          token = await ensureCsrfToken();
        } catch (error) {
          console.error('[CSRF] Failed to refresh CSRF token:', error);
        }
      }
      if (token) {
        headers.set('X-CSRF-Token', token);
      }
      headers.set('Content-Type', 'application/json');
      return headers;
    },
    credentials: 'include',
  }),
  tagTypes: ['Projects', 'ProjectCategories', 'ProjectMembers'],
  endpoints: builder => ({
    getProjects: builder.query<
      IServerResponse<IProjectsViewModel>,
      {
        index: number;
        size: number;
        field: string | null;
        order: string | null;
        search: string | null;
        filter: number | null;
        statuses: string | null;
        categories: string | null;
        priorities: string | null;
      }
    >({
      query: ({ index, size, field, order, search, filter, statuses, categories, priorities }) => {
        const params = new URLSearchParams({
          index: index.toString(),
          size: size.toString(),
          field: field || '',
          order: order || '',
          search: search || '',
          filter: filter?.toString() || '',
          statuses: statuses || '',
          categories: categories || '',
          priorities: priorities || '',
        });
        return `${rootUrl}?${params.toString()}`;
      },
      // KEY FIX: Tag every filter variant with the general 'LIST' id.
      // RTK Query cache entries are keyed by ALL query args, so filter=0
      // and filter=1 are separate cache entries. By giving all of them the
      // same { id: 'LIST' } tag, invalidating 'LIST' busts every variant at
      // once — so switching between "All" and "Favorites" always re-fetches
      // fresh data after a favorite toggle.
      providesTags: () => [{ type: 'Projects', id: 'LIST' }],
    }),

    getProject: builder.query<IServerResponse<IProjectViewModel>, string>({
      query: id => `${rootUrl}/${id}`,
      providesTags: (result, error, id) => [{ type: 'Projects', id }],
    }),

    createProject: builder.mutation<IServerResponse<IProjectViewModel>, IProjectViewModel>({
      query: project => ({
        url: rootUrl,
        method: 'POST',
        body: project,
      }),
      invalidatesTags: [{ type: 'Projects', id: 'LIST' }],
    }),

    updateProject: builder.mutation<
      IServerResponse<IProjectViewModel>,
      { id: string; project: IProjectViewModel }
    >({
      query: ({ id, project }) => ({
        url: `${rootUrl}/${id}`,
        method: 'PUT',
        body: project,
      }),
      invalidatesTags: (result, error, { id }) => [
        { type: 'Projects', id },
        { type: 'Projects', id: 'LIST' },
      ],
    }),

    deleteProject: builder.mutation<IServerResponse<IProjectViewModel>, string>({
      query: id => ({
        url: `${rootUrl}/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: [{ type: 'Projects', id: 'LIST' }],
    }),

    // ROOT CAUSE FIX: Was invalidating { type: 'Projects', id } — a single
    // project tag that never matched { id: 'LIST' }, so the list cache was
    // never invalidated. Now invalidates 'LIST' to bust ALL filter variants.
    toggleFavoriteProject: builder.mutation<IServerResponse<IProjectsViewModel>, string>({
      query: id => ({
        url: `${rootUrl}/favorite/${id}`,
        method: 'GET',
      }),
      invalidatesTags: [{ type: 'Projects', id: 'LIST' }],
    }),

    toggleArchiveProject: builder.mutation<IServerResponse<any>, string>({
      query: id => ({
        url: `${rootUrl}/archive/${id}`,
        method: 'GET',
      }),
      invalidatesTags: [{ type: 'Projects', id: 'LIST' }],
    }),

    toggleArchiveProjectForAll: builder.mutation<IServerResponse<any>, string>({
      query: id => ({
        url: `${rootUrl}/archive-all/${id}`,
        method: 'GET',
      }),
      invalidatesTags: [{ type: 'Projects', id: 'LIST' }],
    }),

    getProjectCategories: builder.query<IProjectCategory[], void>({
      query: () => `${rootUrl}/categories`,
      providesTags: ['ProjectCategories'],
    }),

    getProjectMembers: builder.query<
      IServerResponse<IProjectMembersViewModel>,
      {
        id: string;
        index: number;
        size: number;
        field: string | null;
        order: string | null;
        search: string | null;
      }
    >({
      query: ({ id, index, size, field, order, search }) => {
        const params = new URLSearchParams({
          index: index.toString(),
          size: size.toString(),
          field: field || '',
          order: order || '',
          search: search || '',
        });
        return `${rootUrl}/members/${id}?${params.toString()}`;
      },
      providesTags: (result, error, { id }) => [{ type: 'ProjectMembers', id }],
    }),
  }),
});

export const {
  useGetProjectsQuery,
  useGetProjectQuery,
  useCreateProjectMutation,
  useUpdateProjectMutation,
  useDeleteProjectMutation,
  useToggleFavoriteProjectMutation,
  useToggleArchiveProjectMutation,
  useToggleArchiveProjectForAllMutation,
  useGetProjectCategoriesQuery,
  useGetProjectMembersQuery,
} = projectsApi;
