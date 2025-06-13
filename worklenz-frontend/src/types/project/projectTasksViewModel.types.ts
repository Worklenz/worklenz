import { InlineMember } from '../teamMembers/inlineMember.types';
import { ITaskLabel } from '../tasks/taskLabel.types';
import { ITaskStatusViewModel } from '../tasks/taskStatusGetResponse.types';

export interface ITaskAssignee {
  team_member_id: any;
  id: string;
  project_member_id: string;
  name: string;
}

export interface ITaskStatusCategory {
  is_todo?: boolean;
  is_doing?: boolean;
  is_done?: boolean;
}

export interface IProjectTask {
  manual_progress: any;
  due_time?: string;
  id?: string;
  name?: string;
  task_key?: string;
  assignees?: ITaskAssignee[];
  names?: InlineMember[];
  reporter?: string;
  status?: string;
  status_id?: string;
  status_color?: string;
  status_color_dark?: string;
  priority?: string;
  start_date?: string;
  end_date?: string;
  total_hours?: number;
  total_minutes?: number;
  total_minutes_spent?: number;
  progress?: number;
  overdue?: boolean;
  time_spent_string?: string;
  comments_count?: number;
  has_subscribers?: boolean;
  attachments_count?: number;
  has_dependencies?: boolean;
  schedule_id?: string;
  status_name?: string;
  total_time_string?: string;
  due_in?: string;
  time_spent?: { hours?: number; minutes?: number };
  project_id?: string;
  project_name?: string;
  updated_at?: string;
  name_color?: string;
  sub_tasks_count?: number;
  total_tasks_count?: number;
  is_sub_task?: boolean;
  parent_task_name?: string;
  parent_task_id?: string;
  show_handles?: boolean;
  min?: number;
  max?: number;
  sort_order?: number;
  color_code?: string;
  priority_color?: string;
  priority_color_dark?: string;
  show_sub_tasks?: boolean;
  sub_tasks?: IProjectTask[];
  sub_tasks_loading?: boolean;
  statuses?: ITaskStatusViewModel[];
  project_statuses?: ITaskStatusViewModel[];
  labels?: ITaskLabel[];
  all_labels?: ITaskLabel[];
  archived?: boolean;
  complete_ratio?: number;
  completed_count?: number;
  priority_value?: number;
  is_overdue?: boolean;
  timer_start_time?: number | null;
  description?: string;
  completed_at?: string;
  created_at?: string;
  phase_id?: string;
  phase_name?: string;
  phase_color?: string;
  priority_name?: string;
  status_category?: ITaskStatusCategory;
  overdue_days?: string | null;
  overlogged_time_string?: string;
  offset_from?: number;
  width?: number;
  isVisible?: boolean;
  estimated_string?: string;
  custom_column_values?: Record<string, any>;
  progress_value?: number;
  project_use_manual_progress?: boolean;
  project_use_time_progress?: boolean;
  project_use_weighted_progress?: boolean;
}

export interface IProjectTasksViewModel {
  total?: number;
  data?: IProjectTask[];
}
