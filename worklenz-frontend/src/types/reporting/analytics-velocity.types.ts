export type VelocityViewBy = 'project' | 'member' | 'team';
export type VelocityMetric = 'story_points' | 'issue_count';

export interface VelocitySeriesFilters {
  view_by: VelocityViewBy;
  project_ids?: string[];
  member_ids?: string[];
  team_ids?: string[];
  sprint_count?: number;
  date_from?: string | null;
  date_to?: string | null;
  metric?: VelocityMetric;
  avg_window?: number;
  trend?: boolean;
}

export interface VelocityStackPoint {
  id: string;
  name: string;
  committed: number;
  completed: number;
}

export interface VelocitySeriesPoint {
  sprint_id: string;
  sprint_name: string;
  project_id: string;
  team_id: string;
  completed_at: string | null;
  start_date: string | null;
  end_date: string | null;
  committed: number;
  completed: number;
  commitment_accuracy: number | null;
  stacks?: VelocityStackPoint[];
  overlays?: VelocityStackPoint[];
}

export interface VelocitySeriesResponse {
  series: VelocitySeriesPoint[];
  average_line: Array<{ sprint_id: string; value: number | null }>;
  trend_line: Array<{ sprint_id: string; value: number | null }> | null;
  kpis: {
    avg_velocity: number;
    last_sprint_velocity: number | null;
    commitment_accuracy_pct: number | null;
    completed_sprint_count: number;
  };
  meta: {
    min_sprints_met: boolean;
    view_by: VelocityViewBy;
    metric: VelocityMetric;
    avg_window: number;
  };
  last_updated_at: string;
}

export interface AnalyticsReportTemplate {
  id: string;
  team_id: string;
  owner_id: string;
  report_kind: string;
  name: string;
  is_workspace_shared: boolean;
  is_default: boolean;
  filters_json: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  owner_name?: string;
}
