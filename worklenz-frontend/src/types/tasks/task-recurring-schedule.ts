export enum ITaskRecurring {
  Daily = 'daily',
  Weekly = 'weekly',
  Monthly = 'monthly',
  EveryXDays = 'every_x_days',
  EveryXWeeks = 'every_x_weeks',
  EveryXMonths = 'every_x_months',
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

export interface IRepeatOption {
  value?: ITaskRecurring;
  label?: string;
}
