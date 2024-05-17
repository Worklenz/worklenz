import {ITaskStatusViewModel} from "@interfaces/api-models/task-status-get-response";
import {ITaskLabel} from "@interfaces/task-label";
import {IProjectTask} from "@interfaces/api-models/project-tasks-view-model";
import {ITask} from "@interfaces/task";

export interface IPTTaskStatusCategory {
  is_todo?: boolean;
  is_doing?: boolean;
  is_done?: boolean;
}
export interface IPTTask {
  id?: string;
  name?: string;
  status?: string;
  status_color?: string;
  priority?: string;
  start_date?: string;
  end_date?: string;
  total_hours?: number;
  total_minutes?: number;
  status_name?: string;
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
  show_sub_tasks?: boolean;
  sub_tasks?: IPTTask[];
  sub_tasks_loading?: boolean;
  statuses?: ITaskStatusViewModel[];
  labels?: ITaskLabel[];
  all_labels?: ITaskLabel[];
  priority_value?: number;
  description?: string;
  completed_at?: string;
  created_at?: string;
  phase_id?: string;
  phase_name?: string;
  phase_color?: string;
  priority_name?: string;
  status_category?: IPTTaskStatusCategory;
  total_time_string?: string
}

export interface IPTTaskListContextMenuEvent {
  event: MouseEvent,
  task: IPTTask
}

export interface IPTTaskListGroup {
  id: string;
  name: string;
  color_code: string;
  category_id?: string;
  old_category_id?: string;
  tasks: IPTTask[];
}

export interface IPTTaskListColumn {
  id?: string;
  name?: string;
  key?: string;
  index?: number;
  pinned?: true;
  project_id?: string;
}

export interface IPTTaskListConfig {
  id: string;
  search: string | null;
  projects: string | null;
  count?: boolean;
  parent_task?: string;
  group?: string;
  isSubtasksInclude: boolean;
      field?: string,
      order?: string,
      statuses?: string,
      members?: string,
      priorities?: string,
      labels?: string,
      archived?: string
}

export interface IPTTaskListContextMenuEvent {
  event: MouseEvent,
  task: IPTTask
}

export interface IPTTaskCreateRequest extends ITask {
  status_id?: string;
  template_id?: string;
  task_index?: number;
  attachments?: string[];
  labels?: string[];
  parent_task_id?: string;
  reporter_id?: string;
  team_id?: string;
  priority_id?: string;
  phase_id?: string;
}
