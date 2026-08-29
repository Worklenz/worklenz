import { API_BASE_URL } from '@/shared/constants';
import { IServerResponse } from '@/types/common.types';
import apiClient from '../api-client';

const rootUrl = `${API_BASE_URL}/task-recurring`;

export interface IRecurringTaskAssignee {
  team_member_id: string;
  project_member_id: string;
  name: string;
  avatar_url: string;
  user_id: string;
  email: string;
}

export interface IRecurringTaskRow {
  id: string;
  name: string;
  task_key: string;
  total_minutes: number;
  est_time_string: string;
  project_id: string;
  project_name: string;
  project_color: string;
  priority_id: string;
  priority_name: string;
  priority_color: string;
  priority_color_dark: string | null;
  assignees: IRecurringTaskAssignee[];
  schedule_id: string;
  schedule_type:
    | 'daily'
    | 'weekly'
    | 'monthly'
    | 'yearly'
    | 'every_x_days'
    | 'every_x_weeks'
    | 'every_x_months';
  days_of_week: number[] | null;
  day_of_month: number | null;
  date_of_month: number | null;
  week_of_month: number | null;
  interval_days: number | null;
  interval_weeks: number | null;
  interval_months: number | null;
  is_active: boolean;
  start_date: string | null;
  end_date: string | null;
  recurring_mode: 'create_task' | 'change_status';
}

export interface IRecurringTasksListResponse {
  total: number;
  data: IRecurringTaskRow[];
}

export interface IRecurringTasksListParams {
  index?: number;
  size?: number;
  search?: string;
  project_id?: string;
  team_member_id?: string;
  recurring_mode?: string;
  schedule_type?: string;
  priority_id?: string;
  field?: string;
  order?: 'asc' | 'desc';
}

export const recurringTasksListApiService = {
  getRecurringTasks: async (
    params: IRecurringTasksListParams
  ): Promise<IServerResponse<IRecurringTasksListResponse>> => {
    const response = await apiClient.get(rootUrl, { params });
    return response.data;
  },
};
