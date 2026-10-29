export interface TimeReportFilters {
  project_ids?: string[];
  member_ids?: string[];
  team_ids?: string[];
  date_from?: string | null;
  date_to?: string | null;
}

export interface TimeReportRow {
  team_member_id: string;
  member_name: string;
  avatar_url: string | null;
  color_code: string;
  project_id: string;
  project_name: string;
  project_color: string | null;
  logged_hours: number;
  estimated_hours: number;
  billable_hours: number;
  nonbillable_hours: number;
}

export interface TimeReportProjectSeries {
  project_id: string;
  project_name: string;
  logged_hours: number;
  estimated_hours: number;
  updated_at?: string | null;
}

export interface TimeReportKpis {
  logged_hours: number;
  estimated_hours: number;
  billable_hours: number;
  billable_pct: number;
  over_estimate_hours: number;
}

export interface TimeReportSeriesResponse {
  rows: TimeReportRow[];
  projects: TimeReportProjectSeries[];
  kpis: TimeReportKpis;
  meta: {
    row_count: number;
    date_from: string;
    date_to: string;
  };
  last_updated_at: string;
}
