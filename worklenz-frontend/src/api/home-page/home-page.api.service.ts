import { BaseQueryFn, createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { API_BASE_URL } from '@/shared/constants';
import { IServerResponse } from '@/types/common.types';
import { toQueryString } from '@/utils/toQueryString';
import { IHomeTasksModel, IHomeTasksConfig } from '@/types/home/home-page.types';
import { IMyTask } from '@/types/home/my-tasks.types';
import { IProject } from '@/types/project/project.types';
import { getCsrfToken, ensureCsrfToken } from '../api-client';
import config from '@/config/env';

const rootUrl = '/home';

const api = createApi({
  reducerPath: 'homePageApi',
  baseQuery: fetchBaseQuery({
    baseUrl: `${config.apiUrl}${API_BASE_URL}`,
    prepareHeaders: async headers => {
      // Get CSRF token, refresh if needed
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
  tagTypes: ['personalTasks', 'projects', 'teamProjects', 'myTasks', 'taskCounts'],
  endpoints: builder => ({
    getPersonalTasks: builder.query<IServerResponse<IMyTask[]>, void>({
      query: () => `${rootUrl}/personal-tasks`,
    }),
    createPersonalTask: builder.mutation<IServerResponse<any>, IMyTask>({
      query: body => ({
        url: `${rootUrl}/personal-task`,
        method: 'POST',
        body,
      }),
    }),
    markPersonalTaskAsDone: builder.mutation<IServerResponse<any>, string>({
      query: taskId => ({
        url: `${rootUrl}/update-personal-task`,
        method: 'PUT',
        body: { id: taskId },
      }),
    }),
    getMyTasks: builder.query<IServerResponse<IHomeTasksModel>, IHomeTasksConfig>({
      query: config => {
        const { tasks_group_by, current_tab, is_calendar_view, selected_date, time_zone } = config;
        const url = `${rootUrl}/tasks${toQueryString({
          group_by: tasks_group_by,
          current_tab,
          is_calendar_view,
          selected_date: selected_date?.toISOString().split('T')[0],
          time_zone,
        })}`;
        return url;
      },
      providesTags: ['myTasks'],
    }),
    getProjects: builder.query<IServerResponse<IProject[]>, { view: number }>({
      query: ({ view }) => `${rootUrl}/projects?view=${view}`,
    }),
    getProjectsByTeam: builder.query<IServerResponse<IProject[]>, void>({
      query: () => `${rootUrl}/team-projects`,
    }),
    getTaskCountsByMonth: builder.query<
      IServerResponse<Array<{ date: string; count: number }>>,
      { month: string; group_by: number; time_zone: string }
    >({
      query: ({ month, group_by, time_zone }) =>
        `${rootUrl}/task-counts${toQueryString({ month, group_by, time_zone })}`,
      providesTags: ['taskCounts'],
      keepUnusedDataFor: 300, // Cache for 5 minutes
    }),
  }),
});

export const {
  useCreatePersonalTaskMutation,
  useGetMyTasksQuery,
  useGetPersonalTasksQuery,
  useGetProjectsQuery,
  useGetProjectsByTeamQuery,
  useMarkPersonalTaskAsDoneMutation,
  useGetTaskCountsByMonthQuery,
  util: { invalidateTags },
} = api;

export default api;
