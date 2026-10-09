import moment from "moment";

/**
 * Query building for the Reports > Time Logs page (list, totals, member
 * options and exports). Pure functions only — no database access — so every
 * filter combination can be unit-tested against the generated SQL.
 *
 * Conventions that matter for correctness:
 *  - Dates are *inclusive local calendar days* in the viewer's timezone. The
 *    bounds are converted to instants with `timestamp AT TIME ZONE tz`
 *    (instead of casting the column), so the filter stays index-friendly on
 *    `task_work_log.created_at` and agrees with the `log_day` shown per row.
 *  - Members are matched by **user id**: a deactivated member keeps their
 *    `team_members` row, but a removed member's row is deleted while their
 *    `task_work_log.user_id` survives.
 *  - Placeholders are allocated lazily (see ParamBag) so a parameter is never
 *    left unreferenced — Postgres rejects those with 42P18.
 */

export const NO_PRACTICE_FILTER_ID = "__no_practice__";
export const NO_CLIENT_FILTER_ID = "__no_client__";
export const TIME_LOGS_EXPORT_ROW_CAP = 50000;
export const TIME_LOGS_DEFAULT_PAGE_SIZE = 20;
export const TIME_LOGS_MAX_PAGE_SIZE = 100;
const MAX_SEARCH_LENGTH = 200;

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_FORMAT = "YYYY-MM-DD";

export type TimeLogsExportMode = "filtered" | "all";

/** Entries as logged ("flat"), or one row per task with its time summed ("task"). */
export type TimeLogsView = "flat" | "task";

/** The dimensions the report can be grouped by (no grouping = the flat/task table). */
export type TimeLogsGroupBy = "member" | "project" | "client";

export interface ITimeLogsBillable {
  billable: boolean;
  nonBillable: boolean;
}

export interface ITimeLogsFilters {
  teamId: string;
  /** IANA name of the viewer's timezone. */
  timezone: string;
  /** Inclusive `YYYY-MM-DD`; the date filter only applies when both are set. */
  dateFrom?: string | null;
  dateTo?: string | null;
  userIds?: string[];
  projectIds?: string[];
  /** Practice ids, optionally including {@link NO_PRACTICE_FILTER_ID}. */
  practiceIds?: string[];
  /** Client ids (of the entry's project), optionally including {@link NO_CLIENT_FILTER_ID}. */
  clientIds?: string[];
  billable?: ITimeLogsBillable | null;
  search?: string | null;
}

export interface ITimeLogsQueryOptions {
  sortField?: string | null;
  sortOrder?: string | null;
  /** "task" collapses the matching entries into one row per task. Defaults to "flat". */
  view?: TimeLogsView;
  limit?: number;
  offset?: number;
}

export interface IBuiltQuery {
  text: string;
  values: unknown[];
}

/** Thrown for caller mistakes (bad ids, bad dates) — surfaced as HTTP 400. */
export class TimeLogsFilterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TimeLogsFilterError";
  }
}

/** Hands out `$n` placeholders in order and remembers keyed ones. */
class ParamBag {
  public readonly values: unknown[] = [];
  private readonly keyed = new Map<string, string>();

  add(value: unknown): string {
    this.values.push(value);
    return `$${this.values.length}`;
  }

  once(key: string, value: unknown): string {
    const existing = this.keyed.get(key);
    if (existing) return existing;
    const placeholder = this.add(value);
    this.keyed.set(key, placeholder);
    return placeholder;
  }
}

// A Map, not an object literal: sortField comes from the client, and a plain object would also
// answer for inherited keys ("constructor", "toString", "__proto__", ...), whose values would then be
// interpolated into the SQL as text.
// Each field maps to the expressions it sorts by: the Task ID ("WL-12") sorts by project key, then by
// task number, so WL-2 comes before WL-10 (a plain text sort would put it after).
const SORT_COLUMNS = new Map<string, string[]>([
  ["date", ["twl.created_at"]],
  ["task_key", ["LOWER(p.key)", "t.task_no"]],
  ["task", ["LOWER(t.name)"]],
  ["member", ["LOWER(u.name)"]],
  ["project", ["LOWER(p.name)"]],
  ["client", ["LOWER(c.name)"]],
  ["duration", ["twl.time_spent"]],
]);

// The same fields for the "By task" view, where every row is an aggregate over a task's entries: the
// date is the task's latest entry, the duration its sum, and a task with several members sorts by
// the first of them alphabetically.
const TASK_VIEW_SORT_COLUMNS = new Map<string, string[]>([
  ["date", ["MAX(twl.created_at)"]],
  ["task_key", ["LOWER(p.key)", "t.task_no"]],
  ["task", ["LOWER(t.name)"]],
  ["member", ["MIN(LOWER(u.name))"]],
  ["project", ["LOWER(p.name)"]],
  ["client", ["LOWER(c.name)"]],
  ["duration", ["SUM(twl.time_spent)"]],
]);

const MEMBER_STATUS_EXPRESSION = `CASE
             WHEN tm.id IS NULL THEN 'removed'
             WHEN tm.active IS FALSE THEN 'deactivated'
             ELSE 'active'
           END`;

const FROM_CLAUSE = `
  FROM task_work_log twl
  JOIN tasks t ON t.id = twl.task_id
  JOIN projects p ON p.id = t.project_id
  JOIN users u ON u.id = twl.user_id
  LEFT JOIN clients c ON c.id = p.client_id
  LEFT JOIN team_members tm ON tm.user_id = twl.user_id AND tm.team_id = `;

const buildDateCondition = (bag: ParamBag, timezone: string, dateFrom?: string | null, dateTo?: string | null): string => {
  if (!dateFrom || !dateTo) return "";
  const tz = bag.once("tz", timezone);
  const from = bag.add(dateFrom);
  const to = bag.add(dateTo);
  return ` AND twl.created_at >= (${from}::date)::timestamp AT TIME ZONE ${tz}::text`
    + ` AND twl.created_at < ((${to}::date + 1)::timestamp AT TIME ZONE ${tz}::text)`;
};

const escapeLikePattern = (value: string): string => value.replace(/[\\%_]/g, "\\$&");

const buildWhere = (bag: ParamBag, filters: ITimeLogsFilters): string => {
  const team = bag.once("team", filters.teamId);
  let where = ` WHERE p.team_id = ${team}`;

  where += buildDateCondition(bag, filters.timezone, filters.dateFrom, filters.dateTo);

  if (filters.userIds?.length) {
    where += ` AND twl.user_id = ANY(${bag.add(filters.userIds)}::uuid[])`;
  }

  if (filters.projectIds?.length) {
    where += ` AND p.id = ANY(${bag.add(filters.projectIds)}::uuid[])`;
  }

  if (filters.clientIds?.length) {
    const includeNone = filters.clientIds.includes(NO_CLIENT_FILTER_ID);
    const clientIds = filters.clientIds.filter(id => id !== NO_CLIENT_FILTER_ID);
    const parts: string[] = [];
    if (clientIds.length) parts.push(`p.client_id = ANY(${bag.add(clientIds)}::uuid[])`);
    if (includeNone) parts.push("p.client_id IS NULL");
    where += ` AND (${parts.join(" OR ")})`;
  }

  if (filters.practiceIds?.length) {
    const includeNone = filters.practiceIds.includes(NO_PRACTICE_FILTER_ID);
    const practiceIds = filters.practiceIds.filter(id => id !== NO_PRACTICE_FILTER_ID);
    const parts: string[] = [];
    if (practiceIds.length) parts.push(`tm.practice_id = ANY(${bag.add(practiceIds)}::uuid[])`);
    // A removed member has no team_members row at all, so they fall under "no practice".
    if (includeNone) parts.push("tm.practice_id IS NULL");
    where += ` AND (${parts.join(" OR ")})`;
  }

  const { billable, nonBillable } = filters.billable ?? { billable: true, nonBillable: true };
  if (billable && !nonBillable) where += " AND t.billable IS TRUE";
  else if (nonBillable && !billable) where += " AND t.billable IS FALSE";

  const search = filters.search?.trim();
  if (search) {
    const pattern = bag.add(`%${escapeLikePattern(search)}%`);
    where += ` AND (t.name ILIKE ${pattern} OR p.name ILIKE ${pattern} OR u.name ILIKE ${pattern}`
      + ` OR CONCAT(p.key, '-', t.task_no) ILIKE ${pattern}`
      + ` OR COALESCE(twl.description, '') ILIKE ${pattern})`;
  }

  return where;
};

const buildOrderBy = (sortField?: string | null, sortOrder?: string | null): string => {
  const columns = sortField ? SORT_COLUMNS.get(sortField) : undefined;
  if (!columns) {
    // Default: newest day first, then by member — what the page has always shown.
    return "log_day DESC, LOWER(u.name) ASC, twl.created_at DESC, twl.id ASC";
  }
  const direction = String(sortOrder).toLowerCase() === "asc" ? "ASC" : "DESC";
  // NULLS LAST: client is the one sort column that can be NULL (a project without a client), and
  // those entries should sink to the bottom whichever way it is sorted.
  const sortedBy = columns.map(column => `${column} ${direction} NULLS LAST`).join(", ");
  return `${sortedBy}, twl.created_at DESC, twl.id ASC`;
};

const buildTaskViewOrderBy = (sortField?: string | null, sortOrder?: string | null): string => {
  const columns = sortField ? TASK_VIEW_SORT_COLUMNS.get(sortField) : undefined;
  // Default: the task logged on most recently first. `t.id` keeps the paging order stable.
  if (!columns) return "MAX(twl.created_at) DESC, t.id ASC";
  const direction = String(sortOrder).toLowerCase() === "asc" ? "ASC" : "DESC";
  const sortedBy = columns.map(column => `${column} ${direction} NULLS LAST`).join(", ");
  return `${sortedBy}, MAX(twl.created_at) DESC, t.id ASC`;
};

/** One page (or the capped full set, for exports) of time log rows. */
export const buildTimeLogsRowsQuery = (filters: ITimeLogsFilters, options: ITimeLogsQueryOptions = {}): IBuiltQuery => {
  const bag = new ParamBag();
  const tz = bag.once("tz", filters.timezone);
  const where = buildWhere(bag, filters);
  const team = bag.once("team", filters.teamId);
  const isTaskView = options.view === "task";

  // "By task": the same filters, applied to the entries *before* they are collapsed, so a task's sum
  // only covers the entries that match. `id` is the task id (the row's key); the date is the task's
  // latest entry; the descriptions are joined newest first; `members` lists everyone who logged on
  // the task, and `user_name` is the same people as one comma-separated string (used by exports).
  const taskViewSelect = `
    SELECT t.id AS id,
           to_char((MAX(twl.created_at) AT TIME ZONE ${tz}::text)::date, 'YYYY-MM-DD') AS log_day,
           p.id AS project_id,
           p.name AS project_name,
           p.client_id,
           c.name AS client_name,
           t.id AS task_id,
           CONCAT(p.key, '-', t.task_no) AS task_key,
           t.name AS task_name,
           t.billable,
           SUM(twl.time_spent)::FLOAT8 AS time_spent,
           COUNT(*)::INT AS entry_count,
           STRING_AGG(NULLIF(BTRIM(twl.description), ''), ' • ' ORDER BY twl.created_at DESC) AS description,
           STRING_AGG(DISTINCT u.name, ', ' ORDER BY u.name) AS user_name,
           JSONB_AGG(DISTINCT JSONB_BUILD_OBJECT(
             'user_id', twl.user_id,
             'user_name', u.name,
             'avatar_url', u.avatar_url,
             'member_status', ${MEMBER_STATUS_EXPRESSION}
           )) AS members
    ${FROM_CLAUSE}${team}
    ${where}
    GROUP BY t.id, t.name, t.task_no, t.billable, p.id, p.key, p.name, p.client_id, c.name
    ORDER BY ${buildTaskViewOrderBy(options.sortField, options.sortOrder)}`;

  const flatSelect = `
    SELECT twl.id,
           to_char((twl.created_at AT TIME ZONE ${tz}::text)::date, 'YYYY-MM-DD') AS log_day,
           twl.user_id,
           u.name AS user_name,
           u.avatar_url,
           ${MEMBER_STATUS_EXPRESSION} AS member_status,
           p.id AS project_id,
           p.name AS project_name,
           p.client_id,
           c.name AS client_name,
           t.id AS task_id,
           CONCAT(p.key, '-', t.task_no) AS task_key,
           t.name AS task_name,
           t.billable,
           twl.time_spent::FLOAT8 AS time_spent,
           twl.description
    ${FROM_CLAUSE}${team}
    ${where}
    ORDER BY ${buildOrderBy(options.sortField, options.sortOrder)}`;

  let text = isTaskView ? taskViewSelect : flatSelect;

  if (options.limit !== undefined) text += ` LIMIT ${bag.add(options.limit)}`;
  if (options.offset !== undefined) text += ` OFFSET ${bag.add(options.offset)}`;

  return { text, values: bag.values };
};

/**
 * Entry count, task count and summed seconds of the *whole* filtered set (not just a page). The
 * task count is what pages the "By task" view; the entry count is what the other views report.
 */
export const buildTimeLogsTotalsQuery = (filters: ITimeLogsFilters): IBuiltQuery => {
  const bag = new ParamBag();
  const where = buildWhere(bag, filters);
  const team = bag.once("team", filters.teamId);

  const text = `
    SELECT COUNT(*)::INT AS total,
           COUNT(DISTINCT t.id)::INT AS total_tasks,
           COALESCE(SUM(twl.time_spent), 0)::FLOAT8 AS total_seconds
    ${FROM_CLAUSE}${team}
    ${where}`;

  return { text, values: bag.values };
};

interface IGroupConfig {
  /** Text id of the group; also what the client filters on to open it. */
  key: string;
  label: string;
  /** Extra select columns describing the group's own dimension (avatar, colour, status). */
  extraSelect: string;
  groupBy: string;
}

// Same constraint as the sort maps: the key comes from the client, so a Map keeps inherited names
// ("constructor", ...) from resolving to a value that would be interpolated into the SQL.
const GROUP_CONFIGS = new Map<TimeLogsGroupBy, IGroupConfig>([
  [
    "member",
    {
      key: "u.id::text",
      label: "u.name",
      extraSelect: `u.avatar_url AS group_avatar_url,
           NULL::text AS group_color,
           MAX(${MEMBER_STATUS_EXPRESSION}) AS group_status`,
      groupBy: "u.id, u.name, u.avatar_url",
    },
  ],
  [
    "project",
    {
      key: "p.id::text",
      label: "p.name",
      extraSelect: `NULL::text AS group_avatar_url,
           p.color_code AS group_color,
           NULL::text AS group_status`,
      groupBy: "p.id, p.name, p.color_code",
    },
  ],
  [
    "client",
    {
      // Projects without a client form one group, filterable through the same sentinel as the
      // Client filter ("No client").
      key: `COALESCE(c.id::text, '${NO_CLIENT_FILTER_ID}')`,
      label: "c.name",
      extraSelect: `NULL::text AS group_avatar_url,
           NULL::text AS group_color,
           NULL::text AS group_status`,
      groupBy: "c.id, c.name",
    },
  ],
]);

/**
 * One page of groups (Member, Project or Client) of the filtered entries, each with its rollup:
 * how many entries and tasks it holds and how the time splits between billable and non-billable.
 * The groups are paged, not the entries inside them — a group's entries are loaded on demand with
 * the ordinary list query, narrowed to that group.
 */
export const buildTimeLogsGroupsQuery = (
  filters: ITimeLogsFilters,
  groupBy: TimeLogsGroupBy,
  options: Pick<ITimeLogsQueryOptions, "limit" | "offset"> = {}
): IBuiltQuery => {
  const config = GROUP_CONFIGS.get(groupBy);
  if (!config) throw new TimeLogsFilterError("Invalid group_by");

  const bag = new ParamBag();
  const where = buildWhere(bag, filters);
  const team = bag.once("team", filters.teamId);

  // Billable here means what the Time Entries page means by it: a task flagged billable. A task
  // with no flag counts as non-billable, so the two halves always add up to the group's total.
  const isBillable = "COALESCE(t.billable, FALSE)";

  let text = `
    SELECT ${config.key} AS group_key,
           ${config.label} AS group_label,
           ${config.extraSelect},
           COALESCE(SUM(twl.time_spent), 0)::FLOAT8 AS subtotal,
           COUNT(*)::INT AS entry_count,
           COUNT(DISTINCT t.id)::INT AS task_count,
           COUNT(DISTINCT p.id)::INT AS project_count,
           COUNT(DISTINCT twl.user_id)::INT AS member_count,
           COUNT(*) FILTER (WHERE ${isBillable})::INT AS billable_entry_count,
           COUNT(DISTINCT t.id) FILTER (WHERE ${isBillable})::INT AS billable_task_count,
           COALESCE(SUM(twl.time_spent) FILTER (WHERE ${isBillable}), 0)::FLOAT8 AS billable_time,
           COUNT(*) FILTER (WHERE NOT ${isBillable})::INT AS non_billable_entry_count,
           COUNT(DISTINCT t.id) FILTER (WHERE NOT ${isBillable})::INT AS non_billable_task_count,
           COALESCE(SUM(twl.time_spent) FILTER (WHERE NOT ${isBillable}), 0)::FLOAT8 AS non_billable_time,
           COUNT(*) OVER()::INT AS total_groups
    ${FROM_CLAUSE}${team}
    ${where}
    GROUP BY ${config.groupBy}
    ORDER BY LOWER(${config.label}) ASC NULLS LAST, ${config.key} ASC`;

  if (options.limit !== undefined) text += ` LIMIT ${bag.add(options.limit)}`;
  if (options.offset !== undefined) text += ` OFFSET ${bag.add(options.offset)}`;

  return { text, values: bag.values };
};

/**
 * Member options for the filter: every active member, plus deactivated and
 * removed users **only if they logged time** in the given range.
 */
export const buildTimeLogMembersQuery = (
  filters: Pick<ITimeLogsFilters, "teamId" | "timezone" | "dateFrom" | "dateTo">
): IBuiltQuery => {
  const bag = new ParamBag();
  const team = bag.once("team", filters.teamId);
  const dateCondition = buildDateCondition(bag, filters.timezone, filters.dateFrom, filters.dateTo);

  const text = `
    WITH logged_users AS (
      SELECT DISTINCT twl.user_id
      FROM task_work_log twl
      JOIN tasks t ON t.id = twl.task_id
      JOIN projects p ON p.id = t.project_id
      WHERE p.team_id = ${team}${dateCondition}
    )
    SELECT m.*
    FROM (
      SELECT u.id AS user_id, u.name, u.email, u.avatar_url,
             tm.id AS team_member_id,
             (tm.active IS TRUE) AS is_active,
             FALSE AS is_removed
      FROM team_members tm
      JOIN users u ON u.id = tm.user_id
      WHERE tm.team_id = ${team}
        AND (tm.active IS TRUE OR tm.user_id IN (SELECT user_id FROM logged_users))
      UNION ALL
      SELECT u.id, u.name, u.email, u.avatar_url,
             NULL::uuid, FALSE, TRUE
      FROM users u
      WHERE u.id IN (SELECT user_id FROM logged_users)
        AND NOT EXISTS (SELECT 1 FROM team_members tm WHERE tm.user_id = u.id AND tm.team_id = ${team})
    ) m
    ORDER BY m.is_active DESC, LOWER(m.name) ASC`;

  return { text, values: bag.values };
};

// ---------------------------------------------------------------------------
// Request parsing
// ---------------------------------------------------------------------------

/** Accepts an array or a comma-separated string (GET exports) and validates each id. */
export const parseIdList = (value: unknown, label: string, extraAllowed: string[] = []): string[] => {
  if (value === undefined || value === null || value === "") return [];
  const raw = Array.isArray(value) ? value : String(value).split(",");
  const ids = Array.from(new Set(raw.map(v => String(v).trim()).filter(Boolean)));
  for (const id of ids) {
    if (!UUID_REGEX.test(id) && !extraAllowed.includes(id)) {
      throw new TimeLogsFilterError(`Invalid ${label} id`);
    }
  }
  return ids;
};

const parseDate = (value: unknown, label: string): string | null => {
  if (value === undefined || value === null || value === "") return null;
  const text = String(value);
  if (!moment(text, DATE_FORMAT, true).isValid()) {
    throw new TimeLogsFilterError(`Invalid ${label} date`);
  }
  return text;
};

const parseBillable = (value: unknown): ITimeLogsBillable | null => {
  if (value === undefined || value === null || value === "") return null;
  let parsed: unknown = value;
  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value);
    } catch {
      throw new TimeLogsFilterError("Invalid billable filter");
    }
  }
  if (typeof parsed !== "object" || parsed === null) throw new TimeLogsFilterError("Invalid billable filter");
  const { billable, nonBillable } = parsed as Partial<ITimeLogsBillable>;
  return { billable: billable !== false, nonBillable: nonBillable !== false };
};

/**
 * Turns a POST body or GET query into validated filters. In `all` mode only
 * the date range survives: "Export all" keeps the range but drops every other
 * narrowing filter.
 */
export const parseTimeLogsFilters = (
  raw: Record<string, unknown>,
  context: { teamId: string; timezone: string },
  mode: TimeLogsExportMode = "filtered"
): ITimeLogsFilters => {
  const dateFrom = parseDate(raw.date_from, "start");
  const dateTo = parseDate(raw.date_to, "end");
  if ((dateFrom && !dateTo) || (!dateFrom && dateTo)) {
    throw new TimeLogsFilterError("Both a start and an end date are required");
  }
  if (dateFrom && dateTo && dateFrom > dateTo) {
    throw new TimeLogsFilterError("Start date must not be after end date");
  }

  const base: ITimeLogsFilters = { ...context, dateFrom, dateTo };
  if (mode === "all") return base;

  const search = typeof raw.search === "string" ? raw.search.trim().slice(0, MAX_SEARCH_LENGTH) : "";
  return {
    ...base,
    userIds: parseIdList(raw.user_ids, "member"),
    projectIds: parseIdList(raw.project_ids, "project"),
    practiceIds: parseIdList(raw.practice_ids, "practice", [NO_PRACTICE_FILTER_ID]),
    clientIds: parseIdList(raw.client_ids, "client", [NO_CLIENT_FILTER_ID]),
    billable: parseBillable(raw.billable),
    search: search || null,
  };
};

/** Anything but "task" is the flat view, so an old or unknown value never breaks the page. */
export const parseTimeLogsView = (value: unknown): TimeLogsView => (value === "task" ? "task" : "flat");

/** The grouping the request asks for; `null` when there is none (flat / by-task table). */
export const parseTimeLogsGroupBy = (value: unknown): TimeLogsGroupBy | null => {
  if (value === undefined || value === null || value === "" || value === "none") return null;
  if (value === "member" || value === "project" || value === "client") return value;
  throw new TimeLogsFilterError("group_by must be one of: none, member, project, client");
};

export const parsePagination = (raw: Record<string, unknown>): { page: number; pageSize: number } => {
  const page = Math.max(1, Math.floor(Number(raw.page)) || 1);
  const requested = Math.floor(Number(raw.page_size)) || TIME_LOGS_DEFAULT_PAGE_SIZE;
  return { page, pageSize: Math.min(Math.max(1, requested), TIME_LOGS_MAX_PAGE_SIZE) };
};
