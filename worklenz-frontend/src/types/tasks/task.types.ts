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
  id: string;
  name: string;
  description: string;
  status_id: string;
  priority: string;
  start_date: string;
  end_date: string;
  total_hours: number;
  total_minutes: number;
  billable: boolean;
  phase_id: string;
  parent_task_id: string | null;
  project_id: string;
  team_id: string;
  task_key: string;
  labels: string[];
  assignees: string[];
  names: string[];
  sub_tasks_count: number;
  manual_progress: boolean;
  progress_value: number | null;
  weight: number | null;
  created_at?: string;
  updated_at?: string;
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
  created_from_now?: string;
  updated_from_now?: string;
  reporter?: string;
  is_sub_task?: boolean;
  status_color?: string;
  status_color_dark?: string;
  attachments_count?: number;
  complete_ratio?: number;
  assignee_names?: InlineMember[];
  task_labels?: ITaskLabel[];
  timer_start_time?: number;
  recurring?: boolean;
  task_level?: number;
  schedule_id?: string | null;
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
