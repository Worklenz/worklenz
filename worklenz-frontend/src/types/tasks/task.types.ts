import { IUser } from '../auth/login.types';
import { ITaskLabel } from '../label.type';
import { IProject } from '../project/project.types';
import { IProjectMember } from '../project/projectMember.types';
import { InlineMember } from '../teamMembers/inlineMember.types';
import { ITeamMember } from '../teamMembers/teamMember.types';
import { ISubTask } from './subTask.types';
import { ITaskPhase } from './taskPhase.types';
import { ITaskPriority } from './taskPriority.types';
import { ITaskStatus } from './taskStatus.types';

export interface ITaskAssignee {
  team_member_id: any;
  id: string;
  project_member_id: string;
  name: string;
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

export interface IProjectMemberViewModel extends IProjectMember {
  name?: string;
  team_member_id?: string;
  job_title?: string;
  email?: string;
  avatar_url?: string;
  color_code?: string;
}

export interface ITaskViewModel extends ITask {
  task_key?: string;
  created_from_now?: string;
  updated_from_now?: string;
  reporter?: string;
  start_date?: string;
  end_date?: string;
  sub_tasks_count?: number;
  is_sub_task?: boolean;
  status_color?: string;
  status_color_dark?: string;
  attachments_count?: number;
  complete_ratio?: number;
  names?: InlineMember[];
  labels?: ITaskLabel[];
  timer_start_time?: number;
  phase_id?: string;
  billable?: boolean;
  recurring?: boolean;
}

export interface ITaskTeamMember extends ITeamMember {
  name?: string;
  color_code?: string;
  avatar_url?: string;
  email?: string;
}

export interface ITaskFormViewModel {
  task?: ITaskViewModel;
  priorities?: ITaskPriority[];
  projects?: IProject[];
  statuses?: ITaskStatus[];
  phases?: ITaskPhase[];
  team_members?: ITaskTeamMember[];
}

export interface IHomeTaskViewModel extends ITask {
  task?: ITaskViewModel;
  team_member_id?: string;
}
