export type ReportSprintStatus = 'active' | 'completed';

export interface IReportSprintOption {
  id: string;
  name: string;
  sprint_status: ReportSprintStatus;
}

export interface ISprintReportSummary {
  id: string;
  name: string;
  sprint_status: ReportSprintStatus;
  sprint_goal: string | null;
  start_date: string | null;
  end_date: string | null;
  completed_at: string | null;
  issue_count: number;
  done_issue_count: number;
  total_points: number;
  done_points: number;
  committed_points: number;
  /** True when the sprint started before scope snapshots existed. */
  is_committed_estimated: boolean;
  scope_added_count: number;
  scope_added_points: number;
  carried_over_points: number;
  open_bug_count: number;
  open_critical_bug_count: number;
  blocked_count: number;
}

export interface ISprintBurndownPoint {
  /** YYYY-MM-DD */
  date: string;
  /** Null for days that have not happened yet. */
  remaining: number | null;
  scope_added: number;
  ideal: number;
}

export interface ISprintVelocityPoint {
  sprint_id: string;
  name: string;
  sprint_status: ReportSprintStatus;
  committed_points: number | null;
  completed_points: number;
}

export interface ISprintReport {
  sprints: IReportSprintOption[];
  sprint: ISprintReportSummary | null;
  burndown: ISprintBurndownPoint[];
  velocity: ISprintVelocityPoint[];
  median_cycle_days: number | null;
  previous_median_cycle_days: number | null;
}

export type FlowStatusCategory = 'todo' | 'doing' | 'done';

export interface IFlowStatus {
  id: string;
  name: string;
  color_code: string;
  color_code_dark: string | null;
  category: FlowStatusCategory;
  issue_count: number;
}

export interface IFlowReport {
  sprint: { id: string; name: string } | null;
  statuses: IFlowStatus[];
  blocked_count: number;
  throughput_days: number;
  throughput_count: number;
  previous_throughput_count: number;
}

export interface ICycleTimeTrendPoint {
  /** YYYY-MM-DD (Monday of the week). */
  week_start: string;
  median_days: number;
  issue_count: number;
}

export type CustomReportSource = 'items' | 'sprints' | 'releases' | 'time';
export type CustomReportMetric = 'count' | 'points' | 'cycle' | 'blocked' | 'time' | 'committed';
export type CustomReportGroup =
  | 'assignee'
  | 'status'
  | 'epic'
  | 'priority'
  | 'type'
  | 'sprint'
  | 'release';
export type CustomReportFilter = 'all' | 'active' | 'bugs' | 'blocked';
export type CustomReportVisualization = 'bar' | 'line' | 'donut' | 'table' | 'kpi';
export type CustomReportVisibility = 'project' | 'private';
export type CustomReportUnit = 'count' | 'points' | 'days' | 'hours';

export interface ICustomReportDefinition {
  source: CustomReportSource;
  metric: CustomReportMetric;
  group_by: CustomReportGroup;
  filter: CustomReportFilter;
}

export interface ICustomReportInput extends ICustomReportDefinition {
  name: string;
  visualization: CustomReportVisualization;
  visibility: CustomReportVisibility;
}

export interface ICustomReport extends ICustomReportInput {
  id: string;
  project_id: string;
  created_by: string | null;
  created_by_name: string | null;
  created_at: string;
}

export interface ICustomReportRow {
  /** Null for the "none" bucket (e.g. unassigned, no epic). */
  key: string | null;
  label: string | null;
  color: string | null;
  value: number;
}

export interface ICustomReportData {
  rows: ICustomReportRow[];
  /** Null when there is no data (cycle time with no completed issues). */
  total: number | null;
  unit: CustomReportUnit;
}

export interface ICycleTimeReport {
  median_cycle_days: number | null;
  p85_cycle_days: number | null;
  previous_median_cycle_days: number | null;
  completed_count: number;
  trend: ICycleTimeTrendPoint[];
  oldest_active_item: { id: string; task_key: string; name: string; age_days: number } | null;
  reopened_count: number;
}
