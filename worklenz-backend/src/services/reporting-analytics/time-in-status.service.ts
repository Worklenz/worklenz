import { createHash } from "crypto";
import db from "../../config/db";
import {
  getAnalyticsCache,
  setAnalyticsCache,
  withLastUpdated,
} from "../../redis/analytics-cache";

export type TimeInStatusViewMode = "aggregate" | "per_issue";
export type TimeInStatusDateMode = "entered" | "exited" | "overlapping";
export type TimeInStatusSort =
  | "avg_desc"
  | "avg_asc"
  | "median_desc"
  | "count_desc"
  | "name_asc"
  | "total_desc"
  | "total_asc"
  | "key_asc";

export interface TimeInStatusFilters {
  projectIds: string[];
  statusIds: string[];
  assigneeIds: string[];
  issueTypes: string[];
  labelIds: string[];
  epicIds: string[];
  sprintIds: string[];
  dateFrom: string;
  dateTo: string;
  dateMode: TimeInStatusDateMode;
  excludeWeekends: boolean;
  viewMode: TimeInStatusViewMode;
  sort: TimeInStatusSort;
  sessionTeamId: string;
  teamIds: string[];
  /** Cap for per-issue rows returned in JSON (CSV can request higher via limit). */
  limit: number;
  offset: number;
}

export interface TimeInStatusStatusMeta {
  id: string;
  name: string;
  color: string | null;
  sort_order: number;
  category: "todo" | "doing" | "done" | "other";
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

export interface TimeInStatusResult {
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
  };
  last_updated_at: string;
}

const MAX_TIS_PROJECTS = 20;
const OUTLIER_MULTIPLIER = 1.5;
const MS_PER_DAY = 86_400_000;
const DEFAULT_PER_ISSUE_LIMIT = 100;
const MAX_PER_ISSUE_LIMIT = 2000;

function parseCsvIds(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((v): v is string => typeof v === "string" && !!v.trim());
  }
  if (typeof value === "string" && value.trim()) {
    return value
      .split(/[,\s]+/)
      .map(s => s.trim())
      .filter(Boolean);
  }
  return [];
}

function parseIssueTypes(value: unknown): string[] {
  const allowed = new Set(["task", "story", "bug"]);
  return parseCsvIds(value).filter(v => allowed.has(v));
}

function defaultDateRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to);
  from.setUTCDate(from.getUTCDate() - 29);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

function toDateOnly(value: string | null | undefined, fallback: string): string {
  if (!value) return fallback;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    return value.slice(0, 10) || fallback;
  }
  return d.toISOString().slice(0, 10);
}

function parseBool(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const v = value.toLowerCase();
    if (v === "true" || v === "1") return true;
    if (v === "false" || v === "0") return false;
  }
  return fallback;
}

function parseSort(raw: unknown, viewMode: TimeInStatusViewMode): TimeInStatusSort {
  const value = String(raw ?? "");
  const aggregateSorts: TimeInStatusSort[] = [
    "avg_desc",
    "avg_asc",
    "median_desc",
    "count_desc",
    "name_asc",
  ];
  const issueSorts: TimeInStatusSort[] = [
    "total_desc",
    "total_asc",
    "key_asc",
    "name_asc",
  ];
  if (viewMode === "per_issue") {
    return (issueSorts as string[]).includes(value)
      ? (value as TimeInStatusSort)
      : "total_desc";
  }
  return (aggregateSorts as string[]).includes(value)
    ? (value as TimeInStatusSort)
    : "avg_desc";
}

export function parseTimeInStatusFilters(
  query: Record<string, unknown>,
  accessibleProjectIds: string[],
  sessionTeamId: string
): TimeInStatusFilters {
  const defaults = defaultDateRange();
  const allowed = new Set(accessibleProjectIds);
  let projectIds = parseCsvIds(query.project_ids).filter(id => allowed.has(id));
  if (projectIds.length > MAX_TIS_PROJECTS) {
    projectIds = projectIds.slice(0, MAX_TIS_PROJECTS);
  }

  const dateModeRaw = String(query.date_mode ?? "overlapping");
  const dateMode: TimeInStatusDateMode =
    dateModeRaw === "entered" || dateModeRaw === "exited"
      ? dateModeRaw
      : "overlapping";

  const viewRaw = String(query.view_mode ?? "aggregate");
  const viewMode: TimeInStatusViewMode =
    viewRaw === "per_issue" ? "per_issue" : "aggregate";

  let limit = Number(query.limit ?? DEFAULT_PER_ISSUE_LIMIT);
  if (!Number.isFinite(limit) || limit <= 0) limit = DEFAULT_PER_ISSUE_LIMIT;
  limit = Math.min(Math.floor(limit), MAX_PER_ISSUE_LIMIT);

  let offset = Number(query.offset ?? 0);
  if (!Number.isFinite(offset) || offset < 0) offset = 0;
  offset = Math.floor(offset);

  return {
    projectIds,
    statusIds: parseCsvIds(query.status_ids),
    assigneeIds: parseCsvIds(query.assignee_ids),
    issueTypes: parseIssueTypes(query.issue_types),
    labelIds: parseCsvIds(query.label_ids),
    epicIds: parseCsvIds(query.epic_ids),
    sprintIds: parseCsvIds(query.sprint_ids),
    dateFrom: toDateOnly(
      typeof query.date_from === "string" ? query.date_from : null,
      defaults.from
    ),
    dateTo: toDateOnly(
      typeof query.date_to === "string" ? query.date_to : null,
      defaults.to
    ),
    dateMode,
    excludeWeekends: parseBool(query.exclude_weekends, false),
    viewMode,
    sort: parseSort(query.sort, viewMode),
    sessionTeamId,
    teamIds: parseCsvIds(query.team_ids),
    limit,
    offset,
  };
}

/**
 * Duration in days between start/end.
 * OQ-9: calendar 24/7 by default; when excludeWeekends, drop Sat/Sun portions
 * (full weekday hours still count — not a 9–5 business-hours clip).
 */
export function durationDays(
  enteredAt: Date,
  exitedAt: Date,
  excludeWeekends: boolean
): number {
  if (exitedAt.getTime() <= enteredAt.getTime()) return 0;

  if (!excludeWeekends) {
    return (exitedAt.getTime() - enteredAt.getTime()) / MS_PER_DAY;
  }

  let totalMs = 0;
  const cursor = new Date(enteredAt.getTime());

  while (cursor.getTime() < exitedAt.getTime()) {
    const dayStart = new Date(
      Date.UTC(
        cursor.getUTCFullYear(),
        cursor.getUTCMonth(),
        cursor.getUTCDate(),
        0,
        0,
        0,
        0
      )
    );
    const nextDay = new Date(dayStart.getTime() + MS_PER_DAY);
    const segmentEnd = new Date(Math.min(nextDay.getTime(), exitedAt.getTime()));
    const day = cursor.getUTCDay(); // 0 Sun … 6 Sat
    if (day !== 0 && day !== 6) {
      totalMs += segmentEnd.getTime() - cursor.getTime();
    }
    cursor.setTime(segmentEnd.getTime());
  }

  return totalMs / MS_PER_DAY;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function median(sorted: number[]): number {
  if (sorted.length === 0) return 0;
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

function categoryOf(row: {
  is_todo?: boolean;
  is_doing?: boolean;
  is_done?: boolean;
}): TimeInStatusStatusMeta["category"] {
  if (row.is_done) return "done";
  if (row.is_doing) return "doing";
  if (row.is_todo) return "todo";
  return "other";
}

function cacheKeyHash(filters: TimeInStatusFilters): string {
  return createHash("sha1").update(JSON.stringify(filters)).digest("hex").slice(0, 16);
}

interface HistoryRow {
  history_id: string;
  task_id: string;
  status_id: string;
  entered_at: Date;
  exited_at: Date | null;
  task_name: string;
  task_key: string;
  project_id: string;
  project_name: string;
  issue_type: string;
  assignee_name: string | null;
  status_name: string;
  status_color: string | null;
  status_sort_order: number;
  is_todo: boolean;
  is_doing: boolean;
  is_done: boolean;
}

async function loadHistoryRows(filters: TimeInStatusFilters): Promise<HistoryRow[]> {
  if (filters.projectIds.length === 0) return [];

  const params: unknown[] = [
    filters.projectIds,
    `${filters.dateFrom}T00:00:00.000Z`,
    `${filters.dateTo}T23:59:59.999Z`,
  ];
  let param = 4;

  const clauses: string[] = [
    "h.project_id = ANY($1::UUID[])",
    "t.archived IS FALSE",
    "t.parent_task_id IS NULL",
  ];

  if (filters.dateMode === "entered") {
    clauses.push(`h.entered_at >= $2::TIMESTAMPTZ AND h.entered_at <= $3::TIMESTAMPTZ`);
  } else if (filters.dateMode === "exited") {
    clauses.push(
      `h.exited_at IS NOT NULL AND h.exited_at >= $2::TIMESTAMPTZ AND h.exited_at <= $3::TIMESTAMPTZ`
    );
  } else {
    // overlapping: was in the status at any point during the range
    clauses.push(
      `h.entered_at <= $3::TIMESTAMPTZ AND (h.exited_at IS NULL OR h.exited_at >= $2::TIMESTAMPTZ)`
    );
  }

  if (filters.statusIds.length > 0) {
    clauses.push(`h.status_id = ANY($${param}::UUID[])`);
    params.push(filters.statusIds);
    param += 1;
  }

  if (filters.issueTypes.length > 0) {
    clauses.push(`t.issue_type = ANY($${param}::TEXT[])`);
    params.push(filters.issueTypes);
    param += 1;
  }

  if (filters.assigneeIds.length > 0) {
    clauses.push(`EXISTS (
      SELECT 1 FROM tasks_assignees ta
      WHERE ta.task_id = t.id
        AND ta.team_member_id = ANY($${param}::UUID[])
    )`);
    params.push(filters.assigneeIds);
    param += 1;
  }

  if (filters.labelIds.length > 0) {
    clauses.push(`EXISTS (
      SELECT 1 FROM task_labels tl
      WHERE tl.task_id = t.id
        AND tl.label_id = ANY($${param}::UUID[])
    )`);
    params.push(filters.labelIds);
    param += 1;
  }

  if (filters.epicIds.length > 0) {
    clauses.push(`t.epic_id = ANY($${param}::UUID[])`);
    params.push(filters.epicIds);
    param += 1;
  }

  if (filters.sprintIds.length > 0) {
    clauses.push(`EXISTS (
      SELECT 1 FROM task_phase tp
      WHERE tp.task_id = t.id
        AND tp.phase_id = ANY($${param}::UUID[])
    )`);
    params.push(filters.sprintIds);
    param += 1;
  }

  const result = await db.query(
    `
    SELECT
      h.id AS history_id,
      h.task_id,
      h.status_id,
      h.entered_at,
      h.exited_at,
      t.name AS task_name,
      CONCAT(p.key, '-', t.task_no) AS task_key,
      t.project_id,
      p.name AS project_name,
      COALESCE(t.issue_type, 'task') AS issue_type,
      (
        SELECT tmiv.name
        FROM tasks_assignees ta
        JOIN team_member_info_view tmiv ON tmiv.team_member_id = ta.team_member_id
        WHERE ta.task_id = t.id
        ORDER BY ta.created_at ASC NULLS LAST
        LIMIT 1
      ) AS assignee_name,
      ts.name AS status_name,
      ts.color_code AS status_color,
      COALESCE(ts.sort_order, 0) AS status_sort_order,
      COALESCE(cat.is_todo, FALSE) AS is_todo,
      COALESCE(cat.is_doing, FALSE) AS is_doing,
      COALESCE(cat.is_done, FALSE) AS is_done
    FROM task_status_history h
    INNER JOIN tasks t ON t.id = h.task_id
    INNER JOIN projects p ON p.id = t.project_id
    INNER JOIN task_statuses ts ON ts.id = h.status_id
    LEFT JOIN sys_task_status_categories cat ON cat.id = ts.category_id
    WHERE ${clauses.join("\n      AND ")}
    ORDER BY h.task_id, h.entered_at ASC
    `,
    params
  );

  return (result.rows as Array<Record<string, unknown>>).map(row => ({
    history_id: String(row.history_id),
    task_id: String(row.task_id),
    status_id: String(row.status_id),
    entered_at: new Date(String(row.entered_at)),
    exited_at: row.exited_at ? new Date(String(row.exited_at)) : null,
    task_name: String(row.task_name ?? ""),
    task_key: String(row.task_key ?? ""),
    project_id: String(row.project_id),
    project_name: String(row.project_name ?? ""),
    issue_type: String(row.issue_type ?? "task"),
    assignee_name: row.assignee_name ? String(row.assignee_name) : null,
    status_name: String(row.status_name ?? ""),
    status_color: row.status_color ? String(row.status_color) : null,
    status_sort_order: Number(row.status_sort_order ?? 0),
    is_todo: Boolean(row.is_todo),
    is_doing: Boolean(row.is_doing),
    is_done: Boolean(row.is_done),
  }));
}

interface ComputedVisit {
  row: HistoryRow;
  days: number;
  is_live: boolean;
}

function computeVisits(
  rows: HistoryRow[],
  excludeWeekends: boolean,
  now: Date
): ComputedVisit[] {
  return rows.map(row => {
    const exited = row.exited_at ?? now;
    const is_live = row.exited_at === null;
    return {
      row,
      days: durationDays(row.entered_at, exited, excludeWeekends),
      is_live,
    };
  });
}

function buildStatuses(visits: ComputedVisit[]): TimeInStatusStatusMeta[] {
  const map = new Map<string, TimeInStatusStatusMeta>();
  for (const v of visits) {
    if (map.has(v.row.status_id)) continue;
    map.set(v.row.status_id, {
      id: v.row.status_id,
      name: v.row.status_name,
      color: v.row.status_color,
      sort_order: v.row.status_sort_order,
      category: categoryOf(v.row),
    });
  }
  return [...map.values()].sort(
    (a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)
  );
}

function buildAggregate(
  visits: ComputedVisit[],
  statuses: TimeInStatusStatusMeta[],
  sort: TimeInStatusSort
): TimeInStatusAggregateRow[] {
  const byStatus = new Map<string, number[]>();
  for (const v of visits) {
    const list = byStatus.get(v.row.status_id) ?? [];
    list.push(v.days);
    byStatus.set(v.row.status_id, list);
  }

  const rows: TimeInStatusAggregateRow[] = statuses.map(status => {
    const values = (byStatus.get(status.id) ?? []).slice().sort((a, b) => a - b);
    const count = values.length;
    const sum = values.reduce((acc, n) => acc + n, 0);
    const avg = count > 0 ? sum / count : 0;
    return {
      status_id: status.id,
      status_name: status.name,
      color: status.color,
      avg_days: round2(avg),
      median_days: round2(median(values)),
      min_days: round2(count > 0 ? values[0] : 0),
      max_days: round2(count > 0 ? values[values.length - 1] : 0),
      count,
      pct_cycle_time: 0,
      sort_order: status.sort_order,
    };
  });

  const totalAvg = rows.reduce((acc, r) => acc + r.avg_days, 0);
  for (const row of rows) {
    row.pct_cycle_time =
      totalAvg > 0 ? round2((row.avg_days / totalAvg) * 100) : 0;
  }

  rows.sort((a, b) => {
    switch (sort) {
      case "avg_asc":
        return a.avg_days - b.avg_days;
      case "median_desc":
        return b.median_days - a.median_days;
      case "count_desc":
        return b.count - a.count || b.avg_days - a.avg_days;
      case "name_asc":
        return a.status_name.localeCompare(b.status_name);
      case "avg_desc":
      default:
        return b.avg_days - a.avg_days;
    }
  });

  return rows;
}

function countOutlierIssues(
  visits: ComputedVisit[],
  aggregate: TimeInStatusAggregateRow[]
): number {
  const avgByStatus = new Map(aggregate.map(r => [r.status_id, r.avg_days]));
  const byTask = new Map<string, Map<string, number>>();

  for (const v of visits) {
    let segs = byTask.get(v.row.task_id);
    if (!segs) {
      segs = new Map();
      byTask.set(v.row.task_id, segs);
    }
    segs.set(v.row.status_id, (segs.get(v.row.status_id) ?? 0) + v.days);
  }

  let outliers = 0;
  for (const segs of byTask.values()) {
    let isOutlier = false;
    for (const [statusId, days] of segs) {
      const avg = avgByStatus.get(statusId) ?? 0;
      if (avg > 0 && days > avg * OUTLIER_MULTIPLIER) {
        isOutlier = true;
        break;
      }
    }
    if (isOutlier) outliers += 1;
  }
  return outliers;
}

function buildIssues(
  visits: ComputedVisit[],
  aggregate: TimeInStatusAggregateRow[],
  sort: TimeInStatusSort,
  limit: number,
  offset: number
): { issues: TimeInStatusIssueRow[]; total: number; outlier_count: number } {
  const avgByStatus = new Map(aggregate.map(r => [r.status_id, r.avg_days]));
  const byTask = new Map<
    string,
    {
      meta: HistoryRow;
      segments: Map<
        string,
        {
          status_id: string;
          status_name: string;
          color: string | null;
          days: number;
          is_live: boolean;
          is_outlier: boolean;
        }
      >;
    }
  >();

  for (const v of visits) {
    let entry = byTask.get(v.row.task_id);
    if (!entry) {
      entry = { meta: v.row, segments: new Map() };
      byTask.set(v.row.task_id, entry);
    }
    const avg = avgByStatus.get(v.row.status_id) ?? 0;
    const is_outlier = avg > 0 && v.days > avg * OUTLIER_MULTIPLIER;
    const existing = entry.segments.get(v.row.status_id);
    if (existing) {
      existing.days += v.days;
      existing.is_live = existing.is_live || v.is_live;
      existing.is_outlier =
        avg > 0 && existing.days > avg * OUTLIER_MULTIPLIER;
    } else {
      entry.segments.set(v.row.status_id, {
        status_id: v.row.status_id,
        status_name: v.row.status_name,
        color: v.row.status_color,
        days: v.days,
        is_live: v.is_live,
        is_outlier,
      });
    }
  }

  let issues: TimeInStatusIssueRow[] = [...byTask.values()].map(entry => {
    const segments = [...entry.segments.values()].map(seg => ({
      ...seg,
      days: round2(seg.days),
    }));
    const total_days = round2(segments.reduce((acc, s) => acc + s.days, 0));
    const is_outlier = segments.some(s => s.is_outlier);
    return {
      task_id: entry.meta.task_id,
      task_key: entry.meta.task_key,
      task_name: entry.meta.task_name,
      project_id: entry.meta.project_id,
      project_name: entry.meta.project_name,
      issue_type: entry.meta.issue_type,
      assignee_name: entry.meta.assignee_name,
      total_days,
      is_outlier,
      segments,
    };
  });

  issues.sort((a, b) => {
    switch (sort) {
      case "total_asc":
        return a.total_days - b.total_days;
      case "key_asc":
        return a.task_key.localeCompare(b.task_key);
      case "name_asc":
        return a.task_name.localeCompare(b.task_name);
      case "total_desc":
      default:
        return b.total_days - a.total_days;
    }
  });

  const total = issues.length;
  const outlier_count = issues.filter(i => i.is_outlier).length;
  issues = issues.slice(offset, offset + limit);

  return { issues, total, outlier_count };
}

export async function getTimeInStatusSeries(
  filters: TimeInStatusFilters
): Promise<TimeInStatusResult> {
  const hash = cacheKeyHash(filters);
  const cached = await getAnalyticsCache<Omit<TimeInStatusResult, "last_updated_at">>(
    "tis",
    filters.sessionTeamId,
    hash
  );
  if (cached) {
    return withLastUpdated(cached.data, cached.lastUpdatedAt);
  }

  const now = new Date();
  const history = await loadHistoryRows(filters);
  const visits = computeVisits(history, filters.excludeWeekends, now);
  const statuses = buildStatuses(visits);
  const aggregateSort =
    filters.viewMode === "aggregate" ? filters.sort : "avg_desc";
  const aggregate = buildAggregate(visits, statuses, aggregateSort);

  const issuePage =
    filters.viewMode === "per_issue"
      ? buildIssues(visits, aggregate, filters.sort, filters.limit, filters.offset)
      : null;

  const uniqueIssues = new Set(visits.map(v => v.row.task_id));
  const avgCycle =
    aggregate.length > 0
      ? round2(aggregate.reduce((acc, r) => acc + r.avg_days, 0))
      : null;

  const outlierCount =
    issuePage?.outlier_count ?? countOutlierIssues(visits, aggregate);

  const payload: Omit<TimeInStatusResult, "last_updated_at"> = {
    view_mode: filters.viewMode,
    statuses,
    aggregate,
    issues: issuePage?.issues ?? [],
    summary: {
      issue_count: uniqueIssues.size,
      status_visit_count: visits.length,
      avg_cycle_days: avgCycle,
      outlier_count: outlierCount,
      exclude_weekends: filters.excludeWeekends,
      date_mode: filters.dateMode,
    },
    pagination: {
      total: issuePage?.total ?? uniqueIssues.size,
      limit: filters.limit,
      offset: filters.offset,
    },
    meta: {
      project_count: filters.projectIds.length,
    },
  };

  const cachedPayload = await setAnalyticsCache(payload, [
    "tis",
    filters.sessionTeamId,
    hash,
  ]);

  return withLastUpdated(payload, cachedPayload.lastUpdatedAt);
}

function csvEscape(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function buildTimeInStatusCsv(data: TimeInStatusResult): string {
  if (data.view_mode === "per_issue") {
    const statusCols = data.statuses;
    const header = [
      "Task Key",
      "Task Name",
      "Project",
      "Type",
      "Assignee",
      "Total Days",
      "Outlier",
      ...statusCols.map(s => `${s.name} (days)`),
    ];
    const lines = [header.map(csvEscape).join(",")];
    for (const issue of data.issues) {
      const byStatus = new Map(issue.segments.map(s => [s.status_id, s.days]));
      lines.push(
        [
          issue.task_key,
          issue.task_name,
          issue.project_name,
          issue.issue_type,
          issue.assignee_name ?? "",
          issue.total_days,
          issue.is_outlier ? "yes" : "no",
          ...statusCols.map(s => byStatus.get(s.id) ?? 0),
        ]
          .map(csvEscape)
          .join(",")
      );
    }
    return lines.join("\n");
  }

  const header = [
    "Status",
    "Avg Days",
    "Median Days",
    "Min Days",
    "Max Days",
    "Count",
    "% Cycle Time",
  ];
  const lines = [header.map(csvEscape).join(",")];
  for (const row of data.aggregate) {
    lines.push(
      [
        row.status_name,
        row.avg_days,
        row.median_days,
        row.min_days,
        row.max_days,
        row.count,
        row.pct_cycle_time,
      ]
        .map(csvEscape)
        .join(",")
    );
  }
  return lines.join("\n");
}

/** Load status / sprint / label / epic filter options for selected projects. */
export async function getTimeInStatusFilterOptions(projectIds: string[]): Promise<{
  statuses: Array<{ id: string; name: string; color: string | null }>;
  sprints: Array<{ id: string; name: string; project_id: string }>;
  labels: Array<{ id: string; name: string }>;
  epics: Array<{ id: string; name: string }>;
}> {
  if (projectIds.length === 0) {
    return { statuses: [], sprints: [], labels: [], epics: [] };
  }

  const [statusesRes, sprintsRes, labelsRes, epicsRes] = await Promise.all([
    db.query(
      `
      SELECT DISTINCT ON (ts.name) ts.id, ts.name, ts.color_code AS color
      FROM task_statuses ts
      WHERE ts.project_id = ANY($1::UUID[])
      ORDER BY ts.name, ts.sort_order NULLS LAST
      `,
      [projectIds]
    ),
    db.query(
      `
      SELECT pp.id, pp.name, pp.project_id
      FROM project_phases pp
      WHERE pp.project_id = ANY($1::UUID[])
      ORDER BY pp.start_date DESC NULLS LAST, pp.name ASC
      `,
      [projectIds]
    ),
    db.query(
      `
      SELECT DISTINCT lab.id, lab.name
      FROM team_labels lab
      INNER JOIN task_labels tl ON tl.label_id = lab.id
      INNER JOIN tasks t ON t.id = tl.task_id
      WHERE t.project_id = ANY($1::UUID[])
      ORDER BY lab.name ASC
      `,
      [projectIds]
    ),
    db.query(
      `
      SELECT pe.id, pe.name
      FROM project_epics pe
      WHERE pe.project_id = ANY($1::UUID[])
      ORDER BY pe.name ASC
      `,
      [projectIds]
    ),
  ]);

  return {
    statuses: (statusesRes.rows as Array<{ id: string; name: string; color: string | null }>).map(
      r => ({ id: r.id, name: r.name, color: r.color })
    ),
    sprints: (sprintsRes.rows as Array<{ id: string; name: string; project_id: string }>).map(
      r => ({ id: r.id, name: r.name, project_id: r.project_id })
    ),
    labels: (labelsRes.rows as Array<{ id: string; name: string }>).map(r => ({
      id: r.id,
      name: r.name,
    })),
    epics: (epicsRes.rows as Array<{ id: string; name: string }>).map(r => ({
      id: r.id,
      name: r.name,
    })),
  };
}
