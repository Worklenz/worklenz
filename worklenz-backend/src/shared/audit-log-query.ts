/**
 * Shared filter parsing + WHERE-clause building for the Audit Log read path
 * (Audit log spec, tasks 4 and 5).
 *
 * Factored out of AuditLogController so the paginated list endpoint (task 4.1/4.2/4.3) and
 * both export paths (task 5.1 sync CSV, 5.2 async export job) build the *exact* same SQL
 * condition set from the *exact* same query params - "export honoring current filters" (5.1)
 * is otherwise just a comment, not a guarantee.
 */

import moment from "moment-timezone";

import { AUDIT_EVENT_TYPE, isValidAuditEventCategory } from "./audit-log-constants";

export interface AuditLogFilters {
  startDate: string;
  endDate: string;
  categories: string[];
  actorUserIds: string[];
  search: string;
  /**
   * IANA zone the start/end dates are local calendar days in (the viewer's profile timezone,
   * same convention as Reports > Time Logs). Optional because export jobs queued before this
   * field existed have it missing from their stored filters; those fall back to the database
   * session timezone.
   */
  timezone?: string;
}

const splitCsv = (value: unknown): string[] =>
  (typeof value === "string" ? value : "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);

/** Returns the zone name when it is a known IANA zone, otherwise "" - an unknown name would
 * make Postgres reject the whole query. */
export function resolveAuditLogTimezone(timezone: unknown): string {
  if (typeof timezone !== "string") return "";
  const trimmed = timezone.trim();
  return trimmed && moment.tz.zone(trimmed) ? trimmed : "";
}

/** Parses + validates raw query params into the filter shape every call site shares. */
export function parseAuditLogFilters(query: Record<string, unknown>, timezone?: string | null): AuditLogFilters {
  return {
    startDate: (query.start_date as string || "").trim(),
    endDate: (query.end_date as string || "").trim(),
    categories: splitCsv(query.category).filter((c) => isValidAuditEventCategory(c)),
    actorUserIds: splitCsv(query.actor_user_id),
    search: (query.search as string || "").trim(),
    timezone: resolveAuditLogTimezone(timezone),
  };
}

const escapeLikePattern = (value: string): string => value.replace(/[\\%_]/g, "\\$&");

/** Finds every catalogued event type whose human-readable label matches the free-text term. */
export function matchingEventTypeIdsForSearch(search: string): string[] {
  const needle = search.toLowerCase();
  return Object.values(AUDIT_EVENT_TYPE)
    .filter((eventType) => eventType.defaultLabel.toLowerCase().includes(needle))
    .map((eventType) => eventType.id);
}

export interface AuditLogWhereClause {
  /** Always starts with "organization_id = $1" - $1 is the organizationId passed in. */
  whereClause: string;
  /** params[0] is always organizationId; the rest line up with the placeholders above. */
  params: unknown[];
  /** The next free placeholder index - callers append LIMIT/OFFSET (or nothing) from here. */
  nextParamIndex: number;
}

/** Builds the WHERE clause + params shared by the list, sync-export, and async-export paths. */
export function buildAuditEventsWhereClause(
  organizationId: string,
  filters: AuditLogFilters
): AuditLogWhereClause {
  const conditions: string[] = ["organization_id = $1"];
  const params: unknown[] = [organizationId];
  let paramIndex = 2;

  const timezone = resolveAuditLogTimezone(filters.timezone);
  let timezoneParam: number | null = null;
  const timezonePlaceholder = (): number => {
    if (timezoneParam === null) {
      timezoneParam = paramIndex++;
      params.push(timezone);
    }
    return timezoneParam;
  };

  // Bounds are converted to instants (rather than casting the column) so the filter stays on
  // the (organization_id, created_at) index and agrees with the viewer's calendar day.
  if (filters.startDate) {
    const dateParam = paramIndex++;
    params.push(filters.startDate);
    conditions.push(
      timezone
        ? `created_at >= ($${dateParam}::DATE)::TIMESTAMP AT TIME ZONE $${timezonePlaceholder()}::TEXT`
        : `created_at >= $${dateParam}::DATE`
    );
  }

  if (filters.endDate) {
    const dateParam = paramIndex++;
    params.push(filters.endDate);
    conditions.push(
      timezone
        ? `created_at < (($${dateParam}::DATE + 1)::TIMESTAMP AT TIME ZONE $${timezonePlaceholder()}::TEXT)`
        : `created_at < ($${dateParam}::DATE + INTERVAL '1 day')`
    );
  }

  if (filters.categories.length) {
    conditions.push(`category = ANY($${paramIndex}::TEXT[])`);
    params.push(filters.categories);
    paramIndex++;
  }

  if (filters.actorUserIds.length) {
    conditions.push(`actor_user_id = ANY($${paramIndex}::UUID[])`);
    params.push(filters.actorUserIds);
    paramIndex++;
  }

  if (filters.search) {
    const searchPattern = `%${escapeLikePattern(filters.search)}%`;
    const matchingEventTypes = matchingEventTypeIdsForSearch(filters.search);

    const descriptionParam = paramIndex++;
    const actorNameParam = paramIndex++;
    params.push(searchPattern, searchPattern);

    let searchCondition = `(description ILIKE $${descriptionParam} OR actor_name ILIKE $${actorNameParam})`;
    if (matchingEventTypes.length) {
      const eventTypeParam = paramIndex++;
      params.push(matchingEventTypes);
      searchCondition = `(${searchCondition} OR event_type = ANY($${eventTypeParam}::TEXT[]))`;
    }

    conditions.push(searchCondition);
  }

  return { whereClause: conditions.join(" AND "), params, nextParamIndex: paramIndex };
}
