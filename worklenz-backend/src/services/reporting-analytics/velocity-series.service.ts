import { createHash } from "crypto";
import db from "../../config/db";
import {
  getAnalyticsCache,
  setAnalyticsCache,
  withLastUpdated,
} from "../../redis/analytics-cache";
import {
  backfillVelocityGaps,
  resolveVelocityBucket,
  type VelocityBucketKind,
} from "./velocity-aggregator.service";

export type VelocityViewBy = "project" | "member" | "team";
export type VelocityMetric = "story_points" | "issue_count";

export interface VelocitySeriesFilters {
  viewBy: VelocityViewBy;
  projectIds: string[];
  memberIds: string[];
  teamIds: string[];
  sprintCount: number;
  dateFrom?: string | null;
  dateTo?: string | null;
  metric: VelocityMetric;
  avgWindow: number;
  trend: boolean;
  /** Active session team — used for cache keys and default scope */
  sessionTeamId: string;
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
  stacks?: Array<{
    id: string;
    name: string;
    committed: number;
    completed: number;
  }>;
  overlays?: Array<{
    id: string;
    name: string;
    committed: number;
    completed: number;
  }>;
}

export interface VelocitySeriesResult {
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
    /** sprint = software, phase = general, mixed = both project types selected */
    bucket: VelocityBucketKind;
  };
  last_updated_at: string;
}

const DEFAULT_SPRINT_COUNT = 6;
const MAX_SPRINT_COUNT = 30;
const DEFAULT_AVG_WINDOW = 3;

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

export function parseVelocityFilters(
  query: Record<string, unknown>,
  accessibleProjectIds: string[],
  sessionTeamId: string
): VelocitySeriesFilters {
  const viewRaw = String(query.view_by ?? "project");
  const viewBy: VelocityViewBy =
    viewRaw === "member" || viewRaw === "team" ? viewRaw : "project";

  const metricRaw = String(query.metric ?? "story_points");
  const metric: VelocityMetric =
    metricRaw === "issue_count" ? "issue_count" : "story_points";

  let projectIds = parseCsvIds(query.project_ids);
  if (projectIds.length === 0) {
    projectIds = [...accessibleProjectIds];
  } else {
    const allowed = new Set(accessibleProjectIds);
    projectIds = projectIds.filter(id => allowed.has(id));
  }

  let sprintCount = Number(query.sprint_count ?? DEFAULT_SPRINT_COUNT);
  if (!Number.isFinite(sprintCount) || sprintCount < 1) sprintCount = DEFAULT_SPRINT_COUNT;
  sprintCount = Math.min(Math.floor(sprintCount), MAX_SPRINT_COUNT);

  let avgWindow = Number(query.avg_window ?? DEFAULT_AVG_WINDOW);
  if (!Number.isFinite(avgWindow) || avgWindow < 1) avgWindow = DEFAULT_AVG_WINDOW;
  avgWindow = Math.min(Math.floor(avgWindow), MAX_SPRINT_COUNT);

  return {
    viewBy,
    projectIds,
    memberIds: parseCsvIds(query.member_ids),
    teamIds: parseCsvIds(query.team_ids),
    sprintCount,
    dateFrom: typeof query.date_from === "string" ? query.date_from : null,
    dateTo: typeof query.date_to === "string" ? query.date_to : null,
    metric,
    avgWindow,
    trend: String(query.trend ?? "false") === "true",
    sessionTeamId,
  };
}

function cacheKeyHash(filters: VelocitySeriesFilters): string {
  return createHash("sha1").update(JSON.stringify(filters)).digest("hex").slice(0, 16);
}

function metricCommitted(
  row: {
    committed_issue_count?: number;
    committed_points?: number;
  },
  metric: VelocityMetric
): number {
  return metric === "issue_count"
    ? Number(row.committed_issue_count ?? 0)
    : Number(row.committed_points ?? 0);
}

function metricCompleted(
  row: {
    completed_issue_count?: number;
    completed_points?: number;
  },
  metric: VelocityMetric
): number {
  return metric === "issue_count"
    ? Number(row.completed_issue_count ?? 0)
    : Number(row.completed_points ?? 0);
}

function rollingAverage(values: number[], window: number): Array<number | null> {
  return values.map((_, index) => {
    const start = Math.max(0, index - window + 1);
    const slice = values.slice(start, index + 1);
    if (slice.length === 0) return null;
    const sum = slice.reduce((a, b) => a + b, 0);
    return Math.round((sum / slice.length) * 100) / 100;
  });
}

/** Simple least-squares trend line across completed values. */
function linearTrend(values: number[]): Array<number | null> {
  const n = values.length;
  if (n < 2) return values.map(() => null);
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += values[i];
    sumXY += i * values[i];
    sumXX += i * i;
  }
  const denom = n * sumXX - sumX * sumX;
  if (denom === 0) return values.map(() => null);
  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  return values.map((_, i) => Math.round((intercept + slope * i) * 100) / 100);
}

interface CacheRow {
  sprint_id: string;
  sprint_name: string;
  project_id: string;
  team_id: string;
  project_name?: string;
  team_name?: string;
  completed_at: Date | string | null;
  start_date: Date | string | null;
  end_date: Date | string | null;
  committed_points: number;
  completed_points: number;
  committed_issue_count: number;
  completed_issue_count: number;
  commitment_accuracy: number | null;
  member_breakdown: unknown;
}

function toIso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function parseMemberBreakdown(raw: unknown): Array<{
  team_member_id: string;
  name: string;
  committed_points: number;
  completed_points: number;
  committed_issue_count: number;
  completed_issue_count: number;
}> {
  if (!raw) return [];
  const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
  if (!Array.isArray(parsed)) return [];
  return parsed as Array<{
    team_member_id: string;
    name: string;
    committed_points: number;
    completed_points: number;
    committed_issue_count: number;
    completed_issue_count: number;
  }>;
}

export async function getVelocitySeries(
  filters: VelocitySeriesFilters
): Promise<VelocitySeriesResult> {
  const bucket = await resolveVelocityBucket(filters.projectIds);

  if (filters.projectIds.length === 0) {
    return withLastUpdated({
      series: [],
      average_line: [],
      trend_line: null,
      kpis: {
        avg_velocity: 0,
        last_sprint_velocity: null,
        commitment_accuracy_pct: null,
        completed_sprint_count: 0,
      },
      meta: {
        min_sprints_met: false,
        view_by: filters.viewBy,
        metric: filters.metric,
        avg_window: filters.avgWindow,
        bucket,
      },
    });
  }

  const hash = cacheKeyHash(filters);
  // General-project phases use live task metrics — skip Redis so charts stay current.
  const useSeriesCache = bucket === "sprint";
  if (useSeriesCache) {
    const cached = await getAnalyticsCache<Omit<VelocitySeriesResult, "last_updated_at">>(
      "velocity",
      filters.sessionTeamId,
      hash
    );
    if (cached) {
      return withLastUpdated(
        { ...cached.data, meta: { ...cached.data.meta, bucket } },
        cached.lastUpdatedAt
      );
    }
  }

  if (filters.projectIds.length > 0) {
    await backfillVelocityGaps(filters.projectIds);
  }

  const params: unknown[] = [];
  const push = (value: unknown) => {
    params.push(value);
    return `$${params.length}`;
  };

  const projectTeamsResult = await db.query(
    `SELECT DISTINCT team_id::TEXT AS team_id FROM projects WHERE id = ANY($1::UUID[])`,
    [filters.projectIds]
  );
  const accessibleTeamIds = new Set<string>([
    filters.sessionTeamId,
    ...projectTeamsResult.rows.map((row: { team_id: string }) => row.team_id),
  ]);
  const requestedTeams =
    filters.teamIds.length > 0 ? filters.teamIds : [filters.sessionTeamId];
  const teamScopeIds = requestedTeams.filter(id => accessibleTeamIds.has(id));
  if (teamScopeIds.length === 0) {
    return withLastUpdated({
      series: [],
      average_line: [],
      trend_line: null,
      kpis: {
        avg_velocity: 0,
        last_sprint_velocity: null,
        commitment_accuracy_pct: null,
        completed_sprint_count: 0,
      },
      meta: {
        min_sprints_met: false,
        view_by: filters.viewBy,
        metric: filters.metric,
        avg_window: filters.avgWindow,
        bucket,
      },
    });
  }

  let where = `vsc.team_id = ANY(${push(teamScopeIds)}::UUID[])`;
  where += ` AND vsc.project_id = ANY(${push(filters.projectIds)}::UUID[])`;

  // Date range applies to completed software sprints only. General-project phases
  // are structural buckets (like sprints), so include all phases with task activity.
  if (bucket === "sprint") {
    if (filters.dateFrom) {
      where += ` AND vsc.completed_at >= ${push(filters.dateFrom)}::TIMESTAMPTZ`;
    }
    if (filters.dateTo) {
      where += ` AND vsc.completed_at <= ${push(filters.dateTo)}::TIMESTAMPTZ`;
    }
  }

  const limitParam = push(filters.sprintCount);

  const q = `
    SELECT vsc.sprint_id, vsc.sprint_name, vsc.project_id, vsc.team_id,
           p.name AS project_name, t.name AS team_name,
           vsc.completed_at, vsc.start_date, vsc.end_date,
           vsc.committed_points, vsc.completed_points,
           vsc.committed_issue_count, vsc.completed_issue_count,
           vsc.commitment_accuracy, vsc.member_breakdown
    FROM velocity_sprint_cache vsc
    INNER JOIN projects p ON p.id = vsc.project_id
    INNER JOIN teams t ON t.id = vsc.team_id
    WHERE ${where}
    ORDER BY COALESCE(vsc.completed_at, vsc.end_date, vsc.start_date) DESC NULLS LAST
    LIMIT ${limitParam}`;

  const result = await db.query(q, params);
  const rows = (result.rows as CacheRow[]).reverse();

  const series: VelocitySeriesPoint[] = rows.map(row => {
    const committed = metricCommitted(row, filters.metric);
    const completed = metricCompleted(row, filters.metric);
    const point: VelocitySeriesPoint = {
      sprint_id: row.sprint_id,
      sprint_name: row.sprint_name,
      project_id: row.project_id,
      team_id: row.team_id,
      completed_at: toIso(row.completed_at),
      start_date: toIso(row.start_date),
      end_date: toIso(row.end_date),
      committed,
      completed,
      commitment_accuracy:
        row.commitment_accuracy === null || row.commitment_accuracy === undefined
          ? commitmentPct(committed, completed)
          : Number(row.commitment_accuracy),
    };

    if (filters.viewBy === "member") {
      const members = parseMemberBreakdown(row.member_breakdown);
      const filtered =
        filters.memberIds.length > 0
          ? members.filter(m => filters.memberIds.includes(m.team_member_id))
          : members;
      point.stacks = filtered.map(m => ({
        id: m.team_member_id,
        name: m.name,
        committed:
          filters.metric === "issue_count"
            ? Number(m.committed_issue_count ?? 0)
            : Number(m.committed_points ?? 0),
        completed:
          filters.metric === "issue_count"
            ? Number(m.completed_issue_count ?? 0)
            : Number(m.completed_points ?? 0),
      }));
    }

    if (filters.viewBy === "team") {
      point.overlays = [
        {
          id: row.team_id,
          name: row.team_name ?? row.team_id,
          committed,
          completed,
        },
      ];
    }

    if (filters.viewBy === "project") {
      point.overlays = [
        {
          id: row.project_id,
          name: row.project_name ?? row.project_id,
          committed,
          completed,
        },
      ];
    }

    return point;
  });

  // Multi-team overlay: align by chronological index across teams when multiple teams selected
  let finalSeries = series;
  if (filters.viewBy === "team" && teamScopeIds.length > 1) {
    finalSeries = buildTeamOverlaySeries(rows, filters);
  }

  const completedValues = finalSeries.map(p => p.completed);
  const avgValues = rollingAverage(completedValues, filters.avgWindow);
  const average_line = finalSeries.map((p, i) => ({
    sprint_id: p.sprint_id,
    value: avgValues[i],
  }));

  const trend_line = filters.trend
    ? finalSeries.map((p, i) => ({
        sprint_id: p.sprint_id,
        value: linearTrend(completedValues)[i],
      }))
    : null;

  const sprintCount = finalSeries.length;
  const avgVelocity =
    sprintCount === 0
      ? 0
      : Math.round(
          (completedValues.reduce((a, b) => a + b, 0) / sprintCount) * 100
        ) / 100;
  const last = finalSeries[sprintCount - 1] ?? null;
  const commitmentValues = finalSeries
    .map(p => p.commitment_accuracy)
    .filter((v): v is number => v !== null && Number.isFinite(v));
  const commitmentAvg =
    commitmentValues.length === 0
      ? null
      : Math.round(
          (commitmentValues.reduce((a, b) => a + b, 0) / commitmentValues.length) * 100
        ) / 100;

  const payload: Omit<VelocitySeriesResult, "last_updated_at"> = {
    series: finalSeries,
    average_line,
    trend_line,
    kpis: {
      avg_velocity: avgVelocity,
      last_sprint_velocity: last ? last.completed : null,
      commitment_accuracy_pct: commitmentAvg,
      completed_sprint_count: sprintCount,
    },
    meta: {
      min_sprints_met: sprintCount >= 2,
      view_by: filters.viewBy,
      metric: filters.metric,
      avg_window: filters.avgWindow,
      bucket,
    },
  };

  if (useSeriesCache) {
    const stored = await setAnalyticsCache(payload, [
      "velocity",
      filters.sessionTeamId,
      hash,
    ]);
    return withLastUpdated(payload, stored.lastUpdatedAt);
  }

  return withLastUpdated(payload);
}

function commitmentPct(committed: number, completed: number): number | null {
  if (!committed || committed <= 0) return null;
  return Math.round((completed / committed) * 10000) / 100;
}

/** Build time-aligned overlay series when comparing multiple teams. */
function buildTeamOverlaySeries(
  rows: CacheRow[],
  filters: VelocitySeriesFilters
): VelocitySeriesPoint[] {
  const byTeam = new Map<string, CacheRow[]>();
  for (const row of rows) {
    const list = byTeam.get(row.team_id) ?? [];
    list.push(row);
    byTeam.set(row.team_id, list);
  }

  const maxLen = Math.max(0, ...[...byTeam.values()].map(l => l.length));
  const points: VelocitySeriesPoint[] = [];

  for (let i = 0; i < maxLen; i++) {
    const overlays: NonNullable<VelocitySeriesPoint["overlays"]> = [];
    let labelSprint: CacheRow | null = null;
    let committedSum = 0;
    let completedSum = 0;

    for (const [teamId, list] of byTeam) {
      const row = list[i];
      if (!row) continue;
      if (!labelSprint) labelSprint = row;
      const committed = metricCommitted(row, filters.metric);
      const completed = metricCompleted(row, filters.metric);
      committedSum += committed;
      completedSum += completed;
      overlays.push({
        id: teamId,
        name: row.team_name ?? teamId,
        committed,
        completed,
      });
    }

    if (!labelSprint) continue;

    points.push({
      sprint_id: `slot-${i}-${labelSprint.sprint_id}`,
      sprint_name: labelSprint.sprint_name,
      project_id: labelSprint.project_id,
      team_id: labelSprint.team_id,
      completed_at: toIso(labelSprint.completed_at),
      start_date: toIso(labelSprint.start_date),
      end_date: toIso(labelSprint.end_date),
      committed: committedSum,
      completed: completedSum,
      commitment_accuracy: commitmentPct(committedSum, completedSum),
      overlays,
    });
  }

  return points;
}
