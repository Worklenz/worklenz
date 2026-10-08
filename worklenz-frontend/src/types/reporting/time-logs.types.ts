/** A member's standing in the team at the time the report is viewed. */
export type TimeLogMemberStatus = 'active' | 'deactivated' | 'removed';

export type TimeLogSortField =
  | 'date'
  | 'task_key'
  | 'task'
  | 'member'
  | 'client'
  | 'project'
  | 'duration';
export type TimeLogSortOrder = 'asc' | 'desc';

/** The table's two flavours: entries as logged, or one row per task with its time summed. */
export type TimeLogsTableView = 'flat' | 'task';
/** What the report is grouped by; 'none' shows the table itself. */
export type TimeLogsGroupBy = 'none' | 'member' | 'project' | 'client';
export type TimeLogsGroupDimension = Exclude<TimeLogsGroupBy, 'none'>;

export type TimeLogsExportFormat = 'xlsx' | 'csv';
/** "filtered" = what is on screen; "all" = the date range only, every other filter dropped. */
export type TimeLogsExportMode = 'filtered' | 'all';

export interface ITimeLogBillableFilter {
  billable: boolean;
  nonBillable: boolean;
}

/** Filters accepted by the list and export endpoints (`YYYY-MM-DD`, inclusive). */
export interface ITimeLogsFilterRequest {
  date_from?: string;
  date_to?: string;
  user_ids?: string[];
  project_ids?: string[];
  /** May include the `__no_practice__` sentinel. */
  practice_ids?: string[];
  /** Clients of the entries' projects; may include the `__no_client__` sentinel. */
  client_ids?: string[];
  billable?: ITimeLogBillableFilter;
  search?: string;
}

export interface ITimeLogsListRequest extends ITimeLogsFilterRequest {
  page: number;
  page_size: number;
  sort_field?: TimeLogSortField;
  sort_order?: TimeLogSortOrder;
  /** 'task' lists tasks (entries summed) instead of entries. Defaults to 'flat'. */
  view?: TimeLogsTableView;
}

export interface ITimeLogGroupsRequest extends ITimeLogsFilterRequest {
  group_by: TimeLogsGroupDimension;
  page: number;
  page_size: number;
}

export interface ITimeLogEntry {
  id: string;
  /** Calendar day in the viewer's timezone, `YYYY-MM-DD`. */
  log_day: string;
  user_id: string;
  user_name: string | null;
  avatar_url: string | null;
  member_status: TimeLogMemberStatus;
  project_id: string;
  /** The client of the entry's project; `null` when the project has none. */
  client_id: string | null;
  client_name: string | null;
  project_name: string | null;
  task_id: string;
  /** The Task ID shown across the app: project key + task number, e.g. `WL-12`. */
  task_key: string | null;
  task_name: string | null;
  billable: boolean;
  /** Seconds. */
  time_spent: number;
  description: string | null;
}

/** A person who logged time on a task, as listed on a By task row. */
export interface ITimeLogTaskMember {
  user_id: string;
  user_name: string | null;
  avatar_url: string | null;
  member_status: TimeLogMemberStatus;
  /** Name-derived avatar colour — the same one every other initials avatar gets. */
  color_code: string;
}

/** A By task row: every entry of one task (that matches the filters), summed. */
export interface ITimeLogTaskRow {
  /** The task id. */
  id: string;
  /** The task's most recent entry, `YYYY-MM-DD` in the viewer's timezone. */
  log_day: string;
  project_id: string;
  client_id: string | null;
  client_name: string | null;
  project_name: string | null;
  task_id: string;
  task_key: string | null;
  task_name: string | null;
  billable: boolean;
  /** Seconds, summed over the task's entries. */
  time_spent: number;
  entry_count: number;
  /** The entries' descriptions, newest first, joined. */
  description: string | null;
  /** The members' names, comma-separated. */
  user_name: string | null;
  members: ITimeLogTaskMember[];
}

/** A row of the table: an entry in the flat view, a task in the By task view. */
export type TimeLogRow = ITimeLogEntry | ITimeLogTaskRow;

export const isTaskRow = (row: TimeLogRow): row is ITimeLogTaskRow => 'members' in row;

export interface ITimeLogsPage {
  logs: TimeLogRow[];
  /** The shape of `logs`, as requested. */
  view: TimeLogsTableView;
  /** What the pager counts: entries in the flat view, tasks in the By task view. */
  total: number;
  /** Entries matching the filters across *all* pages, whichever view this is. */
  total_entries: number;
  /** Seconds across all matching entries, not just this page. */
  total_seconds: number;
  page: number;
  page_size: number;
}

/** One Member / Project / Client group: a rollup of its entries. */
export interface ITimeLogGroup {
  /** Text id of the group; `__no_client__` for projects without a client. */
  group_key: string;
  /** `null` for the no-client group. */
  group_label: string | null;
  /** Member groups only. */
  group_avatar_url: string | null;
  /** The project's colour, or a member's name-derived avatar colour. */
  group_color: string | null;
  /** Member groups only. */
  group_status: TimeLogMemberStatus | null;
  /** Seconds across all the group's entries. */
  subtotal: number;
  entry_count: number;
  task_count: number;
  project_count: number;
  member_count: number;
  billable_entry_count: number;
  billable_task_count: number;
  billable_time: number;
  non_billable_entry_count: number;
  non_billable_task_count: number;
  non_billable_time: number;
}

export interface ITimeLogGroupsPage {
  groups: ITimeLogGroup[];
  /** The dimension of `groups`, as requested. */
  group_by: TimeLogsGroupDimension;
  total_groups: number;
  total_entries: number;
  total_seconds: number;
  page: number;
  page_size: number;
}

export interface ITimeLogMemberOption {
  user_id: string;
  name: string | null;
  email: string | null;
  avatar_url: string | null;
  team_member_id: string | null;
  is_active: boolean;
  is_removed: boolean;
}

export interface ITimeLogProjectOption {
  id: string;
  name: string;
  color_code?: string | null;
}
