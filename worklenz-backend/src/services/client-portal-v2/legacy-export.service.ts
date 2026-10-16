import db from "../../config/db";
import { badRequest } from "./errors";
import { csvCell } from "./audit-log.service";

/**
 * Read-only export of the Client Portal v1 modules that v2 retires (Services, Requests, Ticketing,
 * Chats). The tables are kept after cutover; this lets an Owner or Admin save a copy of the data
 * before the separate migration that drops them. Nothing here writes.
 */

export const LEGACY_MODULES = ["requests", "services", "tickets", "chats"] as const;
export type LegacyModule = (typeof LEGACY_MODULES)[number];

/** `team` tables carry organization_team_id; `request` rows are reached through their parent request. */
interface LegacyTable {
  name: string;
  scope: "team" | "request";
}

/** An allow-list: the table name is interpolated into SQL, so it must never come from the caller. */
const MODULE_TABLES: Record<LegacyModule, LegacyTable[]> = {
  requests: [
    { name: "client_portal_requests", scope: "team" },
    { name: "client_portal_request_comments", scope: "team" },
    { name: "client_portal_request_status_history", scope: "request" },
    { name: "client_portal_request_custom_statuses", scope: "team" },
  ],
  services: [
    { name: "client_portal_services", scope: "team" },
    { name: "client_portal_service_option_values", scope: "team" },
  ],
  tickets: [
    { name: "client_portal_tickets", scope: "team" },
    { name: "client_portal_ticket_comments", scope: "team" },
    { name: "client_portal_ticket_attachments", scope: "team" },
    { name: "client_portal_ticket_custom_statuses", scope: "team" },
  ],
  chats: [{ name: "client_portal_chat_messages", scope: "team" }],
};

const ROW_LIMIT = 50000;

export const isLegacyModule = (value: string): value is LegacyModule =>
  (LEGACY_MODULES as readonly string[]).includes(value);

export const legacyTableNames = (module: LegacyModule): string[] => MODULE_TABLES[module].map(table => table.name);

async function readTable(teamId: string, table: LegacyTable): Promise<Record<string, unknown>[]> {
  const where =
    table.scope === "team"
      ? `t.organization_team_id = $1`
      : `t.request_id IN (SELECT id FROM client_portal_requests WHERE organization_team_id = $1)`;
  const result = await db.query(
    `SELECT to_jsonb(t) AS row FROM ${table.name} t WHERE ${where} ORDER BY t.id LIMIT ${ROW_LIMIT}`,
    [teamId]
  );
  return result.rows.map(row => row.row as Record<string, unknown>);
}

/** Every table of the module as JSON, for a complete copy. */
export async function exportLegacyModuleJson(teamId: string, module: LegacyModule) {
  const tables: Record<string, Record<string, unknown>[]> = {};
  for (const table of MODULE_TABLES[module]) tables[table.name] = await readTable(teamId, table);
  return { module, exported_at: new Date().toISOString(), row_limit: ROW_LIMIT, tables };
}

const cellText = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  return typeof value === "object" ? JSON.stringify(value) : String(value);
};

/** One table as CSV: the union of its columns, nested values as JSON, formula-safe cells. */
export async function exportLegacyTableCsv(teamId: string, module: LegacyModule, tableName: string): Promise<string> {
  const table = MODULE_TABLES[module].find(entry => entry.name === tableName);
  if (!table) throw badRequest(`The ${module} export has no table called ${tableName}`, "UNKNOWN_TABLE");

  const rows = await readTable(teamId, table);
  const columns: string[] = [];
  for (const row of rows) for (const key of Object.keys(row)) if (!columns.includes(key)) columns.push(key);

  const lines = [columns.map(csvCell).join(",")];
  for (const row of rows) lines.push(columns.map(column => csvCell(cellText(row[column]))).join(","));
  return `${lines.join("\r\n")}\r\n`;
}
