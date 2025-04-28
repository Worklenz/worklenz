import { BaseQueryFn, createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { API_BASE_URL } from '@/shared/constants';
import { IServerResponse } from '@/types/common.types';
import { toQueryString } from '@/utils/toQueryString';
import { IHomeTasksModel, IHomeTasksConfig } from '@/types/home/home-page.types';
import { IMyTask } from '@/types/home/my-tasks.types';
import { IProject } from '@/types/project/project.types';
import { getCsrfToken } from '../api-client';
import config from '@/config/env';

const rootUrl = '/home';

const api = createApi({
  reducerPath: 'homePageApi',
  baseQuery: fetchBaseQuery({
    baseUrl: `${config.apiUrl}${API_BASE_URL}`,
    prepareHeaders: headers => {
      headers.set('X-CSRF-Token', getCsrfToken() || '');
      headers.set('Content-Type', 'application/json');
    },
    credentials: 'include',
  }),
  tagTypes: ['personalTasks', 'projects', 'teamProjects'],
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
    }),
    getProjects: builder.query<IServerResponse<IProject[]>, { view: number }>({
      query: ({ view }) => `${rootUrl}/projects?view=${view}`,
    }),
    getProjectsByTeam: builder.query<IServerResponse<IProject[]>, void>({
      query: () => `${rootUrl}/team-projects`,
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
} = api;

export default api;
