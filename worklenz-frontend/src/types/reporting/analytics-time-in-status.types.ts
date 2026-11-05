export type TimeInStatusViewMode = 'aggregate' | 'per_issue';
export type TimeInStatusDateMode = 'entered' | 'exited' | 'overlapping';
export type TimeInStatusSort =
  | 'avg_desc'
  | 'avg_asc'
  | 'median_desc'
  | 'count_desc'
  | 'name_asc'
  | 'total_desc'
  | 'total_asc'
  | 'key_asc';

export interface TimeInStatusFilters {
  project_ids?: string[];
  team_ids?: string[];
  status_ids?: string[];
  assignee_ids?: string[];
  issue_types?: string[];
  label_ids?: string[];
  epic_ids?: string[];
  sprint_ids?: string[];
  date_from?: string | null;
  date_to?: string | null;
  date_mode?: TimeInStatusDateMode;
  exclude_weekends?: boolean;
  view_mode?: TimeInStatusViewMode;
  sort?: TimeInStatusSort;
  limit?: number;
  offset?: number;
}

export interface TimeInStatusStatusMeta {
  id: string;
  name: string;
  color: string | null;
  sort_order: number;
  category: 'todo' | 'doing' | 'done' | 'other';
}

export interface TimeInStatusAggregateRow {
  status_id: string;
  status_name: string;
  color: string | null;
  avg_days: number;
  median_days: number;
  min_days: number;
  max_days: number;
  count: number;
  pct_cycle_time: number;
  sort_order: number;
}

export interface TimeInStatusIssueSegment {
  status_id: string;
  status_name: string;
  color: string | null;
  days: number;
  is_live: boolean;
  is_outlier: boolean;
}

export interface TimeInStatusIssueRow {
  task_id: string;
  task_key: string;
  task_name: string;
  project_id: string;
  project_name: string;
  issue_type: string;
  assignee_name: string | null;
  total_days: number;
  is_outlier: boolean;
  segments: TimeInStatusIssueSegment[];
}

export interface TimeInStatusSeriesResponse {
  view_mode: TimeInStatusViewMode;
  statuses: TimeInStatusStatusMeta[];
  aggregate: TimeInStatusAggregateRow[];
  issues: TimeInStatusIssueRow[];
  summary: {
    issue_count: number;
    status_visit_count: number;
    avg_cycle_days: number | null;
    outlier_count: number;
    exclude_weekends: boolean;
    date_mode: TimeInStatusDateMode;
  };
  pagination: {
    total: number;
    limit: number;
    offset: number;
  };
  meta: {
    project_count: number;
    rollup_by_category?: boolean;
  };
  last_updated_at: string;
}

export interface TimeInStatusFilterOptions {
  statuses: Array<{ id: string; name: string; color: string | null }>;
  sprints: Array<{ id: string; name: string; project_id: string }>;
  labels: Array<{ id: string; name: string }>;
  epics: Array<{ id: string; name: string }>;
}
