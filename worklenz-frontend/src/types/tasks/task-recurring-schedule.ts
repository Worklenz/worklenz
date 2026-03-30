export enum ITaskRecurring {
  Daily = 'daily',
  Weekly = 'weekly',
  Monthly = 'monthly',
  Yearly = 'yearly',
  EveryXDays = 'every_x_days',
  EveryXWeeks = 'every_x_weeks',
  EveryXMonths = 'every_x_months',
}

export enum IRecurringMode {
  CreateTask = 'create_task',
  ChangeStatus = 'change_status',
}

export interface ITaskRecurringSchedule {
  created_at?: string;
  day_of_month?: number | null;
  date_of_month?: number | null;
  days_of_week?: number[] | null;
  id?: string; // UUID v4
  interval_days?: number | null;
  interval_months?: number | null;
  interval_weeks?: number | null;
  schedule_type?: ITaskRecurring;
  week_of_month?: number | null;
  start_date?: string | null;
  end_date?: string | null;
  max_occurrences?: number | null;
  occurrence_count?: number | null;
  is_active?: boolean;
  recurring_mode?: IRecurringMode;
  target_status_id?: string | null;
}

export interface IRepeatOption {
  value?: ITaskRecurring;
  label?: string;
}

export interface ITaskRecurringScheduleData {
  task_id?: string;
  id?: string;
  schedule_type?: string;
}
