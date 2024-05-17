import {IGanttDateRange, IGanttMonthRange} from "@interfaces/gantt-chart";
import {ITeamMember} from "@interfaces/team-member";

export interface IResourceTeamMemberViewModel extends ITeamMember {
  id?: string;
  name?: string;
  taskCount?: number;
  job_title?: string;
  email?: string;
  invitee_email?: string;
  projects_count?: number;
  role_name?: string;
  tasks?: ISchedule[];
  is_admin?: boolean;
  show_handles?: boolean;
  is_online?: boolean;
  avatar_url?: string;
  selected?: boolean;
  color_code?: string;
}

export interface IScheduledTask {
  project_name: string;
  id?: string;
  name?: string;
  project_id?: string;
}


export interface ISchedule {
  color_code?: string;
  scheduled_tasks: IScheduledTask[];
  min?: number;
  date_series?: string;
  project_id?: string;
  sum?: number;
}

export interface IResource {
  id?: string;
  name?: string;
  invitee_email?: string;
  date_range?: number;
  min?: string;
  collapsed?: boolean;
  project_members?: IResourceTeamMemberViewModel[];
  color_code?: string;
  schedule?: ISchedule[];
  unassigned_tasks: ISchedule[];
}

export interface IProjectWiseResourcesViewModel {
  dates: IGanttDateRange[],
  months: IGanttMonthRange[],
  projects: IResource[]
}
