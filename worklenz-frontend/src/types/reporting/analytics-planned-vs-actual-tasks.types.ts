export interface PlannedVsActualTasksFilters {
  project_ids?: string[];
  member_ids?: string[];
  team_ids?: string[];
  date_from?: string;
  date_to?: string;
}

export interface PlannedVsActualTasksRow {
  project_id: string;
  project_name: string;
  planned: number;
  completed: number;
  overdue: number;
  variance_days: number;
  updated_at: string | null;
}

export interface PlannedVsActualTasksKpis {
  planned: number;
  completed: number;
  completed_pct_of_plan: number;
  overdue: number;
  avg_variance_days: number;
}

export interface PlannedVsActualTasksSeriesResponse {
  projects: PlannedVsActualTasksRow[];
  kpis: PlannedVsActualTasksKpis;
  meta: {
    project_count: number;
  };
  last_updated_at: string;
}
