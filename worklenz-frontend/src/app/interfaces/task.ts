import {ISubTask} from "@interfaces/sub-task";
import {IUser} from "@interfaces/user";

export interface ITaskAssignee {
  team_member_id: any;
  id: string;
  project_member_id: string;
  name: string
}

export interface ITask {
  assignees?: ITaskAssignee[] | string[];
  assignees_ids?: any[];
  description?: string;
  done?: boolean;
  end?: string | Date;
  end_date?: string | Date;
  id?: string;
  name?: string;
  resize_valid?: boolean;
  start?: string | Date;
  start_date?: string | Date;
  _start?: Date;
  _end?: Date;
  color_code?: string;
  priority?: string;
  priority_id?: string;
  status?: string;
  status_id?: string;
  project_id?: string;
  reporter_id?: string;
  created_at?: string;
  updated_at?: string;
  show_handles?: boolean;
  min?: number;
  max?: number;
  total_hours?: number;
  total_minutes?: number;
  name_color?: string;
  sub_tasks_count?: number;
  is_sub_task?: boolean;
  parent_task_name?: string;
  parent_task_id?: string;
  show_sub_tasks?: boolean;
  sub_tasks?: ISubTask[];
  archived?: boolean;
  subscribers?: IUser[];
}
