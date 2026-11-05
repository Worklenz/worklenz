export interface UtilizationFilters {
  project_ids?: string[];
  member_ids?: string[];
  team_ids?: string[];
  date_from?: string | null;
  date_to?: string | null;
}

export type UtilizationStatus = 'over' | 'optimal' | 'under';

export interface UtilizationMemberRow {
  team_member_id: string;
  member_name: string;
  avatar_url: string | null;
  color_code: string;
  role_name: string | null;
  /** Working hours for the selected period. */
  capacity_hours: number;
  /** Logged time for the selected period. */
  logged_hours: number;
  billable_hours: number;
  utilization_pct: number;
  status: UtilizationStatus;
}

export interface UtilizationKpis {
  avg_utilization_pct: number;
  team_size: number;
  overutilized_count: number;
  underutilized_count: number;
  total_capacity_hours: number;
  total_logged_hours: number;
}

export interface UtilizationSeriesResponse {
  members: UtilizationMemberRow[];
  kpis: UtilizationKpis;
  meta: {
    member_count: number;
    working_days: number;
    hours_per_day: number;
    date_from: string;
    date_to: string;
  };
  last_updated_at: string;
}
