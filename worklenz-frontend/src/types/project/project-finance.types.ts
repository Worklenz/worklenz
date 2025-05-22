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
  id: string;
  team_member_id: string;
  job_title_id: string;
  rate: number | null;
  user: IProjectFinanceUser;
  job_title: IProjectFinanceJobTitle;
}

export interface IProjectFinanceTask {
  id: string;
  name: string;
  status_id: string;
  priority_id: string;
  phase_id: string;
  estimated_hours: number;
  actual_hours: number;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  billable: boolean;
  assignees: any[]; // Using any[] since we don't have the assignee structure yet
  members: IProjectFinanceMember[];
}

export interface IProjectFinanceGroup {
  group_id: string;
  group_name: string;
  color_code: string;
  color_code_dark: string;
  tasks: IProjectFinanceTask[];
}

export type ProjectFinanceGroupType = 'status' | 'priority' | 'phases';
