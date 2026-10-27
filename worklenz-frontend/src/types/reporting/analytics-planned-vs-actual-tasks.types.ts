export interface PlannedVsActualTasksFilters {
  project_ids?: string[];
  member_ids?: string[];
  team_ids?: string[];
}

export interface PlannedVsActualTasksRow {
  project_id: string;
  project_name: string;
  planned: number;
  completed: number;
  overdue: number;
  variance_days: number;
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
