/**
 * CSV formatting for the Audit Log export (Audit log spec, task 5.3).
 *
 * Columns intentionally match the on-screen table 1:1 (Timestamp, Actor, Category, Event,
 * Details) - see the design mockup's `wl-table` headers in
 * worklenz-audit-log-prototype.html - so the exported file reads the same as what an Owner/
 * Admin was just looking at when they clicked Export.
 *
 * Escaping/formula-injection safety is delegated entirely to shared/csv-utils.ts
 * (encodeCsv/formatCsvCell), which already RFC-4180-quotes every cell and neutralizes the
 * OWASP CSV/formula-injection leading characters (=, +, -, @, tab, CR) by prefixing a single
 * quote - the same helper already used by the Time Logs CSV export
 * (controllers/reporting/time-logs-export.ts), so this doesn't introduce a second escaping
 * implementation to keep in sync.
 */

import { encodeCsv } from "./csv-utils";
import { AUDIT_EVENT_CATEGORY, AUDIT_EVENT_TYPE } from "./audit-log-constants";

export const AUDIT_LOG_CSV_HEADERS = ["Timestamp", "Actor", "Category", "Event", "Details"] as const;

/** The minimal row shape the CSV builder needs - matches audit_events' exported columns. */
export interface AuditLogCsvRow {
  created_at: string | Date;
  actor_name: string;
  category: string;
  event_type: string;
  description: string;
  old_value?: string | null;
  new_value?: string | null;
}

const EMPTY_CHANGE_VALUE = "(none)";

const CATEGORY_LABEL_BY_ID: Record<string, string> = Object.values(AUDIT_EVENT_CATEGORY).reduce(
  (acc, def) => ({ ...acc, [def.id]: def.defaultLabel }),
  {}
);

const EVENT_TYPE_LABEL_BY_ID: Record<string, string> = Object.values(AUDIT_EVENT_TYPE).reduce(
  (acc, def) => ({ ...acc, [def.id]: def.defaultLabel }),
  {}
);

/** "login_failed" -> "Login failed" fallback for an event_type with no catalogued label. */
const humanizeEventTypeFallback = (eventType: string): string =>
  eventType.replace(/_/g, " ").replace(/^(.)/, (c) => c.toUpperCase());

/**
 * ISO 8601 UTC - unambiguous across timezones/locales, which matters for a file meant to be
 * handed to an external ISMS/PCI DSS auditor (per the spec's own framing) rather than just
 * read by the Owner who exported it.
 */
const formatTimestamp = (createdAt: string | Date): string => new Date(createdAt).toISOString();

/** Same content as the on-screen Details cell: the description, then "old → new" when the
 * entry recorded a change. Several descriptions don't repeat the values themselves (e.g.
 * "Workspace owner contact number updated"), so dropping them would lose the evidence. */
const formatDetails = (row: AuditLogCsvRow): string => {
  const hasChange = row.old_value != null || row.new_value != null;
  if (!hasChange) return row.description;
  return `${row.description} (${row.old_value ?? EMPTY_CHANGE_VALUE} → ${row.new_value ?? EMPTY_CHANGE_VALUE})`;
};

/** Builds the full export CSV (header + one row per entry), newest-first order is the
 * caller's responsibility (same ORDER BY as the list endpoint - see audit-log-query.ts). */
export const buildAuditLogCsv = (rows: AuditLogCsvRow[]): string => {
  const dataRows = rows.map((row) => [
    formatTimestamp(row.created_at),
    row.actor_name,
    CATEGORY_LABEL_BY_ID[row.category] ?? row.category,
    EVENT_TYPE_LABEL_BY_ID[row.event_type] ?? humanizeEventTypeFallback(row.event_type),
    formatDetails(row),
  ]);

  return encodeCsv([...AUDIT_LOG_CSV_HEADERS], dataRows);
};

/** `audit-log-export-2026-10-06.csv` */
export const getAuditLogExportFileName = (date: string = new Date().toISOString().slice(0, 10)): string =>
  `audit-log-export-${date}.csv`;
