import {IProjectMember} from "@interfaces/project-member";
import {ITask} from "@interfaces/task";
import {ITaskPriority} from "@interfaces/task-priority";
import {IProject} from "@interfaces/project";
import {ITaskStatus} from "@interfaces/task-status";
import {ITeamMember} from "@interfaces/team-member";
import {InlineMember} from "./api-models/inline-member";
import {ITaskLabel} from "@interfaces/task-label";
import {ITaskPhase} from "@interfaces/api-models/task-phase";

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
  attachments_count?: number;
  complete_ratio?: number;
  names?: InlineMember[];
  labels?: ITaskLabel[];
  timer_start_time?: number;
  phase_id?: string;
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
