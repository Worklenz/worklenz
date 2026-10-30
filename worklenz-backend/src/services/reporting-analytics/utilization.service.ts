import { createHash } from "crypto";
import db from "../../config/db";
import {
  getAnalyticsCache,
  setAnalyticsCache,
  withLastUpdated,
} from "../../redis/analytics-cache";
import { sanitizeCsvFormulaValue } from "../../shared/csv-utils";
import { getColor } from "../../shared/utils";

export type UtilizationStatus = "over" | "optimal" | "under";

export interface UtilizationFilters {
  projectIds: string[];
  memberIds: string[];
  teamIds: string[];
  dateFrom: string;
  dateTo: string;
  sessionTeamId: string;
}

export interface UtilizationMemberRow {
  team_member_id: string;
  member_name: string;
  avatar_url: string | null;
  color_code: string;
  role_name: string | null;
  /** Working hours for the selected period (org schedule × hours/day). */
  capacity_hours: number;
  /** Time logged against selected projects in the period. */
  logged_hours: number;
  billable_hours: number;
  utilization_pct: number;
  status: UtilizationStatus;
}

export interface UtilizationKpis {
  avg_utilization_pct: number;
  team_size: number;
  overutilized_count: number;
  underutilized_count: number;
  total_capacity_hours: number;
  total_logged_hours: number;
}

export interface UtilizationResult {
  members: UtilizationMemberRow[];
  kpis: UtilizationKpis;
  meta: {
    member_count: number;
    working_days: number;
    hours_per_day: number;
    date_from: string;
    date_to: string;
  };
  last_updated_at: string;
}

const MAX_PROJECTS = 50;
const OVER_THRESHOLD = 100;
const UNDER_THRESHOLD = 80;

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

export function utilizationStatus(pct: number): UtilizationStatus {
  if (pct > OVER_THRESHOLD) return "over";
  if (pct > UNDER_THRESHOLD) return "optimal";
  return "under";
}

export function parseUtilizationFilters(
  query: Record<string, unknown>,
  accessibleProjectIds: string[],
  sessionTeamId: string
): UtilizationFilters {
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

function cacheParts(filters: UtilizationFilters): Array<string | number> {
  const payload = JSON.stringify({
    p: [...filters.projectIds].sort(),
    m: [...filters.memberIds].sort(),
    t: [...filters.teamIds].sort(),
    df: filters.dateFrom,
    dt: filters.dateTo,
    st: filters.sessionTeamId,
  });
  return ["utilization", createHash("sha1").update(payload).digest("hex")];
}

type Payload = Omit<UtilizationResult, "last_updated_at">;

const EMPTY_KPIS: UtilizationKpis = {
  avg_utilization_pct: 0,
  team_size: 0,
  overutilized_count: 0,
  underutilized_count: 0,
  total_capacity_hours: 0,
  total_logged_hours: 0,
};

export async function getUtilizationSeries(
  filters: UtilizationFilters
): Promise<UtilizationResult> {
  const emptyMeta = {
    member_count: 0,
    working_days: 0,
    hours_per_day: 8,
    date_from: filters.dateFrom,
    date_to: filters.dateTo,
  };

  // Empty accessible projects must not be bypassed by a non-empty teamIds filter alone.
  if (filters.projectIds.length === 0) {
    return withLastUpdated({
      members: [],
      kpis: EMPTY_KPIS,
      meta: emptyMeta,
    });
  }

  const parts = cacheParts(filters);
  const cached = await getAnalyticsCache<Payload>(...parts);
  if (cached) {
    return withLastUpdated(cached.data, cached.lastUpdatedAt);
  }

  const projectTeamsResult = await db.query(
    `SELECT DISTINCT team_id::TEXT AS team_id FROM projects WHERE id = ANY($1::UUID[])`,
    [filters.projectIds]
  );
  const projectTeamIds = new Set<string>([
    filters.sessionTeamId,
    ...projectTeamsResult.rows.map((row: { team_id: string }) => row.team_id),
  ]);
  const requestedTeams =
    filters.teamIds.length > 0 ? filters.teamIds : [filters.sessionTeamId];
  const teamIds = requestedTeams.filter(id => projectTeamIds.has(id));
  if (teamIds.length === 0) {
    return withLastUpdated({
      members: [],
      kpis: EMPTY_KPIS,
      meta: emptyMeta,
    });
  }

  const orgResult = await db.query(
    `
    SELECT
      o.id AS organization_id,
      COALESCE(o.hours_per_day, 8)::FLOAT AS hours_per_day,
      COALESCE(owd.monday, true) AS monday,
      COALESCE(owd.tuesday, true) AS tuesday,
      COALESCE(owd.wednesday, true) AS wednesday,
      COALESCE(owd.thursday, true) AS thursday,
      COALESCE(owd.friday, true) AS friday,
      COALESCE(owd.saturday, false) AS saturday,
      COALESCE(owd.sunday, false) AS sunday
    FROM teams t
    JOIN organizations o ON o.id = t.organization_id
    LEFT JOIN organization_working_days owd ON owd.organization_id = o.id
    WHERE t.id = $1
    LIMIT 1
    `,
    [filters.sessionTeamId]
  );

  const org = orgResult.rows[0] || {
    hours_per_day: 8,
    monday: true,
    tuesday: true,
    wednesday: true,
    thursday: true,
    friday: true,
    saturday: false,
    sunday: false,
  };

  const workingDaysResult = await db.query(
    `
    SELECT COUNT(*)::INT AS working_days
    FROM generate_series($1::date, $2::date, '1 day') AS d(day)
    WHERE CASE EXTRACT(ISODOW FROM d.day)::INT
      WHEN 1 THEN $3::boolean
      WHEN 2 THEN $4::boolean
      WHEN 3 THEN $5::boolean
      WHEN 4 THEN $6::boolean
      WHEN 5 THEN $7::boolean
      WHEN 6 THEN $8::boolean
      WHEN 7 THEN $9::boolean
    END
    `,
    [
      filters.dateFrom,
      filters.dateTo,
      Boolean(org.monday),
      Boolean(org.tuesday),
      Boolean(org.wednesday),
      Boolean(org.thursday),
      Boolean(org.friday),
      Boolean(org.saturday),
      Boolean(org.sunday),
    ]
  );

  const workingDays = Number(workingDaysResult.rows[0]?.working_days) || 0;
  const hoursPerDay = Number(org.hours_per_day) || 8;
  // Capacity = working hours for the period (org working days × hours/day).
  const capacityHours = workingDays * hoursPerDay;

  const params: unknown[] = [
    teamIds,
    filters.projectIds,
    filters.dateFrom,
    filters.dateTo,
  ];
  let memberClause = "";
  if (filters.memberIds.length > 0) {
    memberClause = `AND tm.id = ANY($5::UUID[])`;
    params.push(filters.memberIds);
  }

  const projectFilter =
    filters.projectIds.length > 0
      ? `AND p.id = ANY($2::UUID[])`
      : `AND FALSE`;

  const result = await db.query(
    `
    SELECT
      tm.id AS team_member_id,
      COALESCE(u.name, '') AS member_name,
      u.avatar_url,
      COALESCE(jt.name, '') AS role_name,
      COALESCE(logs.billable_hours, 0)::FLOAT AS billable_hours,
      COALESCE(logs.logged_hours, 0)::FLOAT AS logged_hours
    FROM team_members tm
    JOIN users u ON u.id = tm.user_id
    LEFT JOIN job_titles jt ON jt.id = tm.job_title_id
    LEFT JOIN (
      SELECT
        wl.user_id,
        SUM(
          CASE WHEN COALESCE(t.billable, false) THEN wl.time_spent ELSE 0 END
        )::FLOAT / 3600.0 AS billable_hours,
        SUM(wl.time_spent)::FLOAT / 3600.0 AS logged_hours
      FROM task_work_log wl
      JOIN tasks t ON t.id = wl.task_id AND t.archived = false
      JOIN projects p ON p.id = t.project_id
      WHERE wl.created_at::DATE >= $3::DATE
        AND wl.created_at::DATE <= $4::DATE
        ${projectFilter}
      GROUP BY wl.user_id
    ) logs ON logs.user_id = u.id
    WHERE tm.team_id = ANY($1::UUID[])
      AND tm.active = TRUE
      ${memberClause}
    ORDER BY LOWER(COALESCE(u.name, '')) ASC
    `,
    params
  );

  const members: UtilizationMemberRow[] = result.rows.map(
    (row: Record<string, unknown>) => {
      const loggedHours = round2(Number(row.logged_hours) || 0);
      const billableHours = round2(Number(row.billable_hours) || 0);
      const utilizationPct =
        capacityHours > 0 ? Math.round((loggedHours / capacityHours) * 100) : 0;
      const name = String(row.member_name || "");
      return {
        team_member_id: String(row.team_member_id),
        member_name: name,
        avatar_url: (row.avatar_url as string | null) || null,
        color_code: getColor(name),
        role_name: row.role_name ? String(row.role_name) : null,
        capacity_hours: round2(capacityHours),
        logged_hours: loggedHours,
        billable_hours: billableHours,
        utilization_pct: utilizationPct,
        status: utilizationStatus(utilizationPct),
      };
    }
  );

  const totalLogged = members.reduce((sum, m) => sum + m.logged_hours, 0);
  const totalCapacity = capacityHours * Math.max(members.length, 0);
  const avgUtilization =
    totalCapacity > 0 ? Math.round((totalLogged / totalCapacity) * 100) : 0;

  const kpis: UtilizationKpis = {
    avg_utilization_pct: avgUtilization,
    team_size: members.length,
    overutilized_count: members.filter(m => m.status === "over").length,
    underutilized_count: members.filter(m => m.status === "under").length,
    total_capacity_hours: round2(totalCapacity),
    total_logged_hours: round2(totalLogged),
  };

  const payload: Payload = {
    members,
    kpis,
    meta: {
      member_count: members.length,
      working_days: workingDays,
      hours_per_day: hoursPerDay,
      date_from: filters.dateFrom,
      date_to: filters.dateTo,
    },
  };

  const stored = await setAnalyticsCache(payload, parts);
  return withLastUpdated(payload, stored.lastUpdatedAt);
}

export function buildUtilizationCsv(result: UtilizationResult): string {
  const header = [
    "Member",
    "Role",
    "Capacity (h)",
    "Logged (h)",
    "Billable (h)",
    "Utilization %",
    "Status",
  ];
  const lines = [header.join(",")];
  for (const row of result.members) {
    lines.push(
      [
        csvEscape(row.member_name),
        csvEscape(row.role_name || ""),
        String(row.capacity_hours),
        String(row.logged_hours),
        String(row.billable_hours),
        String(row.utilization_pct),
        row.status,
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
