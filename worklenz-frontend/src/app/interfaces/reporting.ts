export interface IActualVsEstimateGetRequest {
  projects: string[];
  estimated: string[];
  logged: string[];
  estimated_string: string[];
  logged_string: string[];
}

export interface IReportingOverview {
  total_teams?: string,
  total_projects?: string,
  active_projects?: string,
  overdue_projects?: string
  total_members?: string;
  overdue_task_members?: string;
  unassigned_members?: string;
}

export interface IReportingEstimatedVsLogged {
  total_logged?: string;
  total_estimated?: string;
}

export interface IReportingTeam {
  id: string;
  name: string;
  members: null;
  is_completed: boolean;
  completed_date: string;
  projects_count: number;
  names: any;
  projects: IReportingProject[];
}

export interface IReportingProject {
  name: string;
  is_overdue: boolean;
  status: string;
  status_icon: string;
  status_color: string;
  due_date: string;
  overdue: number;
  total_allocation: string;
  overlogged: string;
  members: null;
  project_member_names: any
}

export interface IReportingProjectStats {
  active_projects?: number;
  all_tasks_count?: number;
  completed_tasks_count?: number;
  overdue_projects?: number;
  total_estimated?: number;
  total_logged?: number;
  progress?: number;
  overlogged_hours?: string;
  logged_hours_string?: string;
  total_estimated_hours_string?: string;
  total_logged_hours_string?: string;
}

export interface IReportingActiveProject {
  id?: string,
  name: string,
  updated_at: string,
  updated_at_string: string,
  status: string,
  end_date: string
}

export interface IReportingOverdueProject {
  id?: string,
  name: string,
  updated_at: string,
  updated_at_string: string,
  status: string,
  end_date: string
  overlogged_hours: string;
}

export interface IReportingProjectsCustom {
  all_tasks_count: number;
  client_name: string;
  color_code: string;
  completed_percentage: number;
  completed_tasks_count: number;
  doing_percentage: number;
  end_date: string;
  id: string;
  is_doing_tasks_count: number;
  is_todo_tasks_count: number;
  members_count: number;
  name: string;
  project_owner: string;
  start_date: string;
  status: string;
  status_color: string;
  status_icon: string;
  team_name: string;
  todo_percentage: number;
  updated_at: string;
  updated_at_string?: string;
  names: any;
}

export interface IReportingProjectData {
  name?: string;
  team_name?: string;
}

export interface IReportingOverdueMembers {
  id: string;
  name: string;
  overdue_tasks: number;
  overdue_time: string;
  projects: number;
}

export interface IReportingUnassignedMembers {
  id: string;
  name: string;
}

export interface IReportingMemberStats {
  name?: string,
  total_teams?: number,
  project_members?: number,
  total_estimated?: number,
  total_logged?: number,
  total_tasks?: number,
  total_tasks_completed?: number,
  overdue_tasks?: number,
  progress?: string,
  log_progress?: string,
  total_estimated_hours_string?: string,
  total_logged_hours_string?: string,
  overlogged_hours?: string,
}

export interface IReportingMemberRecentLogged {
  id?: string;
  name?: string;
  project_name?: string;
  project_id?: string;
  team_name?: string;
  status?: string;
  status_color?: string;
  end_date?: string;
  logged_time?: string;
  logged_timestamp?: string;
}

export interface IReportingMemberCurrentlyDoing {
  id?: string;
  task?: string;
  project?: string;
  project_id?: string;
  team?: string;
  status?: string;
  status_color?: string;
  end_date?: string;
  last_updated?: string;
}

export interface IReportingMemberOverdueTask {
  id?: string;
  task?: string;
  project?: string;
  project_id?: string;
  team?: string;
  status?: string;
  status_color?: string;
  end_date?: string;
  overdue?: string;
}

export interface IReportingMemberProjectTask {
  name?: string;
  is_overdue?: boolean;
  status?: string;
  status_color?: string;
  due_date?: string;
  overdue?: number;
  completed_date?: string;
  toal_estimated?: string;
  overlogged_time?: string;
  total_logged?: string;
}

export interface IReportingMemberProjects {
  id: string;
  name?: string;
  team?: string;
  contribution?: number;
  total_task_count?: number;
  assigned_task_count?: number;
  completed_tasks?: number;
  incompleted_tasks?: number;
  overdue_tasks?: number;
  tasks?: IReportingMemberProjectTask[]
}

export interface IReportingMemberProjectTaskLate {
  name?: string;
  project?: string;
  status?: string;
  status_color?: string;
  due_date?: string;
  completed_at?: string;
  assignees?: any;
  overlogged_time?: string;
}

export interface ITeamMemberInsightsProjects {
  id?: string;
  name?: string;
  selected?: boolean;
}
