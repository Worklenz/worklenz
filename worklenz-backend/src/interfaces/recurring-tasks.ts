export interface IRecurringSchedule {
  id: string;
  schedule_type: "daily" | "weekly" | "monthly" | "yearly" | "every_x_days" | "every_x_weeks" | "every_x_months";
  days_of_week: number[] | null;
  day_of_month: number | null;
  date_of_month: number | null;
  week_of_month: number | null;
  interval_days: number | null;
  interval_weeks: number | null;
  interval_months: number | null;
  last_created_task_end_date: Date | null;
  last_checked_at: Date | null;
  last_task_end_date: Date | null;
  created_at: Date;
}

interface ITaskTemplateAssignee {
  team_member_id: string;
  assigned_by: string
}

interface ITaskTemplateLabel {
  label_id: string;
}


export interface ITaskTemplate {
  task_id: string;
  schedule_id: string;
  created_at: Date;
  name: string;
  priority_id: string;
  project_id: string;
  reporter_id: string;
  status_id: string;
  assignees: ITaskTemplateAssignee[];
  labels: ITaskTemplateLabel[]
}