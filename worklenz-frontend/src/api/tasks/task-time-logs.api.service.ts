import { API_BASE_URL } from '@/shared/constants';
import apiClient from '../api-client';
import { IServerResponse } from '@/types/common.types';
import { ITaskLogViewModel } from '@/types/tasks/task-log-view.types';
import { getUserSession } from '@/utils/session-helper';
import { toQueryString } from '@/utils/toQueryString';

const rootUrl = `${API_BASE_URL}/task-time-log`;

export interface IMySummary {
  today_total: number;
  today_billable: number;
  today_non_billable: number;
  week_total: number;
  week_billable: number;
  week_non_billable: number;
}

export interface IWeeklyBreakdownDay {
  day: string;
  billable: number;
  non_billable: number;
}

export interface IRecentProject {
  id: string;
  name: string;
  color_code: string;
}

export interface ITaskInProject {
  id: string;
  name: string;
  due_date: string | null;
  task_no: number;
}

export interface IRunningTimer {
  task_id: string;
  start_time: string;
  task_name: string;
  project_id: string;
  project_name: string;
  parent_task_id?: string;
  parent_task_name?: string;
  total_time_logged?: number; // Total previously logged time in seconds
}

export interface IMyTimeLogEntriesResponse {
  logs: IRecentTimeLog[];
  total: number;
}

/** A distinct member who logged time against a task, in the "By task" view. */
export interface ITimeLogMember {
  user_id: string;
  user_name: string | null;
  avatar_url?: string | null;
  /** Name-derived avatar colour — the same one Home > My Tasks' assignees get. */
  color_code?: string | null;
}

export interface IRecentTimeLog {
  /** Log entry id in the flat view; the task id in the "By task" view. */
  id: string;
  task_id: string;
  task_name: string;
  billable?: boolean;
  /** In the "By task" view: the task's non-empty entry descriptions, newest first. */
  description?: string | null;
  user_id?: string;
  user_name?: string;
  avatar_url?: string | null;
  /** Name-derived avatar colour of `user_name` (flat view; By task uses `members`). */
  user_color_code?: string | null;
  /** Only set in the "By task" view, where `user_id`/`user_name`/`avatar_url`
   * are absent because a row covers every member who logged on the task. */
  members?: ITimeLogMember[];
  project_id: string;
  project_name: string;
  project_color?: string;
  parent_task_id?: string;
  parent_task_name?: string;
  created_at: string;
  due_date?: string | null;
  time_spent?: number;
  status_name?: string;
  status_color?: string;
  status_color_dark?: string;
  is_done?: boolean;
  priority_name?: string;
  priority_color?: string;
  priority_color_dark?: string;
}

export interface ITaskTimeLogsResponse {
  logs: ITaskLogViewModel[];
  subtasks_total_time_spent: number;
}

/** A viewer's read-visibility scope for the Time Entries page, resolved server-side. */
export interface ITimeEntriesVisibilityScope {
  team_wide: boolean;
  is_team_lead: boolean;
  is_pm_anywhere: boolean;
  has_expanded_scope: boolean;
}

export type TimeEntriesGroupBy = 'none' | 'member' | 'client' | 'project';
export type TimeEntriesScope = 'my' | 'all';
/** How the flat table lists entries: as logged, or one row per task with time summed. */
export type TimeEntriesTableView = 'flat' | 'task';

export interface ITimeEntriesPreferences {
  /** Older saved rows may still hold the retired 'task' value at runtime —
   * the Time Entries page maps it to the "By task" table view. */
  group_by: TimeEntriesGroupBy;
  scope: TimeEntriesScope;
}

export interface ITimeEntriesContext {
  visibility_scope: ITimeEntriesVisibilityScope;
  preferences: ITimeEntriesPreferences;
}

export interface ITimeEntriesStatusOption {
  name: string;
}

export interface ITimeEntriesFilterOptions {
  statuses: ITimeEntriesStatusOption[];
}

/** One entry inside a grouped-entries response — a superset of IRecentTimeLog's fields. */
export interface IGroupedTimeEntry {
  id: string;
  task_id: string;
  task_name: string;
  project_id: string;
  project_name: string;
  project_color?: string;
  billable?: boolean;
  time_spent: number;
  description?: string | null;
  due_date?: string | null;
  created_at: string;
  logged_by_timer?: boolean;
  user_id: string;
  user_name: string;
  avatar_url?: string | null;
  user_color_code?: string | null;
  status_name?: string | null;
  status_color?: string | null;
  status_color_dark?: string | null;
  priority_name?: string | null;
  priority_color?: string | null;
  priority_color_dark?: string | null;
}

export interface ITimeEntriesGroup {
  group_key: string;
  group_label: string | null;
  group_avatar_url?: string | null;
  group_color?: string | null;
  subtotal: number;
  entry_count: number;
  project_count: number;
  member_count: number;
  task_count: number;
  billable_entry_count: number;
  billable_task_count: number;
  billable_time: number;
  non_billable_entry_count: number;
  non_billable_task_count: number;
  non_billable_time: number;
  entries: IGroupedTimeEntry[];
}

export interface IGroupedEntriesResponse {
  groups: ITimeEntriesGroup[];
  total_groups: number;
}

/** Params shared by every scope-aware Time Entries query endpoint. */
interface IScopeAwareParams {
  scope?: TimeEntriesScope;
  /** Comma-separated team-member user ids. */
  person_id?: string;
  /** Comma-separated client ids; include 'none' to match projects with no client. */
  client_id?: string;
}

export const taskTimeLogsApiService = {
  getByTask: async (id: string): Promise<IServerResponse<ITaskTimeLogsResponse>> => {
    const session = getUserSession();
    const timezone = session?.timezone_name || 'UTC';
    const response = await apiClient.get(`${rootUrl}/task/${id}`, {
      params: { time_zone_name: timezone },
    });
    return response.data;
  },

  delete: async (id: string, taskId: string): Promise<IServerResponse<void>> => {
    const response = await apiClient.delete(`${rootUrl}/${id}?task=${taskId}`);
    return response.data;
  },

  create: async (body: {}): Promise<IServerResponse<ITaskLogViewModel>> => {
    const response = await apiClient.post(`${rootUrl}`, body);
    return response.data;
  },

  update: async (id: string, body: {}): Promise<IServerResponse<ITaskLogViewModel>> => {
    const response = await apiClient.put(`${rootUrl}/${id}`, body);
    return response.data;
  },

  /**
   * Time Entries page ONLY. Edit a time log via `PUT /entries/:id`, where owners/admins may
   * edit any member's entry and everyone else only their own (the server decides from the
   * session). The task drawer keeps using `update` above, which is author-only.
   */
  updateEntry: async (id: string, body: {}): Promise<IServerResponse<ITaskLogViewModel>> => {
    const response = await apiClient.put(`${rootUrl}/entries/${id}`, body);
    return response.data;
  },

  /** Time Entries page ONLY — the delete counterpart of `updateEntry`. */
  deleteEntry: async (id: string, taskId: string): Promise<IServerResponse<void>> => {
    const response = await apiClient.delete(`${rootUrl}/entries/${id}?task=${taskId}`);
    return response.data;
  },

  getRunningTimers: async (): Promise<IServerResponse<IRunningTimer[]>> => {
    const response = await apiClient.get(`${rootUrl}/running-timers`);
    return response.data;
  },

  getRecentTimeLogs: async (limit?: number): Promise<IServerResponse<IRecentTimeLog[]>> => {
    const response = await apiClient.get(`${rootUrl}/recent-logs`, { params: { limit } });
    return response.data;
  },

  getMyTimeLogEntries: async (params: {
    date_filter?: string;
    project_id?: string;
    search?: string;
    date_from?: string;
    date_to?: string;
    sort_field?: string;
    sort_order?: 'asc' | 'desc';
    page?: number;
    page_size?: number;
    /** Comma-separated, lowercased status names. */
    status?: string;
    /** Comma-separated priority ids. */
    priority_id?: string;
    /** Comma-separated 'true'/'false'; both or neither means unfiltered. */
    billable?: string;
    /** 'task' collapses the matching entries into one row per task (time summed). */
    view?: TimeEntriesTableView;
  } & IScopeAwareParams): Promise<IServerResponse<IMyTimeLogEntriesResponse>> => {
    const response = await apiClient.get(`${rootUrl}/my-time-log-entries`, { params });
    return response.data;
  },

  exportToExcel(taskId: string) {
    window.location.href = `${import.meta.env.VITE_API_URL}${API_BASE_URL}/task-time-log/export/${taskId}`;
  },

  getMySummary: async (params?: IScopeAwareParams): Promise<IServerResponse<IMySummary>> => {
    const response = await apiClient.get(`${rootUrl}/my-summary`, { params });
    return response.data;
  },

  getMyWeeklyBreakdown: async (params?: IScopeAwareParams): Promise<IServerResponse<IWeeklyBreakdownDay[]>> => {
    const response = await apiClient.get(`${rootUrl}/my-weekly-breakdown`, { params });
    return response.data;
  },

  getMyRecentProjects: async (): Promise<IServerResponse<IRecentProject[]>> => {
    const response = await apiClient.get(`${rootUrl}/my-recent-projects`);
    return response.data;
  },

  getMyTasksInProject: async (
    projectId: string,
    search?: string,
  ): Promise<IServerResponse<ITaskInProject[]>> => {
    const response = await apiClient.get(`${rootUrl}/my-tasks-in-project`, {
      params: { project_id: projectId, search },
    });
    return response.data;
  },

  getMyContext: async (): Promise<IServerResponse<ITimeEntriesContext>> => {
    const response = await apiClient.get(`${rootUrl}/my-context`);
    return response.data;
  },

  getMyFilterOptions: async (params?: IScopeAwareParams): Promise<IServerResponse<ITimeEntriesFilterOptions>> => {
    const response = await apiClient.get(`${rootUrl}/my-filter-options`, { params });
    return response.data;
  },

  updateMyPreferences: async (
    body: Partial<ITimeEntriesPreferences>
  ): Promise<IServerResponse<null>> => {
    // Best-effort UX convenience (the page swallows a failed save): opt out of the global
    // error toast so a failed save never interrupts the view.
    const response = await apiClient.put(`${rootUrl}/my-preferences`, body, {
      headers: { 'X-Silent-Request': '1' },
    });
    return response.data;
  },

  getMyGroupedEntries: async (params: {
    group_by: Exclude<TimeEntriesGroupBy, 'none'>;
    date_filter?: string;
    project_id?: string;
    search?: string;
    date_from?: string;
    date_to?: string;
    page?: number;
    page_size?: number;
  } & IScopeAwareParams): Promise<IServerResponse<IGroupedEntriesResponse>> => {
    const response = await apiClient.get(`${rootUrl}/my-grouped-entries`, { params });
    return response.data;
  },

  /** Triggers a browser download of a CSV — "filtered" is exactly the table on
   * screen (same filters and sort, every page; with `view: 'task'`, one row per
   * task with time summed), "all" exports every individual entry within the
   * viewer's scope, ignoring the narrowing filters and the table view. */
  exportMyTimeLogEntriesCsv(params: {
    mode: 'filtered' | 'all';
    date_filter?: string;
    project_id?: string;
    search?: string;
    date_from?: string;
    date_to?: string;
    status?: string;
    priority_id?: string;
    billable?: string;
    /** 'task' = the "By task" table view (filtered mode only). */
    view?: TimeEntriesTableView;
    sort_field?: string;
    sort_order?: 'asc' | 'desc';
  } & IScopeAwareParams) {
    const queryString = toQueryString(params);
    window.location.href = `${import.meta.env.VITE_API_URL}${rootUrl}/export-csv${queryString}`;
  },
};
