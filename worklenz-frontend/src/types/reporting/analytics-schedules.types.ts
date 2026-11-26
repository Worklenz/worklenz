import { ITaskRecurring } from '@/types/tasks/task-recurring-schedule';

export type AnalyticsScheduleFormat = 'PDF' | 'CSV' | 'Excel';

export interface AnalyticsReportSchedule {
  id: string;
  team_id: string;
  owner_id: string;
  report_kind: string;
  report_name: string;
  template_id: string | null;
  schedule_type: ITaskRecurring | string;
  days_of_week: number[] | null;
  day_of_month: number | null;
  date_of_month: number | null;
  week_of_month: number | null;
  interval_days: number | null;
  interval_weeks: number | null;
  interval_months: number | null;
  send_time: string;
  timezone: string;
  recipients: string[];
  formats: AnalyticsScheduleFormat[];
  message: string | null;
  filters_json: Record<string, unknown>;
  paused: boolean;
  last_sent_at: string | null;
  next_send_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AnalyticsScheduleUpsertPayload {
  report_kind: string;
  report_name: string;
  template_id?: string | null;
  schedule_type: ITaskRecurring | string;
  days_of_week?: number[] | null;
  day_of_month?: number | null;
  date_of_month?: number | null;
  week_of_month?: number | null;
  interval_days?: number | null;
  interval_weeks?: number | null;
  interval_months?: number | null;
  send_time: string;
  timezone?: string;
  recipients: string[];
  formats: AnalyticsScheduleFormat[];
  message?: string | null;
  filters?: Record<string, unknown>;
  paused?: boolean;
}
