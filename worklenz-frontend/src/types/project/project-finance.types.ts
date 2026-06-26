export interface IProjectFinanceUser {
  id: string;
  name: string;
  avatar_url: string | null;
}

export interface IProjectFinanceJobTitle {
  id: string;
  name: string;
}

export interface IProjectFinanceMember {
  team_member_id: string;
  project_member_id: string;
  name: string;
  email_notifications_enabled: boolean;
  avatar_url: string | null;
  user_id: string;
  email: string;
  socket_id: string | null;
  team_id: string;
  color_code: string;
  project_rate_card_role_id: string | null;
  rate: number;
  man_day_rate: number;
  job_title_id: string | null;
  job_title_name: string | null;
}

export interface IProjectFinanceTask {
  id: string;
  name: string;
  estimated_seconds: number;
  total_minutes: number; // Total estimated time in minutes
  estimated_hours: string; // Formatted time string like "4h 30m 12s"

  total_time_logged_seconds: number;
  total_time_logged: string; // Formatted time string like "4h 30m 12s"
  estimated_cost: number;
  actual_cost_from_logs: number;
  members: IProjectFinanceMember[];
  billable: boolean;
  fixed_cost: number;
  variance: number; // Cost variance (currency)
  effort_variance_man_days?: number | null; // Effort variance in man days (only for man_days projects)
  actual_man_days?: number | null; // Actual man days spent (only for man_days projects)
  total_budget: number;
  total_actual: number;
  sub_tasks_count: number; // Number of subtasks
  sub_tasks?: IProjectFinanceTask[]; // Loaded subtasks
  show_sub_tasks?: boolean; // Whether subtasks are expanded
  is_sub_task?: boolean; // Whether this is a subtask
  parent_task_id?: string; // Parent task ID for subtasks
}

export interface IProjectFinanceGroup {
  group_id: string;
  group_name: string;
  color_code: string;
  color_code_dark: string;
  tasks: IProjectFinanceTask[];
}

export interface IProjectRateCard {
  id: string;
  project_id: string;
  job_title_id: string;
  rate: string;
  man_day_rate: string;
  job_title_name: string;
}

export interface IProjectFinanceProject {
  id: string;
  name: string;
  currency: string;
  calculation_method: 'hourly' | 'man_days';
  hours_per_day: number;
}

export interface IProjectFinanceResponse {
  groups: IProjectFinanceGroup[];
  project_rate_cards: IProjectRateCard[];
  project: IProjectFinanceProject;
}

export interface ITaskBreakdownMember {
  team_member_id: string;
  name: string;
  avatar_url: string;
  hourly_rate: number;
  estimated_hours: number;
  logged_hours: number;
  estimated_cost: number;
  actual_cost: number;
}

export interface ITaskBreakdownJobRole {
  jobRole: string;
  estimated_hours: number;
  logged_hours: number;
  estimated_cost: number;
  actual_cost: number;
  members: ITaskBreakdownMember[];
}

export interface ITaskBreakdownTask {
  id: string;
  name: string;
  project_id: string;
  billable: boolean;
  estimated_hours: number;
  logged_hours: number;
  estimated_labor_cost: number;
  actual_labor_cost: number;
  fixed_cost: number;
  total_estimated_cost: number;
  total_actual_cost: number;
}

export interface ITaskBreakdownResponse {
  task: ITaskBreakdownTask;
  grouped_members: ITaskBreakdownJobRole[];
  members: Array<ITaskBreakdownMember & { job_title_name: string }>;
}

export type ProjectFinanceGroupType = 'status' | 'priority' | 'phases';
