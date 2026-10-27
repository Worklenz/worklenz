export interface ITaskLogDailyBreakdown {
  date: string;
  date_formatted: string;
  time_spent: number;
  time_spent_text: string;
  start_time: string;
  end_time: string;
  time_range_text: string;
}

export interface ITaskLogViewModel {
  id?: string;
  task_id?: string;
  project_id?: string;
  user_name?: string;
  hours?: string;
  minutes?: string;
  seconds?: number;
  description?: string;
  created_at?: string;
  updated_at?: string;
  avatar_url?: string;
  logged_by_timer?: boolean;
  time_spent_text?: string;
  start_time?: string;
  end_time?: string;
  time_spent?: number;
  avatar_color?: string;
  user_id?: string;
  is_overnight_split?: boolean;
  part_log_ids?: string[];
  daily_breakdown?: ITaskLogDailyBreakdown[];
}
