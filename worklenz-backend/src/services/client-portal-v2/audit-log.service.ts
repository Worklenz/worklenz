import db from "../../config/db";
import { badRequest } from "./errors";
import { AUDIT_EVENT_TYPES, AuditEventType, PortalSide } from "./types";
import { containsPattern } from "./list-params";

export interface AuditEventView {
  id: string;
  at: string;
  actor: string;
  side: PortalSide;
  type: AuditEventType;
  event: string;
  target: string;
  organization_id: string | null;
  organization_name: string | null;
}

export interface AuditParams {
  search?: string;
  type?: string;
  side?: string;
  organization_id?: string;
  /** ISO instants; the range is inclusive of date_from and exclusive of date_to. */
  date_from?: string;
  date_to?: string;
  page?: number;
  limit?: number;
}

// $1 = team id. Filters are appended as further numbered parameters.
const AUDIT_SELECT = `
  SELECT e.id, e.created_at AS at, e.actor_name AS actor, e.actor_side AS side, e.event_type AS type,
         e.event_key AS event, e.target_label AS target, e.target_type, e.client_id AS organization_id,
         COALESCE(e.client_name, NULLIF(TRIM(c.company_name), ''), c.name) AS organization_name
    FROM client_portal_audit_events e
    LEFT JOIN clients c ON c.id = e.client_id
   WHERE e.team_id = $1
`;

function buildFilters(teamId: string, params: AuditParams): { where: string; values: unknown[] } {
  const filters: string[] = [];
  const values: unknown[] = [teamId];

  const search = (params.search ?? "").trim();
  if (search) {
    const n = values.push(containsPattern(search));
    filters.push(`(e.actor_name ILIKE $${n} OR e.event_key ILIKE $${n} OR e.target_label ILIKE $${n})`);
  }
  // Each filter accepts a comma-separated list so the list can multi-select.
  const toList = (value?: string) => (value ?? "").split(",").map(item => item.trim()).filter(Boolean);
  const types = toList(params.type);
  if (types.length) {
    if (types.some(item => !(AUDIT_EVENT_TYPES as readonly string[]).includes(item))) throw badRequest("Invalid event type filter");
    filters.push(`e.event_type = ANY($${values.push(types)}::text[])`);
  }
  const sides = toList(params.side);
  if (sides.length) {
    if (sides.some(item => item !== "client" && item !== "internal")) throw badRequest("Invalid side filter");
    filters.push(`e.actor_side = ANY($${values.push(sides)}::text[])`);
  }
  const organizationIds = toList(params.organization_id);
  if (organizationIds.length) filters.push(`e.client_id::text = ANY($${values.push(organizationIds)}::text[])`);
  for (const [value, operator] of [[params.date_from, ">="], [params.date_to, "<"]] as const) {
    if (!value) continue;
    const instant = new Date(value);
    if (Number.isNaN(instant.getTime())) throw badRequest("Invalid date filter");
    filters.push(`e.created_at ${operator} $${values.push(instant.toISOString())}::timestamptz`);
  }

  return { where: filters.length ? `AND ${filters.join(" AND ")}` : "", values };
}

export async function listAuditEvents(teamId: string, params: AuditParams) {
  const page = Math.max(Number(params.page) || 1, 1);
  const limit = Math.min(Math.max(Number(params.limit) || 10, 1), 100);
  const { where, values } = buildFilters(teamId, params);
  const limitParam = values.push(limit);
  const offsetParam = values.push((page - 1) * limit);

  const result = await db.query(
    `SELECT l.*, COUNT(*) OVER()::int AS total_count
       FROM (${AUDIT_SELECT} ${where}) l
      ORDER BY l.at DESC, l.id
      LIMIT $${limitParam} OFFSET $${offsetParam}`,
    values
  );

  return {
    items: result.rows.map(row => ({
      id: row.id,
      at: row.at,
      actor: row.actor,
      side: row.side,
      type: row.type,
      event: row.event,
      target: row.target,
      target_type: row.target_type ?? null,
      organization_id: row.organization_id ?? null,
      organization_name: row.organization_name ?? null,
    })) as AuditEventView[],
    total: result.rows[0]?.total_count ?? 0,
    page,
    limit,
  };
}

const EXPORT_ROW_LIMIT = 5000;

/**
 * A CSV cell. Quotes are doubled, and a value that starts with = + - @ (or a tab / carriage return)
 * is prefixed so a spreadsheet opens it as text instead of running it as a formula: actor names and
 * target labels come from clients and must never be able to inject one.
 */
export function csvCell(value: unknown): string {
  let text = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

/** The current filtered view as CSV, newest first, capped at EXPORT_ROW_LIMIT rows. */
export async function exportAuditCsv(teamId: string, params: AuditParams): Promise<string> {
  const { where, values } = buildFilters(teamId, params);
  const limitParam = values.push(EXPORT_ROW_LIMIT);

  const result = await db.query(
    `SELECT l.* FROM (${AUDIT_SELECT} ${where}) l ORDER BY l.at DESC, l.id LIMIT $${limitParam}`,
    values
  );

  const header = ["When", "Actor", "Side", "Event", "Target", "Client"];
  const lines = [header.map(csvCell).join(",")];
  for (const row of result.rows) {
    lines.push(
      [
        new Date(row.at).toISOString(),
        row.actor,
        row.side === "client" ? "Client" : "Internal",
        row.event,
        row.target,
        row.organization_name ?? "",
      ]
        .map(csvCell)
        .join(",")
    );
  }
  return `${lines.join("\r\n")}\r\n`;
}
