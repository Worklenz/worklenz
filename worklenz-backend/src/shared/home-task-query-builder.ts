// Pure, DB-free SQL fragment builders for the Home "My Tasks"/"Unassigned
// tasks" paginated list — kept out of home-page-controller.ts (which imports
// `db` and therefore `pg` at module scope) so these can be unit tested
// without pulling in a live Postgres client. For the same reason this
// doesn't import shared/utils.ts's escapeHtmlEntities — that module also
// pulls in shared/slack.ts's HTTP client, which trips this repo's
// automock:true Jest config the same way `db` does.
import { isValidUuid } from "./validation-helpers";

// Same entity mapping as shared/utils.ts's escapeHtmlEntities, duplicated
// here (see import comment above) — names are stored HTML-escaped via
// sanitizePlainText, so the search term needs the same escaping to match.
function escapeHtmlEntities(value: string): string {
  if (!value) return "";
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export const TASK_SORT_FIELDS: Record<string, string> = {
  name: "t.name",
  project_name: "p.name",
  end_date: "t.end_date",
  priority: "tp.value",
  status: "ts.name",
};

export function toArray(v: unknown): string[] {
  if (v === undefined || v === null || v === "") return [];
  return (Array.isArray(v) ? v : [v]).map(String).filter(Boolean);
}

// Same as toArray, but drops entries that aren't valid UUIDs — used for the
// id-shaped filters (priority/project/assignee) so a malformed value is
// silently ignored instead of reaching Postgres and throwing (which
// @HandleExceptions turns into an empty 200 — the exact failure mode this
// query rewrite exists to fix, one layer up).
export function toUuidArray(v: unknown): string[] {
  return toArray(v).filter(isValidUuid);
}

// escapeHtmlEntities matches how names are stored (sanitizePlainText HTML-
// escapes on save, same as every other paginated list's search — see
// worklenz-controller-base.ts's toPaginationOptions), but it doesn't touch
// ILIKE wildcard metacharacters. Escape those too and pair with an ESCAPE
// clause so a literal "%" or "_" in the search box doesn't behave as a
// wildcard.
export function escapeLikePattern(value: string): string {
  return escapeHtmlEntities(value).replace(/[\\%_]/g, ch => `\\${ch}`);
}

export interface TaskFilterQuery {
  status?: unknown;
  priority_ids?: unknown;
  project_ids?: unknown;
  assignee_ids?: unknown;
  search?: unknown;
  overdue_only?: unknown;
  no_due_only?: unknown;
}

// Builds the WHERE clause for the "My Tasks" filter params (status/priority/
// project/assignee/search/overdue_only/no_due_only), pushing each value onto
// `values` in order. Shared by the paginated task list, its counts query, and
// the unassigned-tasks list/count so all four can never drift out of sync.
// `paramOffset` is the number of positional params ($1, $2, ...) the caller's
// base query has already used before this clause's own params begin.
// `tzParamIndex` is the fixed positional param ($N) the caller has already
// bound the caller's time_zone to (see buildTabClause below for why this is
// a separate, fixed index rather than one more entry in `values`).
export function buildTaskFilterClauses(
  query: TaskFilterQuery,
  values: unknown[],
  paramOffset: number,
  tzParamIndex: number
): string {
  const clauses: string[] = [];
  const nextParam = () => paramOffset + values.length;

  const statuses = toArray(query.status).map(s => s.toLowerCase());
  if (statuses.length) {
    values.push(statuses);
    clauses.push(`LOWER(ts.name) = ANY($${nextParam()})`);
  }

  const priorityIds = toUuidArray(query.priority_ids);
  if (priorityIds.length) {
    values.push(priorityIds);
    clauses.push(`t.priority_id = ANY($${nextParam()})`);
  }

  const projectIds = toUuidArray(query.project_ids);
  if (projectIds.length) {
    values.push(projectIds);
    clauses.push(`t.project_id = ANY($${nextParam()})`);
  }

  const assigneeIds = toUuidArray(query.assignee_ids);
  if (assigneeIds.length) {
    values.push(assigneeIds);
    clauses.push(`EXISTS (SELECT 1 FROM tasks_assignees ta2 WHERE ta2.task_id = t.id AND ta2.team_member_id = ANY($${nextParam()}))`);
  }

  const search = ((query.search as string) || "").trim();
  if (search) {
    values.push(`%${escapeLikePattern(search)}%`);
    const idx = nextParam();
    clauses.push(`(t.name ILIKE $${idx} ESCAPE '\\' OR (p.key || '-' || t.task_no::TEXT) ILIKE $${idx} ESCAPE '\\')`);
  }

  if (query.overdue_only === "true") {
    clauses.push(`t.end_date IS NOT NULL AND (t.end_date AT TIME ZONE $${tzParamIndex})::DATE < (NOW() AT TIME ZONE $${tzParamIndex})::DATE AND NOT is_completed(t.status_id, t.project_id)`);
  }
  if (query.no_due_only === "true") {
    clauses.push(`t.end_date IS NULL`);
  }

  return clauses.length ? `AND ${clauses.join(" AND ")}` : "";
}

export function buildTaskOrderClause(query: { sort_field?: unknown; sort_order?: unknown }): string {
  const field = TASK_SORT_FIELDS[(query.sort_field as string) || ""] || "t.end_date";
  const order = ((query.sort_order as string) || "").toLowerCase() === "desc" ? "DESC" : "ASC";
  // t.id is a tiebreaker: without it, ties on `field` have no guaranteed
  // ordering across separate LIMIT/OFFSET pages, so rows can duplicate onto
  // one page and disappear from another.
  return `ORDER BY ${field} ${order} NULLS LAST, t.id ASC`;
}

// Tab predicate for the server-paginated My Tasks / Overview list
// (All/Today/Upcoming/Overdue/NoDueDate/UpcomingNowOn). Shared between the
// task list itself and its counts query so the two can't disagree — same tz
// param convention as buildTaskFilterClauses's overdue_only clause.
export function buildTabClause(tab: string, tzParamIndex: number): string {
  const todayInTz = `(NOW() AT TIME ZONE $${tzParamIndex})::DATE`;
  const endDateInTz = `(t.end_date AT TIME ZONE $${tzParamIndex})::DATE`;
  switch (tab) {
    case "Today":
      return `AND ${endDateInTz} = ${todayInTz}`;
    case "Upcoming":
      return `AND ${endDateInTz} > ${todayInTz}`;
    case "Overdue":
      return `AND t.end_date IS NOT NULL AND ${endDateInTz} < ${todayInTz} AND NOT is_completed(t.status_id, t.project_id)`;
    case "UpcomingNowOn":
      return `AND ${endDateInTz} >= ${todayInTz}`;
    case "NoDueDate":
      return `AND t.end_date IS NULL`;
    case "All":
    default:
      return "";
  }
}
