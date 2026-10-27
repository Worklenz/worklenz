export type ProjectHealthTone = 'on_track' | 'at_risk' | 'off_track' | 'not_set';

export interface ProjectHealthFilters {
  project_ids?: string[];
  health_ids?: string[];
  member_ids?: string[];
  team_ids?: string[];
}

export interface ProjectHealthRow {
  project_id: string;
  project_name: string;
  health_id: string | null;
  health_name: string;
  health_color: string;
  health_tone: ProjectHealthTone;
  progress_pct: number;
  budget_used_pct: number;
  due_date: string | null;
  open_tasks: number;
  overdue_tasks: number;
  budget: number;
  lead_name: string | null;
}

export interface ProjectHealthKpis {
  on_track: number;
  at_risk: number;
  off_track: number;
  not_set: number;
  overdue_tasks: number;
}

export interface ProjectHealthSeriesResponse {
  projects: ProjectHealthRow[];
  kpis: ProjectHealthKpis;
  meta: {
    project_count: number;
  };
  last_updated_at: string;
}
