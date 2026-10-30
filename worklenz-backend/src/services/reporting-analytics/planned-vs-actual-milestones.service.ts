import { createHash } from "crypto";
import db from "../../config/db";
import {
  getAnalyticsCache,
  setAnalyticsCache,
  withLastUpdated,
} from "../../redis/analytics-cache";
import { sanitizeCsvFormulaValue } from "../../shared/csv-utils";

export interface PlannedVsActualMilestonesFilters {
  projectIds: string[];
  memberIds: string[];
  teamIds: string[];
  sessionTeamId: string;
}

export interface PlannedVsActualMilestonesRow {
  milestone_id: string;
  milestone_name: string;
  project_id: string;
  project_name: string;
  planned_date: string;
  actual_date: string | null;
  variance_days: number;
  status: string;
}

export interface PlannedVsActualMilestonesKpis {
  milestones: number;
  late: number;
  on_time: number;
  avg_slip_days: number;
}

export interface PlannedVsActualMilestonesResult {
  milestones: PlannedVsActualMilestonesRow[];
  kpis: PlannedVsActualMilestonesKpis;
  meta: {
    milestone_count: number;
  };
  last_updated_at: string;
}

const MAX_PROJECTS = 50;
const MAX_MILESTONES = 200;

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

export function parsePlannedVsActualMilestonesFilters(
  query: Record<string, unknown>,
  accessibleProjectIds: string[],
  sessionTeamId: string
): PlannedVsActualMilestonesFilters {
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

function cacheParts(filters: PlannedVsActualMilestonesFilters): Array<string | number> {
  const payload = JSON.stringify({
    p: [...filters.projectIds].sort(),
    m: [...filters.memberIds].sort(),
    t: [...filters.teamIds].sort(),
    st: filters.sessionTeamId,
  });
  return ["planned-vs-actual-milestones", createHash("sha1").update(payload).digest("hex")];
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

type Payload = Omit<PlannedVsActualMilestonesResult, "last_updated_at">;

export async function getPlannedVsActualMilestonesSeries(
  filters: PlannedVsActualMilestonesFilters
): Promise<PlannedVsActualMilestonesResult> {
  if (filters.projectIds.length === 0) {
    return withLastUpdated({
      milestones: [],
      kpis: { milestones: 0, late: 0, on_time: 0, avg_slip_days: 0 },
      meta: { milestone_count: 0 },
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
      m.id AS milestone_id,
      m.name AS milestone_name,
      p.id AS project_id,
      p.name AS project_name,
      TO_CHAR(m.target_date, 'YYYY-MM-DD') AS planned_date,
      CASE
        WHEN m.completed_at IS NOT NULL THEN TO_CHAR(m.completed_at, 'YYYY-MM-DD')
        ELSE NULL
      END AS actual_date,
      m.status,
      CASE
        WHEN m.completed_at IS NOT NULL THEN (m.completed_at - m.target_date)
        WHEN m.status = 'delayed' OR m.target_date < CURRENT_DATE
          THEN (CURRENT_DATE - m.target_date)
        ELSE 0
      END::INT AS variance_days
    FROM client_portal_milestones m
    JOIN projects p ON p.id = m.project_id
    WHERE m.project_id = ANY($1::UUID[])
      ${memberClause}
      ${teamClause}
    ORDER BY m.target_date ASC, LOWER(m.name) ASC
    LIMIT ${MAX_MILESTONES}
  `;

  const result = await db.query(q, params);

  const milestones: PlannedVsActualMilestonesRow[] = result.rows.map(
    (row: Record<string, unknown>) => ({
      milestone_id: String(row.milestone_id),
      milestone_name: String(row.milestone_name),
      project_id: String(row.project_id),
      project_name: String(row.project_name),
      planned_date: String(row.planned_date),
      actual_date: row.actual_date ? String(row.actual_date) : null,
      variance_days: Number(row.variance_days) || 0,
      status: String(row.status || "upcoming"),
    })
  );

  const late = milestones.filter(m => m.variance_days > 0).length;
  const onTime = milestones.filter(m => m.variance_days <= 0).length;
  const avgSlip =
    milestones.length > 0
      ? round1(milestones.reduce((sum, m) => sum + m.variance_days, 0) / milestones.length)
      : 0;

  const kpis: PlannedVsActualMilestonesKpis = {
    milestones: milestones.length,
    late,
    on_time: onTime,
    avg_slip_days: avgSlip,
  };

  const payload: Payload = {
    milestones,
    kpis,
    meta: { milestone_count: milestones.length },
  };

  const stored = await setAnalyticsCache(payload, parts);
  return withLastUpdated(payload, stored.lastUpdatedAt);
}

export function buildPlannedVsActualMilestonesCsv(
  result: PlannedVsActualMilestonesResult
): string {
  const header = ["Milestone", "Project", "Planned date", "Actual date", "Variance (days)"];
  const lines = [header.join(",")];
  for (const row of result.milestones) {
    const cells = [
      csvEscape(row.milestone_name),
      csvEscape(row.project_name),
      csvEscape(row.planned_date),
      csvEscape(row.actual_date || ""),
      String(row.variance_days),
    ];
    lines.push(cells.join(","));
  }
  return lines.join("\n");
}

function csvEscape(value: string): string {
  const text = sanitizeCsvFormulaValue(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}
