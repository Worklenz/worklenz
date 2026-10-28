import { createHash } from "crypto";
import db from "../../config/db";
import {
  getAnalyticsCache,
  setAnalyticsCache,
  withLastUpdated,
} from "../../redis/analytics-cache";
import { backfillRange, captureTodaySnapshots } from "./cfd-snapshot.service";

export type CfdGroupBy = "all" | "epic" | "label" | "assignee";
export type CfdSmoothing = "raw" | "rolling_7";

export interface CfdSeriesFilters {
  projectIds: string[];
  statusIds: string[];
  dateFrom: string;
  dateTo: string;
  groupBy: CfdGroupBy;
  smoothing: CfdSmoothing;
  wipThresholds: Record<string, number>;
  sprintOverlay: boolean;
  sessionTeamId: string;
  teamIds: string[];
  /**
   * When true (no projects explicitly selected), series are rolled up into
   * the three main categories: To do / In progress / Done across all projects.
   */
  rollupByCategory: boolean;
}

export interface CfdStatusMeta {
  id: string;
  name: string;
  color: string | null;
  category: "todo" | "doing" | "done" | "other";
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

export interface CfdSeriesResult {
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
    rollup_by_category: boolean;
    /** Always week for CFD chart/table (mockup). */
    granularity: "week";
    /** Monday (UTC) ISO date for each week label in `dates`. */
    week_starts: string[];
  };
  last_updated_at: string;
}

/** Synthetic status ids used when rollupByCategory is on. */
export const CFD_CATEGORY_STATUS = {
  todo: "__cfd_todo__",
  doing: "__cfd_doing__",
  done: "__cfd_done__",
} as const;

const CATEGORY_STATUS_META: CfdStatusMeta[] = [
  {
    id: CFD_CATEGORY_STATUS.todo,
    name: "To do",
    color: "#fa8c16",
    category: "todo",
    sort_order: 1,
    is_todo: true,
    is_doing: false,
    is_done: false,
  },
  {
    id: CFD_CATEGORY_STATUS.doing,
    name: "In progress",
    color: "#1890ff",
    category: "doing",
    sort_order: 2,
    is_todo: false,
    is_doing: true,
    is_done: false,
  },
  {
    id: CFD_CATEGORY_STATUS.done,
    name: "Done",
    color: "#52c41a",
    category: "done",
    sort_order: 3,
    is_todo: false,
    is_doing: false,
    is_done: true,
  },
];

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

function parseWipThresholds(raw: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!raw) return out;

  if (typeof raw === "object" && !Array.isArray(raw)) {
    for (const [key, val] of Object.entries(raw as Record<string, unknown>)) {
      const n = Number(val);
      if (key && Number.isFinite(n) && n >= 0) out[key] = n;
    }
    return out;
  }

  if (typeof raw === "string" && raw.trim()) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      return parseWipThresholds(parsed);
    } catch {
      // statusId:n,statusId:n
      for (const part of raw.split(",")) {
        const [id, num] = part.split(":");
        const n = Number(num);
        if (id?.trim() && Number.isFinite(n) && n >= 0) {
          out[id.trim()] = n;
        }
      }
    }
  }
  return out;
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

function eachDateInclusive(from: string, to: string): string[] {
  const dates: string[] = [];
  const cursor = new Date(`${from}T00:00:00.000Z`);
  const end = new Date(`${to}T00:00:00.000Z`);
  while (cursor.getTime() <= end.getTime()) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

/** Hard cap when user picks projects — detail statuses freeze with too many. */
const MAX_CFD_PROJECTS = 20;
/** Soft cap for all-projects category rollup (still needs snapshots). */
const MAX_CFD_CATEGORY_PROJECTS = 200;

export function parseCfdFilters(
  query: Record<string, unknown>,
  accessibleProjectIds: string[],
  sessionTeamId: string
): CfdSeriesFilters {
  const defaults = defaultDateRange();
  const allowed = new Set(accessibleProjectIds);
  const requested = parseCsvIds(query.project_ids).filter(id => allowed.has(id));
  // No explicit projects → all accessible, rolled into To do / In progress / Done.
  const rollupByCategory = requested.length === 0;
  let projectIds = rollupByCategory ? [...accessibleProjectIds] : requested;

  if (rollupByCategory) {
    if (projectIds.length > MAX_CFD_CATEGORY_PROJECTS) {
      projectIds = projectIds.slice(0, MAX_CFD_CATEGORY_PROJECTS);
    }
  } else if (projectIds.length > MAX_CFD_PROJECTS) {
    projectIds = projectIds.slice(0, MAX_CFD_PROJECTS);
  }

  const groupRaw = String(query.group_by ?? "all");
  // Category rollup always uses flat (non-grouped) series.
  const groupBy: CfdGroupBy = rollupByCategory
    ? "all"
    : groupRaw === "epic" || groupRaw === "label" || groupRaw === "assignee"
      ? groupRaw
      : "all";

  const smoothRaw = String(query.smoothing ?? "raw");
  const smoothing: CfdSmoothing = smoothRaw === "rolling_7" ? "rolling_7" : "raw";

  return {
    projectIds,
    statusIds: parseCsvIds(query.status_ids),
    dateFrom: toDateOnly(
      typeof query.date_from === "string" ? query.date_from : null,
      defaults.from
    ),
    dateTo: toDateOnly(
      typeof query.date_to === "string" ? query.date_to : null,
      defaults.to
    ),
    groupBy,
    smoothing,
    wipThresholds: parseWipThresholds(query.wip_thresholds),
    sprintOverlay: String(query.sprint_overlay ?? "false") === "true",
    sessionTeamId,
    teamIds: parseCsvIds(query.team_ids),
    rollupByCategory,
  };
}

function cacheKeyHash(filters: CfdSeriesFilters): string {
  return createHash("sha1").update(JSON.stringify(filters)).digest("hex").slice(0, 16);
}

function categoryOf(row: {
  is_todo?: boolean;
  is_doing?: boolean;
  is_done?: boolean;
}): CfdStatusMeta["category"] {
  if (row.is_done) return "done";
  if (row.is_doing) return "doing";
  if (row.is_todo) return "todo";
  return "other";
}

function rollingAverage(values: number[], window: number): number[] {
  return values.map((_, index) => {
    const start = Math.max(0, index - window + 1);
    const slice = values.slice(start, index + 1);
    const sum = slice.reduce((a, b) => a + b, 0);
    return Math.round((sum / slice.length) * 100) / 100;
  });
}

function applySmoothing(
  series: CfdSeriesRow[],
  smoothing: CfdSmoothing
): CfdSeriesRow[] {
  if (smoothing !== "rolling_7") return series;
  return series.map(row => ({
    ...row,
    values: rollingAverage(row.values, 7),
  }));
}

async function loadStatuses(
  projectIds: string[],
  statusIds: string[]
): Promise<CfdStatusMeta[]> {
  if (projectIds.length === 0) return [];

  const params: unknown[] = [projectIds];
  let statusFilter = "";
  if (statusIds.length > 0) {
    params.push(statusIds);
    statusFilter = `AND ts.id = ANY($${params.length}::UUID[])`;
  }

  const result = await db.query(
    `
    SELECT DISTINCT ON (ts.id)
           ts.id,
           ts.name,
           COALESCE(ts.color_code, cat.color_code) AS color,
           COALESCE(ts.sort_order, 0) AS sort_order,
           COALESCE(cat.is_todo, FALSE) AS is_todo,
           COALESCE(cat.is_doing, FALSE) AS is_doing,
           COALESCE(cat.is_done, FALSE) AS is_done
    FROM task_statuses ts
    LEFT JOIN sys_task_status_categories cat ON cat.id = ts.category_id
    WHERE ts.project_id = ANY($1::UUID[])
      ${statusFilter}
    ORDER BY ts.id, ts.sort_order
    `,
    params
  );

  const rows = result.rows as Array<{
    id: string;
    name: string;
    color: string | null;
    sort_order: number;
    is_todo: boolean;
    is_doing: boolean;
    is_done: boolean;
  }>;

  return rows
    .map(row => ({
      id: row.id,
      name: row.name,
      color: row.color,
      category: categoryOf(row),
      sort_order: Number(row.sort_order ?? 0),
      is_doing: !!row.is_doing,
      is_done: !!row.is_done,
      is_todo: !!row.is_todo,
    }))
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
}

async function loadSnapshotSeries(
  filters: CfdSeriesFilters,
  dates: string[],
  statuses: CfdStatusMeta[]
): Promise<CfdSeriesRow[]> {
  if (filters.projectIds.length === 0 || dates.length === 0) return [];

  const result = await db.query(
    `
    SELECT snapshot_date::TEXT AS snapshot_date,
           status_id,
           SUM(issue_count)::INT AS issue_count
    FROM cfd_daily_snapshots
    WHERE project_id = ANY($1::UUID[])
      AND snapshot_date >= $2::DATE
      AND snapshot_date <= $3::DATE
      ${
        filters.statusIds.length > 0
          ? "AND status_id = ANY($4::UUID[])"
          : ""
      }
    GROUP BY snapshot_date, status_id
    `,
    filters.statusIds.length > 0
      ? [filters.projectIds, filters.dateFrom, filters.dateTo, filters.statusIds]
      : [filters.projectIds, filters.dateFrom, filters.dateTo]
  );

  const map = new Map<string, number>();
  for (const row of result.rows as Array<{
    snapshot_date: string;
    status_id: string;
    issue_count: number;
  }>) {
    const day = row.snapshot_date.slice(0, 10);
    map.set(`${row.status_id}|${day}`, Number(row.issue_count ?? 0));
  }

  return statuses.map(status => ({
    status_id: status.id,
    group_id: null,
    group_name: null,
    values: dates.map(d => map.get(`${status.id}|${d}`) ?? 0),
  }));
}

async function loadGroupedSeries(
  filters: CfdSeriesFilters,
  dates: string[],
  statuses: CfdStatusMeta[]
): Promise<CfdSeriesRow[]> {
  if (filters.projectIds.length === 0 || dates.length === 0) return [];

  const statusIdSet =
    filters.statusIds.length > 0
      ? new Set(filters.statusIds)
      : new Set(statuses.map(s => s.id));

  const seriesMap = new Map<string, CfdSeriesRow>();
  const ensure = (
    statusId: string,
    groupId: string | null,
    groupName: string | null
  ): CfdSeriesRow => {
    const key = `${statusId}|${groupId ?? "none"}`;
    let row = seriesMap.get(key);
    if (!row) {
      row = {
        status_id: statusId,
        group_id: groupId,
        group_name: groupName,
        values: dates.map(() => 0),
      };
      seriesMap.set(key, row);
    }
    return row;
  };

  for (let i = 0; i < dates.length; i++) {
    const day = dates[i];
    const dayEnd = `${day}T23:59:59.999Z`;

    let q = "";
    const params: unknown[] = [filters.projectIds, dayEnd];

    if (filters.groupBy === "epic") {
      q = `
        SELECT h.status_id,
               COALESCE(pe.id::TEXT, 'none') AS group_id,
               COALESCE(pe.name, 'No epic') AS group_name,
               COUNT(DISTINCT h.task_id)::INT AS issue_count
        FROM task_status_history h
        INNER JOIN tasks t ON t.id = h.task_id
        LEFT JOIN project_epics pe ON pe.id = t.epic_id
        WHERE h.project_id = ANY($1::UUID[])
          AND t.archived IS FALSE
          AND t.parent_task_id IS NULL
          AND h.entered_at <= $2::TIMESTAMPTZ
          AND (h.exited_at IS NULL OR h.exited_at > $2::TIMESTAMPTZ)
        GROUP BY h.status_id, pe.id, pe.name
      `;
    } else if (filters.groupBy === "label") {
      q = `
        SELECT h.status_id,
               COALESCE(tl.label_id::TEXT, 'none') AS group_id,
               COALESCE(lab.name, 'No label') AS group_name,
               COUNT(DISTINCT h.task_id)::INT AS issue_count
        FROM task_status_history h
        INNER JOIN tasks t ON t.id = h.task_id
        LEFT JOIN task_labels tl ON tl.task_id = t.id
        LEFT JOIN team_labels lab ON lab.id = tl.label_id
        WHERE h.project_id = ANY($1::UUID[])
          AND t.archived IS FALSE
          AND t.parent_task_id IS NULL
          AND h.entered_at <= $2::TIMESTAMPTZ
          AND (h.exited_at IS NULL OR h.exited_at > $2::TIMESTAMPTZ)
        GROUP BY h.status_id, tl.label_id, lab.name
      `;
    } else {
      q = `
        SELECT h.status_id,
               COALESCE(ta.team_member_id::TEXT, 'none') AS group_id,
               COALESCE(tmiv.name, 'Unassigned') AS group_name,
               COUNT(DISTINCT h.task_id)::INT AS issue_count
        FROM task_status_history h
        INNER JOIN tasks t ON t.id = h.task_id
        LEFT JOIN tasks_assignees ta ON ta.task_id = t.id
        LEFT JOIN team_member_info_view tmiv ON tmiv.team_member_id = ta.team_member_id
        WHERE h.project_id = ANY($1::UUID[])
          AND t.archived IS FALSE
          AND t.parent_task_id IS NULL
          AND h.entered_at <= $2::TIMESTAMPTZ
          AND (h.exited_at IS NULL OR h.exited_at > $2::TIMESTAMPTZ)
        GROUP BY h.status_id, ta.team_member_id, tmiv.name
      `;
    }

    const result = await db.query(q, params);
    for (const row of result.rows as Array<{
      status_id: string;
      group_id: string;
      group_name: string;
      issue_count: number;
    }>) {
      if (!statusIdSet.has(row.status_id)) continue;
      const seriesRow = ensure(
        row.status_id,
        row.group_id === "none" ? null : row.group_id,
        row.group_name
      );
      seriesRow.values[i] = Number(row.issue_count ?? 0);
    }
  }

  // Ensure every status appears at least once when group_by=all would have shown it
  for (const status of statuses) {
    const hasAny = [...seriesMap.values()].some(r => r.status_id === status.id);
    if (!hasAny) {
      ensure(status.id, null, null);
    }
  }

  return [...seriesMap.values()];
}

async function loadIndicators(
  filters: CfdSeriesFilters,
  dates: string[],
  statuses: CfdStatusMeta[],
  series: CfdSeriesRow[]
): Promise<CfdSeriesResult["indicators"]> {
  const lastIdx = dates.length - 1;
  const doingIds = new Set(statuses.filter(s => s.is_doing).map(s => s.id));
  let currentWip = 0;
  if (lastIdx >= 0) {
    for (const row of series) {
      if (doingIds.has(row.status_id)) {
        currentWip += Number(row.values[lastIdx] ?? 0);
      }
    }
  }

  const dayCount = Math.max(dates.length, 1);
  let avgThroughput = 0;
  let avgCycle: number | null = null;
  let avgLead: number | null = null;

  if (filters.projectIds.length > 0) {
    const throughputResult = await db.query(
      `
      SELECT COUNT(DISTINCT h.task_id)::INT AS completed_count
      FROM task_status_history h
      INNER JOIN tasks t ON t.id = h.task_id
      INNER JOIN task_statuses ts ON ts.id = h.status_id
      INNER JOIN sys_task_status_categories cat ON cat.id = ts.category_id
      WHERE h.project_id = ANY($1::UUID[])
        AND t.archived IS FALSE
        AND t.parent_task_id IS NULL
        AND cat.is_done IS TRUE
        AND h.entered_at >= $2::TIMESTAMPTZ
        AND h.entered_at <= $3::TIMESTAMPTZ
      `,
      [
        filters.projectIds,
        `${filters.dateFrom}T00:00:00.000Z`,
        `${filters.dateTo}T23:59:59.999Z`,
      ]
    );
    const completed = Number(throughputResult.rows[0]?.completed_count ?? 0);
    avgThroughput = Math.round((completed / dayCount) * 100) / 100;

    const cycleLeadResult = await db.query(
      `
      WITH done_events AS (
        SELECT h.task_id,
               MIN(h.entered_at) AS done_at
        FROM task_status_history h
        INNER JOIN tasks t ON t.id = h.task_id
        INNER JOIN task_statuses ts ON ts.id = h.status_id
        INNER JOIN sys_task_status_categories cat ON cat.id = ts.category_id
        WHERE h.project_id = ANY($1::UUID[])
          AND t.archived IS FALSE
          AND t.parent_task_id IS NULL
          AND cat.is_done IS TRUE
          AND h.entered_at >= $2::TIMESTAMPTZ
          AND h.entered_at <= $3::TIMESTAMPTZ
        GROUP BY h.task_id
      ),
      start_events AS (
        SELECT h.task_id,
               MIN(h.entered_at) AS started_at
        FROM task_status_history h
        INNER JOIN task_statuses ts ON ts.id = h.status_id
        INNER JOIN sys_task_status_categories cat ON cat.id = ts.category_id
        WHERE h.task_id IN (SELECT task_id FROM done_events)
          AND cat.is_doing IS TRUE
        GROUP BY h.task_id
      )
      SELECT
        AVG(EXTRACT(EPOCH FROM (d.done_at - COALESCE(s.started_at, t.created_at))) / 86400.0)
          AS avg_cycle_days,
        AVG(EXTRACT(EPOCH FROM (d.done_at - t.created_at)) / 86400.0)
          AS avg_lead_days
      FROM done_events d
      INNER JOIN tasks t ON t.id = d.task_id
      LEFT JOIN start_events s ON s.task_id = d.task_id
      `,
      [
        filters.projectIds,
        `${filters.dateFrom}T00:00:00.000Z`,
        `${filters.dateTo}T23:59:59.999Z`,
      ]
    );

    const cycleRaw = cycleLeadResult.rows[0]?.avg_cycle_days;
    const leadRaw = cycleLeadResult.rows[0]?.avg_lead_days;
    avgCycle =
      cycleRaw === null || cycleRaw === undefined
        ? null
        : Math.round(Number(cycleRaw) * 100) / 100;
    avgLead =
      leadRaw === null || leadRaw === undefined
        ? null
        : Math.round(Number(leadRaw) * 100) / 100;
  }

  return {
    current_wip: currentWip,
    avg_throughput_per_day: avgThroughput,
    avg_cycle_days: avgCycle,
    avg_lead_days: avgLead,
  };
}

async function loadSprints(
  filters: CfdSeriesFilters
): Promise<CfdSeriesResult["sprints"]> {
  if (!filters.sprintOverlay || filters.projectIds.length === 0) return null;

  const result = await db.query(
    `
    SELECT pp.id, pp.name, pp.project_id,
           pp.start_date, pp.end_date
    FROM project_phases pp
    WHERE pp.project_id = ANY($1::UUID[])
      AND pp.start_date IS NOT NULL
      AND (
        (pp.start_date::DATE <= $3::DATE AND COALESCE(pp.end_date, pp.start_date)::DATE >= $2::DATE)
      )
    ORDER BY pp.start_date ASC NULLS LAST
    `,
    [filters.projectIds, filters.dateFrom, filters.dateTo]
  );

  return (result.rows as Array<{
    id: string;
    name: string;
    project_id: string;
    start_date: Date | string | null;
    end_date: Date | string | null;
  }>).map(row => ({
    id: row.id,
    name: row.name,
    project_id: row.project_id,
    start_date: row.start_date
      ? new Date(row.start_date).toISOString()
      : null,
    end_date: row.end_date ? new Date(row.end_date).toISOString() : null,
  }));
}

function categoryBucketId(status: CfdStatusMeta): string {
  if (status.is_done || status.category === "done") return CFD_CATEGORY_STATUS.done;
  if (status.is_doing || status.category === "doing") return CFD_CATEGORY_STATUS.doing;
  return CFD_CATEGORY_STATUS.todo;
}

/**
 * Roll every custom status into the three main categories (To do / In progress / Done).
 * Used when no project is selected so the chart stays readable across the workspace.
 */
function collapseByCategory(
  statuses: CfdStatusMeta[],
  series: CfdSeriesRow[],
  dates: string[]
): { statuses: CfdStatusMeta[]; series: CfdSeriesRow[] } {
  const idToCategory = new Map<string, string>();
  for (const status of statuses) {
    idToCategory.set(status.id, categoryBucketId(status));
  }

  const totals = new Map<string, number[]>([
    [CFD_CATEGORY_STATUS.todo, dates.map(() => 0)],
    [CFD_CATEGORY_STATUS.doing, dates.map(() => 0)],
    [CFD_CATEGORY_STATUS.done, dates.map(() => 0)],
  ]);

  for (const row of series) {
    const bucket = idToCategory.get(row.status_id) ?? CFD_CATEGORY_STATUS.todo;
    const values = totals.get(bucket);
    if (!values) continue;
    for (let i = 0; i < dates.length; i++) {
      values[i] += Number(row.values[i] ?? 0);
    }
  }

  return {
    statuses: CATEGORY_STATUS_META.map(s => ({ ...s })),
    series: CATEGORY_STATUS_META.map(status => ({
      status_id: status.id,
      group_id: null,
      group_name: null,
      values: [...(totals.get(status.id) ?? dates.map(() => 0))],
    })),
  };
}

/**
 * Merge statuses that share the same name across projects into one band.
 * Keeps chart usable when several projects are selected.
 */
function collapseByStatusName(
  statuses: CfdStatusMeta[],
  series: CfdSeriesRow[],
  dates: string[]
): { statuses: CfdStatusMeta[]; series: CfdSeriesRow[] } {
  const byName = new Map<string, CfdStatusMeta>();
  const idToCanonical = new Map<string, string>();

  for (const status of statuses) {
    const key = status.name.trim().toLowerCase();
    const existing = byName.get(key);
    if (!existing) {
      byName.set(key, status);
      idToCanonical.set(status.id, status.id);
    } else {
      idToCanonical.set(status.id, existing.id);
      // Prefer doing > todo > other for category flags
      if (status.is_doing && !existing.is_doing) {
        byName.set(key, { ...existing, ...status, id: existing.id, name: existing.name });
      }
    }
  }

  const collapsedStatuses = [...byName.values()].sort(
    (a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)
  );

  const seriesMap = new Map<string, CfdSeriesRow>();
  for (const row of series) {
    const canonicalId = idToCanonical.get(row.status_id) ?? row.status_id;
    const key = `${canonicalId}|${row.group_id ?? "none"}`;
    const existing = seriesMap.get(key);
    if (!existing) {
      seriesMap.set(key, {
        status_id: canonicalId,
        group_id: row.group_id,
        group_name: row.group_name,
        values: [...row.values],
      });
    } else {
      for (let i = 0; i < dates.length; i++) {
        existing.values[i] += Number(row.values[i] ?? 0);
      }
    }
  }

  return { statuses: collapsedStatuses, series: [...seriesMap.values()] };
}

/** Monday (UTC) of the ISO week containing `dateStr` (YYYY-MM-DD). */
function startOfIsoWeek(dateStr: string): string {
  const d = new Date(`${dateStr.slice(0, 10)}T00:00:00.000Z`);
  const day = d.getUTCDay(); // 0 = Sun … 6 = Sat
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

/**
 * Collapse daily series into one point per week (last day in the week).
 * Labels match the mockup: W1, W2, …
 */
function aggregateToWeeks(
  dates: string[],
  series: CfdSeriesRow[],
  breaches: CfdSeriesResult["wip_breaches"]
): {
  dates: string[];
  series: CfdSeriesRow[];
  wip_breaches: CfdSeriesResult["wip_breaches"];
  week_starts: string[];
} {
  if (dates.length === 0) {
    return { dates: [], series: [], wip_breaches: [], week_starts: [] };
  }

  const weekStarts: string[] = [];
  const dateToWeekIdx = new Map<string, number>();
  for (const d of dates) {
    const ws = startOfIsoWeek(d);
    let idx = dateToWeekIdx.get(ws);
    if (idx === undefined) {
      idx = weekStarts.length;
      dateToWeekIdx.set(ws, idx);
      weekStarts.push(ws);
    }
  }

  const labels = weekStarts.map((_, i) => `W${i + 1}`);

  const weekSeries = series.map(row => {
    const values = weekStarts.map(() => 0);
    const lastDayIdx = weekStarts.map(() => -1);
    dates.forEach((d, i) => {
      const wi = dateToWeekIdx.get(startOfIsoWeek(d));
      if (wi === undefined) return;
      if (i >= lastDayIdx[wi]) {
        lastDayIdx[wi] = i;
        values[wi] = Number(row.values[i] ?? 0);
      }
    });
    return { ...row, values };
  });

  const breachByKey = new Map<string, CfdSeriesResult["wip_breaches"][number]>();
  for (const b of breaches) {
    const wi = dateToWeekIdx.get(startOfIsoWeek(b.date));
    if (wi === undefined) continue;
    const label = labels[wi];
    const key = `${b.status_id}|${label}`;
    const existing = breachByKey.get(key);
    if (!existing || b.count > existing.count) {
      breachByKey.set(key, { ...b, date: label });
    }
  }

  return {
    dates: labels,
    series: weekSeries,
    wip_breaches: [...breachByKey.values()],
    week_starts: weekStarts,
  };
}

function computeBreaches(
  dates: string[],
  series: CfdSeriesRow[],
  thresholds: Record<string, number>
): CfdSeriesResult["wip_breaches"] {
  const breaches: CfdSeriesResult["wip_breaches"] = [];
  if (dates.length === 0 || Object.keys(thresholds).length === 0) return breaches;

  // Aggregate by status across groups for threshold checks
  const byStatus = new Map<string, number[]>();
  for (const row of series) {
    const existing = byStatus.get(row.status_id) ?? dates.map(() => 0);
    for (let i = 0; i < dates.length; i++) {
      existing[i] += Number(row.values[i] ?? 0);
    }
    byStatus.set(row.status_id, existing);
  }

  for (const [statusId, threshold] of Object.entries(thresholds)) {
    const values = byStatus.get(statusId);
    if (!values) continue;
    for (let i = 0; i < dates.length; i++) {
      if (values[i] > threshold) {
        breaches.push({
          status_id: statusId,
          date: dates[i],
          count: values[i],
          threshold,
        });
      }
    }
  }
  return breaches;
}

export async function getCfdSeries(
  filters: CfdSeriesFilters
): Promise<CfdSeriesResult> {
  const empty = (): CfdSeriesResult =>
    withLastUpdated({
      dates: [],
      statuses: filters.rollupByCategory
        ? CATEGORY_STATUS_META.map(s => ({ ...s }))
        : [],
      series: [],
      sprints: filters.sprintOverlay ? [] : null,
      indicators: {
        current_wip: 0,
        avg_throughput_per_day: 0,
        avg_cycle_days: null,
        avg_lead_days: null,
      },
      wip_breaches: [],
      meta: {
        group_by: filters.groupBy,
        smoothing: filters.smoothing,
        project_count: 0,
        rollup_by_category: filters.rollupByCategory,
        granularity: "week",
        week_starts: [],
      },
    });

  if (filters.projectIds.length === 0) return empty();

  const hash = cacheKeyHash(filters);
  // Namespace bumped when chart grain changed from day → week.
  const cacheNs = "cfd_week";
  const cached = await getAnalyticsCache<Omit<CfdSeriesResult, "last_updated_at">>(
    cacheNs,
    filters.sessionTeamId,
    hash
  );
  if (cached) {
    return withLastUpdated(cached.data, cached.lastUpdatedAt);
  }

  const today = new Date().toISOString().slice(0, 10);
  if (filters.dateTo >= today) {
    await captureTodaySnapshots(filters.projectIds);
  }
  await backfillRange(filters.projectIds, filters.dateFrom, filters.dateTo);

  const dailyDates = eachDateInclusive(filters.dateFrom, filters.dateTo);
  let statuses = await loadStatuses(filters.projectIds, filters.statusIds);

  let series =
    filters.groupBy === "all"
      ? await loadSnapshotSeries(filters, dailyDates, statuses)
      : await loadGroupedSeries(filters, dailyDates, statuses);

  if (filters.rollupByCategory) {
    const collapsed = collapseByCategory(statuses, series, dailyDates);
    statuses = collapsed.statuses;
    series = collapsed.series;
  } else if (filters.projectIds.length > 1 && filters.groupBy === "all") {
    const collapsed = collapseByStatusName(statuses, series, dailyDates);
    statuses = collapsed.statuses;
    series = collapsed.series;
  }

  series = applySmoothing(series, filters.smoothing);

  // KPIs stay day-based; chart/table roll up to weeks (mockup).
  const [indicators, sprints] = await Promise.all([
    loadIndicators(filters, dailyDates, statuses, series),
    loadSprints(filters),
  ]);

  const dailyBreaches = computeBreaches(dailyDates, series, filters.wipThresholds);
  const weekly = aggregateToWeeks(dailyDates, series, dailyBreaches);

  const payload: Omit<CfdSeriesResult, "last_updated_at"> = {
    dates: weekly.dates,
    statuses,
    series: weekly.series,
    sprints,
    indicators,
    wip_breaches: weekly.wip_breaches,
    meta: {
      group_by: filters.groupBy,
      smoothing: filters.smoothing,
      project_count: filters.projectIds.length,
      rollup_by_category: filters.rollupByCategory,
      granularity: "week",
      week_starts: weekly.week_starts,
    },
  };

  const cachedPayload = await setAnalyticsCache(payload, [
    cacheNs,
    filters.sessionTeamId,
    hash,
  ]);

  return withLastUpdated(payload, cachedPayload.lastUpdatedAt);
}

export function buildCfdCsvMatrix(data: CfdSeriesResult): string {
  const statusById = new Map(data.statuses.map(s => [s.id, s]));
  const columns = data.series.map(row => {
    const statusName = statusById.get(row.status_id)?.name ?? row.status_id;
    if (row.group_name) return `${statusName} / ${row.group_name}`;
    return statusName;
  });

  const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;
  const periodHeader = data.meta.granularity === "week" ? "Week" : "Date";
  const header = [periodHeader, ...columns].map(escape).join(",");
  const lines = [header];

  for (let i = 0; i < data.dates.length; i++) {
    const cells = [
      escape(data.dates[i]),
      ...data.series.map(row => String(row.values[i] ?? 0)),
    ];
    lines.push(cells.join(","));
  }

  return lines.join("\n");
}
