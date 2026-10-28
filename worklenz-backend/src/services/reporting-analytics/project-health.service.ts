import { createHash } from "crypto";
import db from "../../config/db";
import {
  getAnalyticsCache,
  setAnalyticsCache,
  withLastUpdated,
} from "../../redis/analytics-cache";
import { getOrgFinanceSettings } from "../../controllers/finance-overview-controller";
import { buildRateSql } from "../../shared/finance-rate";

/** Mockup labels mapped from sys_project_healths names. */
export type ProjectHealthTone = "on_track" | "at_risk" | "off_track" | "not_set";

export interface ProjectHealthFilters {
  projectIds: string[];
  healthIds: string[];
  memberIds: string[];
  teamIds: string[];
  sessionTeamId: string;
}

export interface ProjectHealthRow {
  project_id: string;
  project_name: string;
  health_id: string | null;
  health_name: string;
  health_color: string;
  health_tone: ProjectHealthTone;
  progress_pct: number;
  budget_used_pct: number;
  due_date: string | null;
  open_tasks: number;
  overdue_tasks: number;
  budget: number;
  lead_name: string | null;
}

export interface ProjectHealthKpis {
  on_track: number;
  at_risk: number;
  off_track: number;
  not_set: number;
  overdue_tasks: number;
}

export interface ProjectHealthResult {
  projects: ProjectHealthRow[];
  kpis: ProjectHealthKpis;
  meta: {
    project_count: number;
  };
  last_updated_at: string;
}

/** Safety cap only — high enough for org portfolios; was 50 and under-counted KPIs/donut. */
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

export function mapHealthTone(name: string | null | undefined): ProjectHealthTone {
  const n = (name || "").trim().toLowerCase();
  if (n === "good") return "on_track";
  if (n === "at risk") return "at_risk";
  if (n === "needs attention") return "off_track";
  return "not_set";
}

export function parseProjectHealthFilters(
  query: Record<string, unknown>,
  accessibleProjectIds: string[],
  sessionTeamId: string
): ProjectHealthFilters {
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
    healthIds: parseCsvIds(query.health_ids),
    memberIds: parseCsvIds(query.member_ids),
    teamIds: parseCsvIds(query.team_ids),
    sessionTeamId,
  };
}

function cacheParts(
  filters: ProjectHealthFilters,
  calcMethod: string,
  hoursPerDay: number
): Array<string | number> {
  const payload = JSON.stringify({
    p: [...filters.projectIds].sort(),
    h: [...filters.healthIds].sort(),
    m: [...filters.memberIds].sort(),
    t: [...filters.teamIds].sort(),
    st: filters.sessionTeamId,
    cm: calcMethod,
    hpd: hoursPerDay,
  });
  return ["project-health", createHash("sha1").update(payload).digest("hex")];
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

type ProjectHealthPayload = Omit<ProjectHealthResult, "last_updated_at">;

export async function getProjectHealthSeries(
  filters: ProjectHealthFilters
): Promise<ProjectHealthResult> {
  if (filters.projectIds.length === 0) {
    return withLastUpdated({
      projects: [],
      kpis: { on_track: 0, at_risk: 0, off_track: 0, not_set: 0, overdue_tasks: 0 },
      meta: { project_count: 0 },
    });
  }

  const { calcMethod, hoursPerDay } = await getOrgFinanceSettings(filters.sessionTeamId);
  const parts = cacheParts(filters, calcMethod, hoursPerDay);
  const cached = await getAnalyticsCache<ProjectHealthPayload>(...parts);
  if (cached) {
    return withLastUpdated(cached.data, cached.lastUpdatedAt);
  }

  const rateSql = buildRateSql(calcMethod, hoursPerDay);
  const params: unknown[] = [filters.projectIds];
  let param = 2;

  let healthClause = "";
  if (filters.healthIds.length > 0) {
    healthClause = `AND p.health_id = ANY($${param}::UUID[])`;
    params.push(filters.healthIds);
    param += 1;
  }

  let memberClause = "";
  if (filters.memberIds.length > 0) {
    // Filter to projects where selected team members are project managers
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
      p.health_id,
      COALESCE(sph.name, 'Not Set') AS health_name,
      COALESCE(sph.color_code, '#a9a9a9') AS health_color,
      TO_CHAR(p.end_date::DATE, 'YYYY-MM-DD') AS due_date,
      COALESCE(p.budget, 0)::FLOAT AS budget,
      (
        SELECT tmiv.name
        FROM project_members pm
        JOIN team_member_info_view tmiv
          ON tmiv.team_member_id = pm.team_member_id
         AND tmiv.team_id = p.team_id
        WHERE pm.project_id = p.id
          AND pm.project_access_level_id = (
            SELECT id FROM project_access_levels WHERE key = 'PROJECT_MANAGER'
          )
        LIMIT 1
      ) AS lead_name,
      COALESCE((
        SELECT COUNT(*)::INT
        FROM tasks ta
        WHERE ta.project_id = p.id
          AND ta.archived IS FALSE
          AND is_completed(ta.status_id, ta.project_id) IS FALSE
      ), 0) AS open_tasks,
      COALESCE((
        SELECT COUNT(*)::INT
        FROM tasks ta
        WHERE ta.project_id = p.id
          AND ta.archived IS FALSE
          AND is_overdue(ta.id) IS TRUE
      ), 0) AS overdue_tasks,
      COALESCE((
        SELECT COUNT(*)::INT
        FROM tasks ta
        WHERE ta.project_id = p.id AND ta.archived IS FALSE
      ), 0) AS total_tasks,
      COALESCE((
        SELECT COUNT(*)::INT
        FROM tasks ta
        WHERE ta.project_id = p.id
          AND ta.archived IS FALSE
          AND is_completed(ta.status_id, ta.project_id) IS TRUE
      ), 0) AS done_tasks,
      COALESCE((
        SELECT SUM(COALESCE(t.fixed_cost, 0))
        FROM tasks t
        WHERE t.project_id = p.id AND t.archived = false
      ), 0)::FLOAT AS fixed_cost,
      COALESCE((
        SELECT SUM((wl.time_spent / 3600.0) * ${rateSql})
        FROM tasks t
        JOIN task_work_log wl ON wl.task_id = t.id
        LEFT JOIN users u ON wl.user_id = u.id
        LEFT JOIN team_members tm
          ON tm.user_id = u.id AND tm.team_id = p.team_id
        LEFT JOIN project_members pm
          ON pm.team_member_id = tm.id AND pm.project_id = t.project_id
        LEFT JOIN finance_project_rate_card_roles fprr
          ON fprr.id = pm.project_rate_card_role_id
        WHERE t.project_id = p.id AND t.archived = false
      ), 0)::FLOAT AS time_based_cost
    FROM projects p
    LEFT JOIN sys_project_healths sph ON sph.id = p.health_id
    WHERE p.id = ANY($1::UUID[])
      ${healthClause}
      ${memberClause}
      ${teamClause}
    ORDER BY LOWER(p.name) ASC
  `;

  const result = await db.query(q, params);

  const projects: ProjectHealthRow[] = result.rows.map((row: Record<string, unknown>) => {
    const total = Number(row.total_tasks) || 0;
    const done = Number(row.done_tasks) || 0;
    const budget = Number(row.budget) || 0;
    const actualCost = (Number(row.fixed_cost) || 0) + (Number(row.time_based_cost) || 0);
    const progressPct = total > 0 ? round1((done / total) * 100) : 0;
    const budgetUsedPct =
      budget > 0 ? round1(Math.min(999, (actualCost / budget) * 100)) : 0;
    const healthName = String(row.health_name || "Not Set");

    return {
      project_id: String(row.project_id),
      project_name: String(row.project_name),
      health_id: row.health_id ? String(row.health_id) : null,
      health_name: healthName,
      health_color: String(row.health_color || "#a9a9a9"),
      health_tone: mapHealthTone(healthName),
      progress_pct: progressPct,
      budget_used_pct: budgetUsedPct,
      due_date: row.due_date ? String(row.due_date) : null,
      open_tasks: Number(row.open_tasks) || 0,
      overdue_tasks: Number(row.overdue_tasks) || 0,
      budget,
      lead_name: row.lead_name ? String(row.lead_name) : null,
    };
  });

  const kpis: ProjectHealthKpis = {
    on_track: projects.filter(p => p.health_tone === "on_track").length,
    at_risk: projects.filter(p => p.health_tone === "at_risk").length,
    off_track: projects.filter(p => p.health_tone === "off_track").length,
    not_set: projects.filter(p => p.health_tone === "not_set").length,
    overdue_tasks: projects.reduce((sum, p) => sum + p.overdue_tasks, 0),
  };

  const payload: ProjectHealthPayload = {
    projects,
    kpis,
    meta: { project_count: projects.length },
  };

  const stored = await setAnalyticsCache(payload, parts);
  return withLastUpdated(payload, stored.lastUpdatedAt);
}

export function buildProjectHealthCsv(result: ProjectHealthResult): string {
  const header = [
    "Project",
    "Health",
    "Progress %",
    "Due",
    "Open tasks",
    "Overdue",
    "Budget used %",
    "Project lead",
  ];
  const lines = [header.join(",")];
  for (const row of result.projects) {
    const cells = [
      csvEscape(row.project_name),
      csvEscape(row.health_name),
      String(row.progress_pct),
      csvEscape(row.due_date || ""),
      String(row.open_tasks),
      String(row.overdue_tasks),
      String(row.budget_used_pct),
      csvEscape(row.lead_name || ""),
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
