import { createHash } from "crypto";
import db from "../../config/db";
import {
  getAnalyticsCache,
  setAnalyticsCache,
  withLastUpdated,
} from "../../redis/analytics-cache";
import { getOrgFinanceSettings } from "../../controllers/finance-overview-controller";
import { buildRateSql } from "../../shared/finance-rate";
import { sanitizeCsvFormulaValue } from "../../shared/csv-utils";

export type BudgetAlert = "high" | "watch" | "ok" | "none";

export interface BudgetTrackingFilters {
  projectIds: string[];
  memberIds: string[];
  teamIds: string[];
  sessionTeamId: string;
}

export interface BudgetTrackingRow {
  project_id: string;
  project_name: string;
  color_code: string;
  client_name: string | null;
  currency: string;
  budget: number;
  spent: number;
  remaining: number;
  burn_pct: number;
  alert: BudgetAlert;
  has_budget: boolean;
  updated_at: string | null;
}

export interface BudgetTrackingKpis {
  total_budget: number;
  spent: number;
  remaining: number;
  over_budget_count: number;
  utilization_pct: number;
}

export interface BudgetTrackingResult {
  projects: BudgetTrackingRow[];
  kpis: BudgetTrackingKpis;
  meta: {
    project_count: number;
  };
  last_updated_at: string;
}

const MAX_PROJECTS = 50;

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

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function burnAlert(pct: number, hasBudget: boolean): BudgetAlert {
  if (!hasBudget) return "none";
  if (pct > 85) return "high";
  if (pct > 65) return "watch";
  return "ok";
}

export function parseBudgetTrackingFilters(
  query: Record<string, unknown>,
  accessibleProjectIds: string[],
  sessionTeamId: string
): BudgetTrackingFilters {
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

function cacheParts(
  filters: BudgetTrackingFilters,
  calcMethod: string,
  hoursPerDay: number
): Array<string | number> {
  const payload = JSON.stringify({
    p: [...filters.projectIds].sort(),
    m: [...filters.memberIds].sort(),
    t: [...filters.teamIds].sort(),
    st: filters.sessionTeamId,
    cm: calcMethod,
    hpd: hoursPerDay,
  });
  return ["budget-tracking", createHash("sha1").update(payload).digest("hex")];
}

type Payload = Omit<BudgetTrackingResult, "last_updated_at">;

const EMPTY_KPIS: BudgetTrackingKpis = {
  total_budget: 0,
  spent: 0,
  remaining: 0,
  over_budget_count: 0,
  utilization_pct: 0,
};

/**
 * Lifetime budget vs actual cost by project.
 * Cost formula matches finance portfolio / project health (fixed + time × rate card).
 */
export async function getBudgetTrackingSeries(
  filters: BudgetTrackingFilters
): Promise<BudgetTrackingResult> {
  if (filters.projectIds.length === 0 && filters.teamIds.length === 0) {
    return withLastUpdated({
      projects: [],
      kpis: EMPTY_KPIS,
      meta: { project_count: 0 },
    });
  }

  const { calcMethod, hoursPerDay } = await getOrgFinanceSettings(filters.sessionTeamId);
  const parts = cacheParts(filters, calcMethod, hoursPerDay);
  const cached = await getAnalyticsCache<Payload>(...parts);
  if (cached) {
    return withLastUpdated(cached.data, cached.lastUpdatedAt);
  }

  const rateSql = buildRateSql(calcMethod, hoursPerDay);
  const params: unknown[] = [filters.projectIds];
  let param = 2;

  let projectClause =
    filters.projectIds.length > 0
      ? `p.id = ANY($1::UUID[])`
      : `FALSE`;

  let teamClause = "";
  if (filters.teamIds.length > 0) {
    teamClause = `AND p.team_id = ANY($${param}::UUID[])`;
    params.push(filters.teamIds);
    param += 1;
  }

  let memberClause = "";
  if (filters.memberIds.length > 0) {
    memberClause = `
      AND EXISTS (
        SELECT 1
        FROM project_members pm_f
        WHERE pm_f.project_id = p.id
          AND pm_f.team_member_id = ANY($${param}::UUID[])
      )`;
    params.push(filters.memberIds);
    param += 1;
  }

  const result = await db.query(
    `
    SELECT
      p.id AS project_id,
      p.name AS project_name,
      COALESCE(p.color_code, '#1890ff') AS color_code,
      c.name AS client_name,
      COALESCE(p.budget, 0)::FLOAT AS budget,
      COALESCE(p.currency, 'USD') AS currency,
      TO_CHAR(p.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS updated_at,
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
    LEFT JOIN clients c ON c.id = p.client_id
    WHERE ${projectClause}
      ${teamClause}
      ${memberClause}
    ORDER BY LOWER(p.name) ASC
    `,
    params
  );

  const projects: BudgetTrackingRow[] = result.rows.map((row: Record<string, unknown>) => {
    const budget = round2(Number(row.budget) || 0);
    const spent = round2(
      (Number(row.fixed_cost) || 0) + (Number(row.time_based_cost) || 0)
    );
    const remaining = round2(budget - spent);
    const hasBudget = budget > 0;
    const burnPct = hasBudget
      ? Math.min(999, Math.round((spent / budget) * 100))
      : 0;

    return {
      project_id: String(row.project_id),
      project_name: String(row.project_name || ""),
      color_code: String(row.color_code || "#1890ff"),
      client_name: row.client_name ? String(row.client_name) : null,
      currency: String(row.currency || "USD").toUpperCase(),
      budget,
      spent,
      remaining,
      burn_pct: burnPct,
      alert: burnAlert(burnPct, hasBudget),
      has_budget: hasBudget,
      updated_at: row.updated_at ? String(row.updated_at) : null,
    };
  });

  const totalBudget = round2(
    projects.filter(p => p.has_budget).reduce((sum, p) => sum + p.budget, 0)
  );
  const totalSpent = round2(
    projects.filter(p => p.has_budget).reduce((sum, p) => sum + p.spent, 0)
  );
  const remaining = round2(totalBudget - totalSpent);
  const overBudgetCount = projects.filter(
    p => p.has_budget && p.spent > p.budget
  ).length;

  const kpis: BudgetTrackingKpis = {
    total_budget: totalBudget,
    spent: totalSpent,
    remaining,
    over_budget_count: overBudgetCount,
    utilization_pct:
      totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0,
  };

  const payload: Payload = {
    projects,
    kpis,
    meta: { project_count: projects.length },
  };

  const stored = await setAnalyticsCache(payload, parts);
  return withLastUpdated(payload, stored.lastUpdatedAt);
}

export function buildBudgetTrackingCsv(result: BudgetTrackingResult): string {
  const header = [
    "Project",
    "Client",
    "Currency",
    "Budget",
    "Spent",
    "Remaining",
    "Burn %",
    "Alert",
  ];
  const lines = [header.join(",")];
  for (const row of result.projects) {
    lines.push(
      [
        csvEscape(row.project_name),
        csvEscape(row.client_name || ""),
        csvEscape(row.currency),
        String(row.budget),
        String(row.spent),
        String(row.remaining),
        String(row.burn_pct),
        csvEscape(row.alert),
      ].join(",")
    );
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
