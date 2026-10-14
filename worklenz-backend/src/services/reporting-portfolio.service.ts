import db from "../config/db";

/**
 * Data for Reports > Project Portfolio. Only existing project fields are used (no status history
 * exists), so the period KPIs are derived from `created_at` / `updated_at` and are approximations:
 *  - new     = created in the period
 *  - close   = now Completed/Cancelled, last updated in the period
 *  - opening = created before the period and not already closed (by `updated_at`) before it
 *  - closing = opening + new - close
 * The category table covers the projects live at any point in the period (opening + new).
 */

export const PORTFOLIO_PERIODS = ["yearly", "quarterly", "monthly"] as const;
export type PortfolioPeriod = (typeof PORTFOLIO_PERIODS)[number];

export interface PortfolioPeriodInput {
  period: PortfolioPeriod;
  year: number;
  /** 1-4, quarterly only */
  quarter?: number;
  /** 1-12, monthly only */
  month?: number;
}

export interface PortfolioRange {
  start: Date;
  /** exclusive */
  end: Date;
}

const CLOSED_STATUSES = ["Completed", "Cancelled"];

/** One option of a project lookup (status / priority / health), in display order. */
export interface PortfolioLookupItem {
  id: string;
  name: string;
  color: string | null;
}

export interface PortfolioLookups {
  statuses: PortfolioLookupItem[];
  priorities: PortfolioLookupItem[];
  healths: PortfolioLookupItem[];
}

/** Resolves a period selection to a UTC [start, end) range, or null when the input is out of range. */
export function resolvePortfolioRange(input: PortfolioPeriodInput): PortfolioRange | null {
  const { period, year, quarter, month } = input;
  if (!Number.isInteger(year) || year < 1970 || year > 9999) return null;

  if (period === "yearly") {
    return { start: new Date(Date.UTC(year, 0, 1)), end: new Date(Date.UTC(year + 1, 0, 1)) };
  }
  if (period === "quarterly") {
    if (!Number.isInteger(quarter) || (quarter as number) < 1 || (quarter as number) > 4) return null;
    const startMonth = ((quarter as number) - 1) * 3;
    return { start: new Date(Date.UTC(year, startMonth, 1)), end: new Date(Date.UTC(year, startMonth + 3, 1)) };
  }
  if (period === "monthly") {
    if (!Number.isInteger(month) || (month as number) < 1 || (month as number) > 12) return null;
    return { start: new Date(Date.UTC(year, (month as number) - 1, 1)), end: new Date(Date.UTC(year, month as number, 1)) };
  }
  return null;
}

export interface PortfolioProjectRow {
  id: string;
  name: string;
  category_id: string | null;
  category_name: string | null;
  status_id: string;
  status_name: string;
  status_color: string | null;
  priority_id: string | null;
  priority_name: string | null;
  priority_color: string | null;
  priority_value: number | null;
  health_id: string | null;
  health_name: string | null;
  health_color: string | null;
  manager: string | null;
  start_date: Date | string | null;
  end_date: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface PortfolioProject {
  id: string;
  name: string;
  status: string;
  statusColor: string | null;
  priority: string | null;
  priorityColor: string | null;
  priorityValue: number | null;
  health: string | null;
  healthColor: string | null;
  manager: string | null;
  startDate: string | null;
  endDate: string | null;
}

/** Per-option counts keyed by the lookup option's id. `overdue` is a flag across non-closed projects. */
export interface PortfolioCounts {
  total: number;
  overdue: number;
  status: Record<string, number>;
  priority: Record<string, number>;
  health: Record<string, number>;
}

export interface PortfolioCategory extends PortfolioCounts {
  id: string | null;
  name: string | null;
  projects: PortfolioProject[];
}

export interface PortfolioKpis {
  opening: number;
  new: number;
  close: number;
  closing: number;
}

export interface PortfolioResult {
  period: PortfolioPeriod;
  range: { start: string; end: string };
  lookups: PortfolioLookups;
  kpis: PortfolioKpis;
  categories: PortfolioCategory[];
  totals: PortfolioCounts;
}

const emptyCounts = (): PortfolioCounts => ({ total: 0, overdue: 0, status: {}, priority: {}, health: {} });

const bump = (bucket: Record<string, number>, key: string | null) => {
  if (key) bucket[key] = (bucket[key] ?? 0) + 1;
};

const toTime = (value: Date | string | null): number | null => {
  if (value === null || value === undefined) return null;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? null : time;
};

const addCounts = (target: PortfolioCounts, source: PortfolioCounts) => {
  target.total += source.total;
  target.overdue += source.overdue;
  for (const group of ["status", "priority", "health"] as const) {
    for (const [key, value] of Object.entries(source[group])) target[group][key] = (target[group][key] ?? 0) + value;
  }
};

const countProject = (counts: PortfolioCounts, row: PortfolioProjectRow, now: number) => {
  const endTime = toTime(row.end_date);
  counts.total += 1;
  if (!CLOSED_STATUSES.includes(row.status_name) && endTime !== null && endTime < now) counts.overdue += 1;
  bump(counts.status, row.status_id);
  bump(counts.priority, row.priority_id);
  bump(counts.health, row.health_id);
};

/** Pure aggregation of project rows into the KPI cards and the category table. */
export function buildPortfolio(
  rows: PortfolioProjectRow[],
  period: PortfolioPeriod,
  range: PortfolioRange,
  lookups: PortfolioLookups,
  now: number = Date.now()
): PortfolioResult {
  const start = range.start.getTime();
  const end = range.end.getTime();
  const kpis: PortfolioKpis = { opening: 0, new: 0, close: 0, closing: 0 };
  const categories = new Map<string, PortfolioCategory>();

  for (const row of rows) {
    const createdAt = toTime(row.created_at) ?? 0;
    const updatedAt = toTime(row.updated_at) ?? createdAt;
    const isClosed = CLOSED_STATUSES.includes(row.status_name);

    const isNew = createdAt >= start && createdAt < end;
    const isOpening = createdAt < start && !(isClosed && updatedAt < start);
    const isClosedInPeriod = isClosed && updatedAt >= start && updatedAt < end;

    if (isNew) kpis.new += 1;
    if (isOpening) kpis.opening += 1;
    if (isClosedInPeriod && createdAt < end) kpis.close += 1;

    if (!isNew && !isOpening) continue;

    const key = row.category_id ?? "__none__";
    let category = categories.get(key);
    if (!category) {
      category = { id: row.category_id, name: row.category_name, ...emptyCounts(), projects: [] };
      categories.set(key, category);
    }
    countProject(category, row, now);
    category.projects.push({
      id: row.id,
      name: row.name,
      status: row.status_name,
      statusColor: row.status_color,
      priority: row.priority_name,
      priorityColor: row.priority_color,
      priorityValue: row.priority_value,
      health: row.health_name,
      healthColor: row.health_color,
      manager: row.manager,
      startDate: row.start_date ? new Date(row.start_date).toISOString() : null,
      endDate: row.end_date ? new Date(row.end_date).toISOString() : null,
    });
  }

  kpis.closing = kpis.opening + kpis.new - kpis.close;

  const sorted = [...categories.values()].sort((a, b) => {
    if (a.id === null) return 1;
    if (b.id === null) return -1;
    return (a.name ?? "").localeCompare(b.name ?? "");
  });
  sorted.forEach(category => category.projects.sort((a, b) => a.name.localeCompare(b.name)));

  const totals = emptyCounts();
  sorted.forEach(category => addCounts(totals, category));

  return {
    period,
    range: { start: range.start.toISOString(), end: range.end.toISOString() },
    lookups,
    kpis,
    categories: sorted,
    totals,
  };
}

/** Loads the team's projects (archived ones excluded, per user) with the joined display fields. */
export async function getPortfolio(
  teamId: string,
  userId: string,
  period: PortfolioPeriod,
  range: PortfolioRange
): Promise<PortfolioResult> {
  const q = `
    SELECT p.id,
           p.name,
           p.category_id,
           pc.name AS category_name,
           p.status_id,
           ps.name AS status_name,
           ps.color_code AS status_color,
           p.priority_id,
           pr.name AS priority_name,
           pr.color_code AS priority_color,
           pr.value AS priority_value,
           p.health_id,
           h.name AS health_name,
           h.color_code AS health_color,
           (SELECT STRING_AGG(tmi.name, ', ' ORDER BY tmi.name)
            FROM project_members pm
                   JOIN team_member_info_view tmi ON tmi.team_member_id = pm.team_member_id
            WHERE pm.project_id = p.id
              AND pm.project_access_level_id = (SELECT id FROM project_access_levels WHERE key = 'PROJECT_MANAGER')) AS manager,
           p.start_date,
           p.end_date,
           p.created_at,
           p.updated_at
    FROM projects p
           JOIN sys_project_statuses ps ON ps.id = p.status_id
           LEFT JOIN project_categories pc ON pc.id = p.category_id
           LEFT JOIN sys_project_priorities pr ON pr.id = p.priority_id
           LEFT JOIN sys_project_healths h ON h.id = p.health_id
    WHERE p.team_id = $1
      AND p.id NOT IN (SELECT project_id FROM archived_projects WHERE project_id = p.id AND user_id = $2)`;
  const [projects, statuses, priorities, healths] = await Promise.all([
    db.query(q, [teamId, userId]),
    db.query("SELECT id, name, color_code AS color FROM sys_project_statuses ORDER BY sort_order, name"),
    db.query("SELECT id, name, color_code AS color FROM sys_project_priorities ORDER BY value"),
    db.query("SELECT id, name, color_code AS color FROM sys_project_healths ORDER BY sort_order, name"),
  ]);
  const lookups: PortfolioLookups = { statuses: statuses.rows, priorities: priorities.rows, healths: healths.rows };
  return buildPortfolio(projects.rows as PortfolioProjectRow[], period, range, lookups);
}
