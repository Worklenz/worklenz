export interface PlannedVsActualMilestonesFilters {
  project_ids?: string[];
  member_ids?: string[];
  team_ids?: string[];
}

export interface PlannedVsActualMilestonesRow {
  milestone_id: string;
  milestone_name: string;
  project_id: string;
  project_name: string;
  planned_date: string;
  actual_date: string | null;
  variance_days: number;
  status: string;
}

export interface PlannedVsActualMilestonesKpis {
  milestones: number;
  late: number;
  on_time: number;
  avg_slip_days: number;
}

export interface PlannedVsActualMilestonesSeriesResponse {
  milestones: PlannedVsActualMilestonesRow[];
  kpis: PlannedVsActualMilestonesKpis;
  meta: {
    milestone_count: number;
  };
  last_updated_at: string;
}
