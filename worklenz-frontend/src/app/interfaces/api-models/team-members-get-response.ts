import {ITeamMember} from '../team-member';
import {ITask} from '@interfaces/task';
import {IInsightTasks} from "@interfaces/api-models/project-insights";
import {InlineMember} from "@interfaces/api-models/inline-member";

export interface ITeamMemberViewModel extends ITeamMember {
  id?: string;
  active?: boolean;
  name?: string;
  taskCount?: number;
  job_title?: string;
  email?: string;
  task_count?: number;
  projects_count?: number;
  role_name?: string;
  tasks?: ITask[];
  is_admin?: boolean;
  show_handles?: boolean;
  is_online?: boolean;
  avatar_url?: string;
  selected?: boolean;
  color_code?: string;
  usage?: number;
  projects?: any;
  total_logged_time?: string;
  member_teams?: string[];
  is_pending?: boolean;
}

export interface ITeamMemberOverviewGetResponse extends ITeamMember {
  task_count?: number;
  done_task_count?: number;
  pending_task_count?: number;
  overdue_task_count?: number;
  progress?: number;
  contribution?: number;
  job_title?: string;
  id: string;
  name?: string;
  tasks?: IInsightTasks[];
}

export interface ITeamMemberOverviewByProjectGetResponse {
  name?: string;
  assigned_task_count?: number;
  progress?: number;
  done_task_count?: number;
  pending_task_count?: number;
  id?: string;
}

export interface ITeamMemberOverviewChartGetResponse {
  pending_count?: number;
  done_count?: number;
}

export interface ITeamMemberFilterResponse {
  text?: string;
  value?: string;
}

export interface ITeamMemberTreeMapResponse {
  total: number;
  data: ITeamMemberTreeMap[]
}

export interface ITeamMemberTreeMap {
  value?: number;
  name?: string;
  parent?: number;
  id?: string;
  color?: string;
}

export interface ITasksByTeamMembers {
  name?: string;
  task_count?: string;
}
