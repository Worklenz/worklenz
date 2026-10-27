export type CfdGroupBy = 'all' | 'epic' | 'label' | 'assignee';
export type CfdSmoothing = 'raw' | 'rolling_7';
export type CfdDatePreset =
  | 'last_7_days'
  | 'last_14_days'
  | 'last_30_days'
  | 'last_60_days'
  | 'last_90_days'
  | 'custom';

export interface CfdSeriesFilters {
  project_ids?: string[];
  team_ids?: string[];
  status_ids?: string[];
  date_from?: string | null;
  date_to?: string | null;
  group_by?: CfdGroupBy;
  smoothing?: CfdSmoothing;
  /** status_id → WIP alert threshold */
  wip_thresholds?: Record<string, number>;
  sprint_overlay?: boolean;
}

export interface CfdStatusMeta {
  id: string;
  name: string;
  color: string | null;
  category: 'todo' | 'doing' | 'done' | 'other';
  sort_order: number;
  is_doing: boolean;
  is_done: boolean;
  is_todo: boolean;
}

export interface CfdSeriesRow {
  status_id: string;
  group_id: string | null;
  group_name: string | null;
  values: number[];
}

export interface CfdSeriesResponse {
  dates: string[];
  statuses: CfdStatusMeta[];
  series: CfdSeriesRow[];
  sprints: Array<{
    id: string;
    name: string;
    project_id: string;
    start_date: string | null;
    end_date: string | null;
  }> | null;
  indicators: {
    current_wip: number;
    avg_throughput_per_day: number;
    avg_cycle_days: number | null;
    avg_lead_days: number | null;
  };
  wip_breaches: Array<{
    status_id: string;
    date: string;
    count: number;
    threshold: number;
  }>;
  meta: {
    group_by: CfdGroupBy;
    smoothing: CfdSmoothing;
    project_count: number;
  };
  last_updated_at: string;
}
