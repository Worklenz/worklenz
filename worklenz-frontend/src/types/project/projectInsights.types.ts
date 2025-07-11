export interface IProjectInsightsGetRequest {
  total_tasks_count?: number;
  archived_tasks_count?: number;
  sub_tasks_count?: number;
  completed_tasks_count?: number;
  pending_tasks_count?: number;
  todo_tasks_count?: number;
  last_week_count?: number;
  overdue_count?: number;
  todo_tasks_color_code?: string;
  pending_tasks_color_code?: string;
  completed_tasks_color_code?: string;
  total_estimated_hours_string?: string;
  total_logged_hours_string?: string;
  total_estimated_hours?: number;
  total_logged_hours?: number;
  overlogged_hours?: string;
}

export interface IProjectLogs {
  description?: string;
  created_at?: string;
}

export interface IProjectMemberStats {
  total_members_count?: number;
  unassigned_members?: number;
  overdue_members?: number;
}

export interface IInsightTasks {
  id?: string;
  name?: string;
  start_date?: string;
  end_date?: string;
  completed_at?: string;
  status?: string;
  status_id?: string;
  status_color?: string;
  status_name?: string;
  updated_at?: string;
  total_minutes?: string;
  overlogged_time?: string;
  overlogged_time_string?: string;
  days_overdue?: number;
  is_overdue?: boolean;
  parent_task_id?: string;
}

export interface IDeadlineTaskStats {
  deadline_tasks_count?: number;
  deadline_logged_hours?: number;
  deadline_logged_hours_string?: string;
  project_end_date?: string;
  tasks?: IInsightTasks[];
}
