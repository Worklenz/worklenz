import { IInsightTasks } from '../project/projectInsights.types';
import { ITask } from '../tasks/task.types';
import { ITeamMember } from './teamMember.types';

export interface ITeamMemberViewModel extends ITeamMember {
  id?: string;
  active?: boolean;
  name?: string;
  taskCount?: number;
  job_title?: string;
  team_access?: string;
  department_id?: string;
  department_name?: string;
  practice_id?: string;
  practice_name?: string;
  email?: string;
  task_count?: number;
  projects_count?: number;
  project_names?: string;
  project_name?: string;
  role_name?: string;
  // Numeric role rank from the server (Owner 1 → Admin 2 → Team Lead 3 → other 4).
  // Prefer this over deriving from role_name so custom admin roles sort correctly.
  role_level?: number;
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
  is_guest?: boolean;
  reports_to_member_id?: string;
  current_team_lead_name?: string;
  /** Present on project_manager nested in project GET (Phase 4). */
  finance_access?: boolean;
  /** Phase 5 — Owner/Admin toggle: may create projects from templates. */
  can_create_projects_from_templates?: boolean;
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
  data: ITeamMemberTreeMap[];
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
