import { BaseQueryFn, createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type { ThunkDispatch, UnknownAction } from '@reduxjs/toolkit';
import type { HomePreferences } from '@/features/home-page/homePreferences.slice';
import { API_BASE_URL } from '@/shared/constants';
import { IServerResponse } from '@/types/common.types';
import { toQueryString } from '@/utils/toQueryString';
import { IHomeTasksModel, IHomeTasksConfig, IHomeCalendarTask, IHomeTaskFilterOptions } from '@/types/home/home-page.types';
import { IMyTask } from '@/types/home/my-tasks.types';
import { IProject } from '@/types/project/project.types';
import { IClient } from '@/types/client.types';
import { getCsrfToken, ensureCsrfToken } from '../api-client';
import config from '@/config/env';
import dayjs from 'dayjs';

const rootUrl = '/home';

/** What POST/DELETE /home/pinned-tasks/:taskId return. */
export interface IHomePinResult {
  task_id: string;
  is_pinned: boolean;
  pinned_at?: string;
}

/** One row of GET /home/mentions: a task comment that @mentions the current user. */
export interface IHomeMention {
  /** The comment's id. */
  id: string;
  task_id: string;
  task_name: string;
  project_id: string;
  project_name: string;
  project_color: string | null;
  /** The commenter's team-member id, so a reply can @mention them. */
  author_team_member_id: string | null;
  author_name: string;
  author_avatar_url: string | null;
  /** The comment as one line of plain text, with each @mention filled in. */
  excerpt: string;
  created_at: string;
}

/** GET/PUT /home/preferences. `updated_at` is null when the user has never saved. */
export interface IHomePreferencesResponse {
  preferences: HomePreferences;
  updated_at: string | null;
}

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
  tagTypes: [
    'personalTasks',
    'projects',
    'teamProjects',
    'myTasks',
    'taskCounts',
    'calendarTasks',
    'clientsLookup',
    'homeTaskList',
    'homeMentions',
  ],
  endpoints: builder => ({
    getPersonalTasks: builder.query<IServerResponse<IMyTask[]>, { filter?: string; year?: string } | void>({
      query: (params) => {
        if (!params) return `${rootUrl}/personal-tasks`;
        const { filter, year } = params;

        let startDate: string | undefined;
        let endDate: string | undefined;

        if (filter === 'today') {
          startDate = dayjs().startOf('day').toISOString();
          endDate = dayjs().endOf('day').toISOString();
        } else if (filter === 'week') {
          startDate = dayjs().startOf('week').toISOString();
          endDate = dayjs().endOf('week').toISOString();
        } else if (filter === 'month') {
          startDate = dayjs().startOf('month').toISOString();
          endDate = dayjs().endOf('month').toISOString();
        } else if (filter === 'year' && year) {
          startDate = dayjs(year).startOf('year').toISOString();
          endDate = dayjs(year).endOf('year').toISOString();
        }

        const qs = toQueryString({ filter, year, startDate, endDate });
        return `${rootUrl}/personal-tasks${qs}`;
      },
      providesTags: ['personalTasks'],
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
    getTaskStats: builder.query<
      IServerResponse<{
        today: number;
        week: number;
        overdue: number;
        completed_today: number;
        completed_week: number;
      }>,
      { group_by: number; time_zone: string }
    >({
      query: ({ group_by, time_zone }) =>
        `${rootUrl}/task-stats${toQueryString({ group_by, time_zone })}`,
      providesTags: ['myTasks'],
    }),
    getMyProgress: builder.query<
      IServerResponse<{
        today: { total: number; todo: number; doing: number; done: number };
        week: { total: number; todo: number; doing: number; done: number };
      }>,
      { group_by: number; time_zone: string }
    >({
      query: ({ group_by, time_zone }) =>
        `${rootUrl}/my-progress${toQueryString({ group_by, time_zone })}`,
      providesTags: ['myTasks'],
    }),
    getMyTasks: builder.query<IServerResponse<IHomeTasksModel>, IHomeTasksConfig>({
      query: config => {
        const {
          tasks_group_by, current_tab, is_calendar_view, selected_date, time_zone,
          index, size, status, priorityIds, projectIds, assigneeIds, search,
          sortField, sortOrder, overdueOnly, noDueOnly, pinFirst,
        } = config;
        const url = `${rootUrl}/tasks${toQueryString({
          group_by: tasks_group_by,
          current_tab,
          is_calendar_view,
          selected_date: selected_date?.toISOString().split('T')[0],
          time_zone,
          index,
          size,
          status,
          priority_ids: priorityIds,
          project_ids: projectIds,
          assignee_ids: assigneeIds,
          search,
          sort_field: sortField,
          sort_order: sortOrder,
          overdue_only: overdueOnly,
          no_due_only: noDueOnly,
          pin_first: pinFirst,
        }, { arrayFormat: 'brackets' })}`;
        return url;
      },
      // 'homeTaskList' is separate from 'myTasks' so pinning refetches this list without also
      // refetching the stat cards and progress donut.
      providesTags: ['myTasks', 'homeTaskList'],
      // With varying page/filter args each combination is its own cache
      // entry. refetchOnMountOrArgChange (set by both consumers) still
      // forces a refetch on mount regardless, but keepUnusedDataFor: 60
      // means an in-flight/just-fetched entry survives a quick unmount+
      // remount (e.g. switching tabs and back) so RTK Query can dedupe
      // against it instead of always issuing a fresh request.
      keepUnusedDataFor: 60,
    }),
    pinHomeTask: builder.mutation<IServerResponse<IHomePinResult>, string>({
      query: taskId => ({ url: `${rootUrl}/pinned-tasks/${taskId}`, method: 'POST' }),
      // Refetch so the pinned task takes its place at the top across every page.
      invalidatesTags: ['homeTaskList'],
    }),
    unpinHomeTask: builder.mutation<IServerResponse<IHomePinResult>, string>({
      query: taskId => ({ url: `${rootUrl}/pinned-tasks/${taskId}`, method: 'DELETE' }),
      invalidatesTags: ['homeTaskList'],
    }),
    getHomePreferences: builder.query<IServerResponse<IHomePreferencesResponse>, string | void>({
      query: () => `${rootUrl}/preferences`,
    }),
    updateHomePreferences: builder.mutation<IServerResponse<IHomePreferencesResponse>, HomePreferences>({
      query: body => ({ url: `${rootUrl}/preferences`, method: 'PUT', body }),
    }),
    getUnassignedTasks: builder.query<
      IServerResponse<IHomeTasksModel>,
      {
        index?: number; size?: number; status?: string[]; priorityIds?: string[];
        projectIds?: string[]; search?: string; sortField?: string; sortOrder?: 'asc' | 'desc';
      } | void
    >({
      query: params => `${rootUrl}/unassigned-tasks${toQueryString({
        index: params?.index,
        size: params?.size,
        status: params?.status,
        priority_ids: params?.priorityIds,
        project_ids: params?.projectIds,
        search: params?.search,
        sort_field: params?.sortField,
        sort_order: params?.sortOrder,
      }, { arrayFormat: 'brackets' })}`,
      providesTags: ['myTasks'],
      keepUnusedDataFor: 60,
    }),
    getTaskFilterOptions: builder.query<IServerResponse<IHomeTaskFilterOptions>, { group_by: number }>({
      query: ({ group_by }) => `${rootUrl}/tasks/filter-options${toQueryString({ group_by })}`,
      providesTags: ['myTasks'],
    }),
    getProjects: builder.query<IServerResponse<IProject[]>, { view: number; limit?: number }>({
      query: ({ view, limit }) => `${rootUrl}/projects${toQueryString({ view, limit })}`,
    }),
    getProjectsByTeam: builder.query<IServerResponse<IProject[]>, void>({
      query: () => `${rootUrl}/team-projects`,
      providesTags: ['teamProjects'],
    }),
    getHomeMentions: builder.query<IServerResponse<IHomeMention[]>, { limit?: number } | void>({
      query: params => `${rootUrl}/mentions${toQueryString({ limit: params?.limit })}`,
      providesTags: ['homeMentions'],
      keepUnusedDataFor: 60,
    }),
    getClientsLookup: builder.query<IServerResponse<IClient[]>, void>({
      query: () => `/clients/lookup`,
      providesTags: ['clientsLookup'],
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
    getTasksByDateRange: builder.query<
      IServerResponse<IHomeCalendarTask[]>,
      { start_date: string; end_date: string; group_by: number; time_zone: string }
    >({
      query: ({ start_date, end_date, group_by, time_zone }) =>
        `${rootUrl}/tasks-by-date-range${toQueryString({ start_date, end_date, group_by, time_zone })}`,
      providesTags: ['calendarTasks'],
      keepUnusedDataFor: 60,
    }),
  }),
});

/**
 * Flips `is_pinned` on a task in every cached My Tasks list, so the pin icon responds at once while
 * the request is in flight (the list is refetched afterwards to put the task in its real place).
 * Returns a function that puts the previous values back, for when the request fails.
 *
 * Dispatch it as a thunk: `const undo = dispatch((d, getState) => applyPinToCachedTasks(d, getState, id, true))`.
 */
type HomeApiState = Parameters<typeof api.util.selectCachedArgsForQuery>[0];

export const applyPinToCachedTasks = (
  dispatch: ThunkDispatch<HomeApiState, unknown, UnknownAction>,
  getState: () => HomeApiState,
  taskId: string,
  isPinned: boolean
): (() => void) => {
  const state = getState();
  const pinnedAt = isPinned ? new Date().toISOString() : null;
  const patches = api.util.selectCachedArgsForQuery(state, 'getMyTasks').map(arg =>
    dispatch(
      api.util.updateQueryData('getMyTasks', arg, draft => {
        for (const task of draft.body?.tasks ?? []) {
          if (task.id === taskId) {
            task.is_pinned = isPinned;
            task.pinned_at = pinnedAt;
          }
        }
      })
    )
  );
  return () => patches.forEach(patch => patch.undo());
};

export const {
  usePinHomeTaskMutation,
  useUnpinHomeTaskMutation,
  useGetHomePreferencesQuery,
  useUpdateHomePreferencesMutation,
  useCreatePersonalTaskMutation,
  useGetMyTasksQuery,
  useGetUnassignedTasksQuery,
  useGetTaskFilterOptionsQuery,
  useGetMyProgressQuery,
  useGetTaskStatsQuery,
  useGetPersonalTasksQuery,
  useGetProjectsQuery,
  useGetProjectsByTeamQuery,
  useGetHomeMentionsQuery,
  useGetClientsLookupQuery,
  useMarkPersonalTaskAsDoneMutation,
  useGetTaskCountsByMonthQuery,
  useGetTasksByDateRangeQuery,
  util: { invalidateTags },
} = api;

export default api;
