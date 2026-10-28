import { createHash } from "crypto";
import db from "../../config/db";
import {
  getAnalyticsCache,
  setAnalyticsCache,
  withLastUpdated,
} from "../../redis/analytics-cache";

export interface PlannedVsActualTasksFilters {
  projectIds: string[];
  memberIds: string[];
  teamIds: string[];
  sessionTeamId: string;
}

export interface PlannedVsActualTasksRow {
  project_id: string;
  project_name: string;
  planned: number;
  completed: number;
  overdue: number;
  variance_days: number;
  updated_at: string | null;
}

export interface PlannedVsActualTasksKpis {
  planned: number;
  completed: number;
  completed_pct_of_plan: number;
  overdue: number;
  avg_variance_days: number;
}

export interface PlannedVsActualTasksResult {
  projects: PlannedVsActualTasksRow[];
  kpis: PlannedVsActualTasksKpis;
  meta: {
    project_count: number;
  };
  last_updated_at: string;
}

/** Safety cap only — high enough for org portfolios (chart still shows latest 20). */
const MAX_PROJECTS = 5000;

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

export function parsePlannedVsActualTasksFilters(
  query: Record<string, unknown>,
  accessibleProjectIds: string[],
  sessionTeamId: string
): PlannedVsActualTasksFilters {
  let projectIds = parseCsvIds(query.project_ids);
  if (projectIds.length === 0) {
    projectIds = [...accessibleProjectIds];
  } else {
    const allowed = new Set(accessibleProjectIds);
    projectIds = projectIds.filter(id => allowed.has(id));
  }

  if (projectIds.length > MAX_PROJECTS) {
    projectIds = projectIds.slice(0, MAX_PROJECTS);
  }

  return {
    projectIds,
    memberIds: parseCsvIds(query.member_ids),
    teamIds: parseCsvIds(query.team_ids),
    sessionTeamId,
  };
}

function cacheParts(filters: PlannedVsActualTasksFilters): Array<string | number> {
  const payload = JSON.stringify({
    p: [...filters.projectIds].sort(),
    m: [...filters.memberIds].sort(),
    t: [...filters.teamIds].sort(),
    st: filters.sessionTeamId,
  });
  return ["planned-vs-actual-tasks", createHash("sha1").update(payload).digest("hex")];
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

type Payload = Omit<PlannedVsActualTasksResult, "last_updated_at">;

export async function getPlannedVsActualTasksSeries(
  filters: PlannedVsActualTasksFilters
): Promise<PlannedVsActualTasksResult> {
  if (filters.projectIds.length === 0) {
    return withLastUpdated({
      projects: [],
      kpis: {
        planned: 0,
        completed: 0,
        completed_pct_of_plan: 0,
        overdue: 0,
        avg_variance_days: 0,
      },
      meta: { project_count: 0 },
    });
  }

  const parts = cacheParts(filters);
  const cached = await getAnalyticsCache<Payload>(...parts);
  if (cached) {
    return withLastUpdated(cached.data, cached.lastUpdatedAt);
  }

  const params: unknown[] = [filters.projectIds];
  let param = 2;

  let memberClause = "";
  if (filters.memberIds.length > 0) {
    memberClause = `
      AND EXISTS (
        SELECT 1
        FROM project_members pm_f
        WHERE pm_f.project_id = p.id
          AND pm_f.team_member_id = ANY($${param}::UUID[])
          AND pm_f.project_access_level_id = (
            SELECT id FROM project_access_levels WHERE key = 'PROJECT_MANAGER'
          )
      )`;
    params.push(filters.memberIds);
    param += 1;
  }

  let teamClause = "";
  if (filters.teamIds.length > 0) {
    teamClause = `AND p.team_id = ANY($${param}::UUID[])`;
    params.push(filters.teamIds);
    param += 1;
  }

  const q = `
    SELECT
      p.id AS project_id,
      p.name AS project_name,
      TO_CHAR(p.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS updated_at,
      COALESCE((
        SELECT COUNT(*)::INT
        FROM tasks ta
        WHERE ta.project_id = p.id AND ta.archived IS FALSE
      ), 0) AS planned,
      COALESCE((
        SELECT COUNT(*)::INT
        FROM tasks ta
        WHERE ta.project_id = p.id
          AND ta.archived IS FALSE
          AND is_completed(ta.status_id, ta.project_id) IS TRUE
      ), 0) AS completed,
      COALESCE((
        SELECT COUNT(*)::INT
        FROM tasks ta
        WHERE ta.project_id = p.id
          AND ta.archived IS FALSE
          AND is_overdue(ta.id) IS TRUE
      ), 0) AS overdue,
      COALESCE((
        SELECT AVG(v.days)::FLOAT
        FROM (
          SELECT
            CASE
              WHEN ta.end_date IS NULL THEN NULL
              WHEN is_completed(ta.status_id, ta.project_id) IS TRUE
                AND ta.completed_at IS NOT NULL
                THEN (ta.completed_at::DATE - ta.end_date::DATE)
              WHEN is_completed(ta.status_id, ta.project_id) IS FALSE
                AND ta.end_date::DATE < CURRENT_DATE
                THEN (CURRENT_DATE - ta.end_date::DATE)
              ELSE NULL
            END AS days
          FROM tasks ta
          WHERE ta.project_id = p.id
            AND ta.archived IS FALSE
            AND ta.end_date IS NOT NULL
        ) v
        WHERE v.days IS NOT NULL
      ), 0)::FLOAT AS variance_days
    FROM projects p
    WHERE p.id = ANY($1::UUID[])
      ${memberClause}
      ${teamClause}
    ORDER BY LOWER(p.name) ASC
  `;

  const result = await db.query(q, params);

  const projects: PlannedVsActualTasksRow[] = result.rows.map((row: Record<string, unknown>) => ({
    project_id: String(row.project_id),
    project_name: String(row.project_name),
    planned: Number(row.planned) || 0,
    completed: Number(row.completed) || 0,
    overdue: Number(row.overdue) || 0,
    variance_days: round1(Number(row.variance_days) || 0),
    updated_at: row.updated_at ? String(row.updated_at) : null,
  }));

  const plannedSum = projects.reduce((sum, p) => sum + p.planned, 0);
  const completedSum = projects.reduce((sum, p) => sum + p.completed, 0);
  const overdueSum = projects.reduce((sum, p) => sum + p.overdue, 0);
  const avgVariance =
    projects.length > 0
      ? round1(projects.reduce((sum, p) => sum + p.variance_days, 0) / projects.length)
      : 0;

  const kpis: PlannedVsActualTasksKpis = {
    planned: plannedSum,
    completed: completedSum,
    completed_pct_of_plan:
      plannedSum > 0 ? Math.round((completedSum / plannedSum) * 100) : 0,
    overdue: overdueSum,
    avg_variance_days: avgVariance,
  };

  const payload: Payload = {
    projects,
    kpis,
    meta: { project_count: projects.length },
  };

  const stored = await setAnalyticsCache(payload, parts);
  return withLastUpdated(payload, stored.lastUpdatedAt);
}

export function buildPlannedVsActualTasksCsv(result: PlannedVsActualTasksResult): string {
  const header = ["Project", "Planned tasks", "Completed", "Overdue", "Variance (days)"];
  const lines = [header.join(",")];
  for (const row of result.projects) {
    const cells = [
      csvEscape(row.project_name),
      String(row.planned),
      String(row.completed),
      String(row.overdue),
      String(row.variance_days),
    ];
    lines.push(cells.join(","));
  }
  return lines.join("\n");
}

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
