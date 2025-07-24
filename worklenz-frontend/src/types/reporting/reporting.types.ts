import { IProjectTask } from '../project/projectTasksViewModel.types';
import { IActivityLogsLabel } from '../tasks/task-activity-logs-get-request';
import { InlineMember } from '../teamMembers/inlineMember.types';
import { ITeamMemberViewModel } from '../teamMembers/teamMembersGetResponse.types';

export interface IChartObject {
  name: string;
  color: string;
  y: number;
}

export interface IRPTDuration {
  label: string;
  key: string;
  dates?: string;
}

export interface IReportingInfo {
  organization_name: string;
}

export interface IRPTTeamStatistics {
  count: number;
  projects: number;
  members: number;
}

export interface IRPTProjectStatistics {
  count: number;
  active: number;
  overdue: number;
}

export interface IRPTMemberStatistics {
  count: number;
  unassigned: number;
  overdue: number;
}

export interface ITimeLogBreakdownReq {
  id: string;
  date_range: string[];
  duration: string;
  time_zone: string;
}

export interface IRPTOverviewStatistics {
  teams?: IRPTTeamStatistics;
  projects?: IRPTProjectStatistics;
  members?: IRPTMemberStatistics;
}

export interface IRPTTeam {
  id: string;
  name: string;
  projects_count: number;
  members: InlineMember[];
  selected: boolean;
}

export interface IRPTOverviewTeamChartData {
  chart: IChartObject[];
  total: number;
  data: Array<{
    label: string;
    color: string;
    count: number;
  }>;
}

export interface IRPTOverviewTeamByStatus {
  all: number;
  in_progress: number;
  in_planning: number;
  completed: number;
  proposed: number;
  on_hold: number;
  blocked: number;
  cancelled: number;
  chart: { name: string; color: string; y: number }[];
}

export interface IRPTOverviewTeamByHealth {
  all: number;
  not_set: number;
  needs_attention: number;
  at_risk: number;
  good: number;
  chart: IChartObject[];
}

export interface IRPTOverviewTeamInfo {
  by_status?: IRPTOverviewTeamByStatus;
  by_category?: IRPTOverviewTeamChartData;
  by_health?: IRPTOverviewTeamByHealth;
}

export interface IRPTOverviewProject {
  id: string;
  name: string;
  client: string;
  status: {
    name: string;
    color_code: string;
    icon: string;
  };
}

export interface IRPTOverviewProjectExt extends IRPTOverviewProject {
  team_member_id: string;
}

export interface IRPTMemberResponse {
  total: number;
  members: IRPTMember[];
  team: {
    id: string;
    name: string;
  };
}

export interface IRPTMember {
  color_code: string;
  tasks_stat: any;

  avatar_url?: string;
  completed: number;
  /** Team member id */
  email: string;
  id: string;
  name: string;
  teams: string;
  projects: number;
  tasks: number;
  overdue: number;
  ongoing: number;
  todo: number;
  member_teams: any;
  billable_time?: number;
  non_billable_time?: number;
}

export interface ISingleMemberLogs {
  log_day: string;
  logs: ISingleMemberLog[];
}

export interface ISingleMemberLog {
  time_spent_string: string;
  project_name: string;
  task_name: string;
  task_key: string;
  task_id: string;
  project_id: string;
}

export interface ISingleMemberActivityLogs {
  log_day: string;
  logs: ISingleMemberActivityLog[];
}

export interface ISingleMemberActivityLog {
  project_id: string;
  task_id: string;
  project_name: string;
  task_name: string;
  task_key: string;
  attribute_type: string;
  previous: string;
  current: string;
  previous_status?: IActivityLogsLabel;
  next_status?: IActivityLogsLabel;
  previous_priority?: IActivityLogsLabel;
  next_priority?: IActivityLogsLabel;
  previous_phase?: IActivityLogsLabel;
  next_phase?: IActivityLogsLabel;
}

export interface IRPTOverviewProjectMember {
  /** Project member id */
  id: string;
  name: string;
  tasks_count: number;
  completed: number;
  incompleted: number;
  overdue: number;
  contribution: number;
  team_member_id: string;
  progress: number;
  time_logged: string;
}

export interface IRPTOverviewProjectTasksStats {
  completed: number;
  incompleted: number;
  overdue: number;
  total_allocated: number;
  total_logged: number;
}

export interface IRPTOverviewProjectTasksByStatus {
  all: number;
  todo: number;
  doing: number;
  done: number;
  chart: IChartObject[];
}

export interface IRPTOverviewProjectTasksByPriority {
  all: number;
  low: number;
  medium: number;
  high: number;
  chart: IChartObject[];
}

export interface IRPTOverviewProjectTasksByDue {
  all: number;
  completed: number;
  upcoming: number;
  overdue: number;
  no_due: number;
  chart: IChartObject[];
}

export interface IRPTOverviewProjectInfo {
  stats?: IRPTOverviewProjectTasksStats;
  by_status?: IRPTOverviewProjectTasksByStatus;
  by_priority?: IRPTOverviewProjectTasksByPriority;
  by_due?: IRPTOverviewProjectTasksByDue;
}

export interface IRPTOverviewMemberStats {
  teams: number;
  projects: number;
  completed: number;
  ongoing: number;
  overdue: number;
  total_tasks: number;
  total_logged: number;
  assigned: number;
}

export interface IRPTOverviewMemberChartData {
  chart: IChartObject[];
  total: number;
  data: Array<{
    label: string;
    color: string;
    count: number;
  }>;
}

export interface IRPTOverviewMemberInfo {
  stats?: IRPTOverviewMemberStats;
  by_status?: IRPTOverviewMemberChartData;
  by_priority?: IRPTOverviewMemberChartData;
  by_project?: IRPTOverviewMemberChartData;
}

export interface IRPTReportingMemberTask {
  id: string;
  name: string;
  project_id: string;
  project_name: string;
  priority_name: string;
  priority_color: string;
  project_color: string;
  parent_task_id?: string;
  status_name: string;
  status_color: string;
  end_date?: string;
  completed_date?: string;
  days_overdue?: number;
  estimated_string?: string;
  time_spent_string?: string;
  overlogged_time?: string;
  is_sub_task: boolean;
}

export interface IRPTTasksDrawerData {
  project: IRPTOverviewProject;
  member: IRPTMember;
}

export interface IRPTTaskDrawerData {
  taskId: string;
  projectId: string;
}

export interface IRPTMemberDrawerData {
  project: IRPTOverviewProject | null;
  member: IRPTMember | null;
}

export interface IRPTLastActivity {
  assigned_user?: null;
  attribute_type?: 'name';
  current?: string;
  done_by?: {
    name?: string;
    avatar_url?: string;
    color_code?: string;
  };
  avatar_url?: string;
  color_code?: string;
  name?: string;
  log_text?: string;
  log_type?: string;
  previous?: string;
  last_activity_string?: string;
}

export interface IRPTProject extends IRPTOverviewProject {
  last_activity: IRPTLastActivity;
  color_code: string;
  category_id: string | null;
  category_name: string;
  category_color: string;
  team_id: string;
  team_name: string;
  team_color: string;
  status_id: string;
  status_name: string;
  status_color: string;
  status_icon: string;
  start_date: string;
  end_date: string;
  estimated_time: number;
  actual_time: number;
  days_left: number | null;
  is_overdue: boolean;
  is_today: boolean;
  tasks_stat: {
    total: number;
    todo: number;
    doing: number;
    done: number;
  };
  comment?: string;
  project_health: string;
  health_color: string;
  health_name: string;
  estimated_time_string?: string;
  actual_time_string?: string;
  project_manager: ITeamMemberViewModel;
}

export interface IDurationChangedEmitter {
  selectedDuration: IRPTDuration | null;
  dateRange: string[];
}

export interface IRPTSingleMemberDrawerData {
  member: IRPTMember | null;
}

export interface IProjectLogs {
  project_name: string;
  task_key: string;
  task_name: string;
  time_spent_string: string;
  user_name: string;
  avatar_url: string;
  created_at: string;
}

export interface IProjectLogsBreakdown {
  log_day: string;
  logs: IProjectLogs[];
}

export interface IRPTProjectsViewModel {
  total?: number;
  projects?: IRPTProject[];
}
export interface IRPTMembersViewModel {
  total?: number;
  members?: IRPTMember[];
}

export interface IRPTMemberProject {
  completed?: number;
  contribution?: number;
  incompleted?: number;
  name: string;
  overdue?: number;
  project_task_count: number;
  task_count: number;
  team: string;
  team_member_id: string;
  time_logged: string;
  id: string;
}

export interface IRPTTimeProject {
  id: string;
  name: string;
  color_code: string;
  value?: number;
  estimated_value?: number;
  end_date?: string;
  logged_time?: string;
}

export interface IRPTTimeMember {
  name: string;
  value?: number;
  color_code: string;
  logged_time?: string;
  utilized_hours?: string;
  utilization_percent?: string;
  over_under_utilized_hours?: string;
  utilization_state?: string;
}
export interface IRPTTimeTotals {
  total_estimated_hours?: string;
  total_time_logs?: string;
  total_utilization?: string;
}
export interface IRPTTimeMemberViewModel {
  filteredRows?: IRPTTimeMember[];
  totals?: IRPTTimeTotals;
}

export interface IMemberTaskStatGroupResonse {
  team_member_name: string;
  groups: IMemberTaskStatGroup[];
}

export interface IMemberProjectsResonse {
  team_member_name: string;
  projects: IRPTProject[];
}

export interface IMemberTaskStatGroup {
  name: string;
  color_code: string;
  tasks: IProjectTask[];
}

export interface IGetProjectsRequestBody {
  index: number;
  size: number;
  field: string;
  order: string;
  search: string | null;
  filter: string;
  statuses: string[];
  healths: string[];
  categories: string[];
  project_managers: string[];
  archived: boolean;
}
