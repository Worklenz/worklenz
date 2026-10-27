import { createHash } from "crypto";
import db from "../../config/db";
import {
  getAnalyticsCache,
  setAnalyticsCache,
  withLastUpdated,
} from "../../redis/analytics-cache";
import { getColor } from "../../shared/utils";

export interface TimeReportFilters {
  projectIds: string[];
  memberIds: string[];
  teamIds: string[];
  dateFrom: string;
  dateTo: string;
  sessionTeamId: string;
}

export interface TimeReportRow {
  team_member_id: string;
  member_name: string;
  avatar_url: string | null;
  color_code: string;
  project_id: string;
  project_name: string;
  project_color: string | null;
  logged_hours: number;
  estimated_hours: number;
  billable_hours: number;
  nonbillable_hours: number;
}

export interface TimeReportProjectSeries {
  project_id: string;
  project_name: string;
  logged_hours: number;
  estimated_hours: number;
}

export interface TimeReportKpis {
  logged_hours: number;
  estimated_hours: number;
  billable_hours: number;
  billable_pct: number;
  over_estimate_hours: number;
}

export interface TimeReportResult {
  rows: TimeReportRow[];
  projects: TimeReportProjectSeries[];
  kpis: TimeReportKpis;
  meta: {
    row_count: number;
    date_from: string;
    date_to: string;
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

function toDateOnly(value: string | null | undefined, fallback: string): string {
  if (!value) return fallback;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return fallback;
  return d.toISOString().slice(0, 10);
}

function defaultDateRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  from.setUTCDate(from.getUTCDate() - 30);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function parseTimeReportFilters(
  query: Record<string, unknown>,
  accessibleProjectIds: string[],
  sessionTeamId: string
): TimeReportFilters {
  const defaults = defaultDateRange();
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
    dateFrom: toDateOnly(
      typeof query.date_from === "string" ? query.date_from : null,
      defaults.from
    ),
    dateTo: toDateOnly(
      typeof query.date_to === "string" ? query.date_to : null,
      defaults.to
    ),
    sessionTeamId,
  };
}

function cacheParts(filters: TimeReportFilters): Array<string | number> {
  const payload = JSON.stringify({
    p: [...filters.projectIds].sort(),
    m: [...filters.memberIds].sort(),
    t: [...filters.teamIds].sort(),
    df: filters.dateFrom,
    dt: filters.dateTo,
    st: filters.sessionTeamId,
  });
  return ["time-report", createHash("sha1").update(payload).digest("hex")];
}

type Payload = Omit<TimeReportResult, "last_updated_at">;

const EMPTY_KPIS: TimeReportKpis = {
  logged_hours: 0,
  estimated_hours: 0,
  billable_hours: 0,
  billable_pct: 0,
  over_estimate_hours: 0,
};

export async function getTimeReportSeries(
  filters: TimeReportFilters
): Promise<TimeReportResult> {
  const emptyMeta = {
    row_count: 0,
    date_from: filters.dateFrom,
    date_to: filters.dateTo,
  };

  if (filters.projectIds.length === 0 && filters.teamIds.length === 0) {
    return withLastUpdated({
      rows: [],
      projects: [],
      kpis: EMPTY_KPIS,
      meta: emptyMeta,
    });
  }

  const parts = cacheParts(filters);
  const cached = await getAnalyticsCache<Payload>(...parts);
  if (cached) {
    return withLastUpdated(cached.data, cached.lastUpdatedAt);
  }

  const teamIds =
    filters.teamIds.length > 0 ? filters.teamIds : [filters.sessionTeamId];

  const params: unknown[] = [
    teamIds,
    filters.projectIds,
    filters.dateFrom,
    filters.dateTo,
  ];
  let memberClause = "";
  if (filters.memberIds.length > 0) {
    memberClause = `AND pairs.team_member_id = ANY($5::UUID[])`;
    params.push(filters.memberIds);
  }

  const projectFilter =
    filters.projectIds.length > 0
      ? `AND p.id = ANY($2::UUID[])`
      : `AND FALSE`;

  /**
   * Member × project rows:
   * - logged / billable from task_work_log in the selected date range
   * - estimated from assigned tasks' total_minutes (planned effort)
   */
  const result = await db.query(
    `
    WITH logged AS (
      SELECT
        tm.id AS team_member_id,
        p.id AS project_id,
        SUM(wl.time_spent)::FLOAT / 3600.0 AS logged_hours,
        SUM(
          CASE WHEN COALESCE(t.billable, false) THEN wl.time_spent ELSE 0 END
        )::FLOAT / 3600.0 AS billable_hours
      FROM task_work_log wl
      JOIN tasks t ON t.id = wl.task_id AND t.archived = false
      JOIN projects p ON p.id = t.project_id
      JOIN team_members tm ON tm.user_id = wl.user_id AND tm.active = TRUE
      WHERE tm.team_id = ANY($1::UUID[])
        AND wl.created_at::DATE >= $3::DATE
        AND wl.created_at::DATE <= $4::DATE
        ${projectFilter}
      GROUP BY tm.id, p.id
    ),
    estimated AS (
      SELECT
        tm.id AS team_member_id,
        p.id AS project_id,
        SUM(COALESCE(t.total_minutes, 0))::FLOAT / 60.0 AS estimated_hours
      FROM tasks_assignees ta
      JOIN team_members tm ON tm.id = ta.team_member_id AND tm.active = TRUE
      JOIN tasks t ON t.id = ta.task_id AND t.archived = false
      JOIN projects p ON p.id = t.project_id
      WHERE tm.team_id = ANY($1::UUID[])
        ${projectFilter}
      GROUP BY tm.id, p.id
    ),
    pairs AS (
      SELECT team_member_id, project_id FROM logged
      UNION
      SELECT team_member_id, project_id FROM estimated
    )
    SELECT
      pairs.team_member_id,
      COALESCE(u.name, '') AS member_name,
      u.avatar_url,
      pairs.project_id,
      COALESCE(p.name, '') AS project_name,
      p.color_code AS project_color,
      COALESCE(logged.logged_hours, 0)::FLOAT AS logged_hours,
      COALESCE(logged.billable_hours, 0)::FLOAT AS billable_hours,
      COALESCE(estimated.estimated_hours, 0)::FLOAT AS estimated_hours
    FROM pairs
    JOIN team_members tm ON tm.id = pairs.team_member_id
    JOIN users u ON u.id = tm.user_id
    JOIN projects p ON p.id = pairs.project_id
    LEFT JOIN logged
      ON logged.team_member_id = pairs.team_member_id
     AND logged.project_id = pairs.project_id
    LEFT JOIN estimated
      ON estimated.team_member_id = pairs.team_member_id
     AND estimated.project_id = pairs.project_id
    WHERE TRUE
      ${memberClause}
    ORDER BY LOWER(COALESCE(u.name, '')) ASC, LOWER(COALESCE(p.name, '')) ASC
    `,
    params
  );

  const rows: TimeReportRow[] = result.rows.map((row: Record<string, unknown>) => {
    const loggedHours = round2(Number(row.logged_hours) || 0);
    const billableHours = round2(Number(row.billable_hours) || 0);
    const estimatedHours = round2(Number(row.estimated_hours) || 0);
    const name = String(row.member_name || "");
    return {
      team_member_id: String(row.team_member_id),
      member_name: name,
      avatar_url: (row.avatar_url as string | null) || null,
      color_code: getColor(name),
      project_id: String(row.project_id),
      project_name: String(row.project_name || ""),
      project_color: (row.project_color as string | null) || null,
      logged_hours: loggedHours,
      estimated_hours: estimatedHours,
      billable_hours: billableHours,
      nonbillable_hours: round2(Math.max(0, loggedHours - billableHours)),
    };
  });

  const projectMap = new Map<string, TimeReportProjectSeries>();
  for (const row of rows) {
    const existing = projectMap.get(row.project_id);
    if (existing) {
      existing.logged_hours = round2(existing.logged_hours + row.logged_hours);
      existing.estimated_hours = round2(
        existing.estimated_hours + row.estimated_hours
      );
    } else {
      projectMap.set(row.project_id, {
        project_id: row.project_id,
        project_name: row.project_name,
        logged_hours: row.logged_hours,
        estimated_hours: row.estimated_hours,
      });
    }
  }

  const projects = Array.from(projectMap.values()).sort((a, b) =>
    a.project_name.localeCompare(b.project_name)
  );

  const totalLogged = round2(rows.reduce((sum, r) => sum + r.logged_hours, 0));
  const totalEstimated = round2(
    rows.reduce((sum, r) => sum + r.estimated_hours, 0)
  );
  const totalBillable = round2(
    rows.reduce((sum, r) => sum + r.billable_hours, 0)
  );

  const kpis: TimeReportKpis = {
    logged_hours: totalLogged,
    estimated_hours: totalEstimated,
    billable_hours: totalBillable,
    billable_pct:
      totalLogged > 0 ? Math.round((totalBillable / totalLogged) * 100) : 0,
    over_estimate_hours: round2(Math.max(0, totalLogged - totalEstimated)),
  };

  const payload: Payload = {
    rows,
    projects,
    kpis,
    meta: {
      row_count: rows.length,
      date_from: filters.dateFrom,
      date_to: filters.dateTo,
    },
  };

  const stored = await setAnalyticsCache(payload, parts);
  return withLastUpdated(payload, stored.lastUpdatedAt);
}

export function buildTimeReportCsv(result: TimeReportResult): string {
  const header = [
    "Member",
    "Project",
    "Logged (h)",
    "Estimated (h)",
    "Billable (h)",
    "Non-billable (h)",
  ];
  const lines = [header.join(",")];
  for (const row of result.rows) {
    lines.push(
      [
        csvEscape(row.member_name),
        csvEscape(row.project_name),
        String(row.logged_hours),
        String(row.estimated_hours),
        String(row.billable_hours),
        String(row.nonbillable_hours),
      ].join(",")
    );
  }
  return lines.join("\n");
}

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
