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
  socket_id: string;
  team_id: string;
}

export interface IProjectFinanceTask {
  id: string;
  name: string;
  estimated_hours: number;
  total_time_logged: number;
  estimated_cost: number;
  members: IProjectFinanceMember[];
  billable: boolean;
  fixed_cost?: number;
  variance?: number;
  total_budget?: number;
  total_actual?: number;
  cost?: number;
}

export interface IProjectFinanceGroup {
  group_id: string;
  group_name: string;
  color_code: string;
  color_code_dark: string;
  tasks: IProjectFinanceTask[];
}

export type ProjectFinanceGroupType = 'status' | 'priority' | 'phases';
