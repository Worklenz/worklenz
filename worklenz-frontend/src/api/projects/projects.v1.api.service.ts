import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { API_BASE_URL } from '@/shared/constants';
import { IProjectViewModel } from '@/types/project/projectViewModel.types';
import { IProjectCategory } from '@/types/project/projectCategory.types';
import { IProjectsViewModel } from '@/types/project/projectsViewModel.types';
import { IServerResponse } from '@/types/common.types';
import { IProjectMembersViewModel } from '@/types/projectMember.types';
import { getCsrfToken } from '../api-client';
import config from '@/config/env';

const rootUrl = '/projects';

export const projectsApi = createApi({
  reducerPath: 'projectsApi',
  baseQuery: fetchBaseQuery({
    baseUrl: `${config.apiUrl}${API_BASE_URL}`,
    prepareHeaders: headers => {
      headers.set('X-CSRF-Token', getCsrfToken() || '');
      headers.set('Content-Type', 'application/json');
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
      }
    >({
      query: ({ index, size, field, order, search, filter, statuses, categories }) => {
        const params = new URLSearchParams({
          index: index.toString(),
          size: size.toString(),
          field: field || '',
          order: order || '',
          search: search || '',
          filter: filter?.toString() || '',
          statuses: statuses || '',
          categories: categories || '',
        });
        return `${rootUrl}?${params.toString()}`;
      },
      providesTags: result => [{ type: 'Projects', id: 'LIST' }],
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
      invalidatesTags: (result, error, { id }) => [{ type: 'Projects', id }],
    }),

    deleteProject: builder.mutation<IServerResponse<IProjectViewModel>, string>({
      query: id => ({
        url: `${rootUrl}/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: [{ type: 'Projects', id: 'LIST' }],
    }),

    toggleFavoriteProject: builder.mutation<IServerResponse<IProjectsViewModel>, string>({
      query: id => ({
        url: `${rootUrl}/favorite/${id}`,
        method: 'GET',
      }),
      invalidatesTags: (result, error, id) => [{ type: 'Projects', id }],
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
