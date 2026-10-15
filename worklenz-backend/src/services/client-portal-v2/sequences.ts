import { Queryable } from "./types";

/**
 * Per-team reference numbers: AP-000123 for approvals and CR-0048 for change requests.
 *
 * A number is taken with an atomic upsert-increment, so two concurrent requests can never receive
 * the same one. A committed number is never handed out again, including for a draft that is later
 * cancelled. Call this inside the transaction that inserts the row: if that transaction rolls back,
 * the increment rolls back with it, so no number is issued for a row that never existed.
 */
async function nextNumber(q: Queryable, table: string, teamId: string): Promise<number> {
  const result = await q.query(
    `INSERT INTO ${table} (organization_team_id, last_number)
     VALUES ($1, 1)
     ON CONFLICT (organization_team_id)
     DO UPDATE SET last_number = ${table}.last_number + 1, updated_at = CURRENT_TIMESTAMP
     RETURNING last_number`,
    [teamId]
  );
  return Number(result.rows[0].last_number);
}

export const formatApprovalRef = (n: number) => `AP-${String(n).padStart(6, "0")}`;
export const formatChangeRequestNo = (n: number) => `CR-${String(n).padStart(4, "0")}`;

export async function nextApprovalRef(q: Queryable, teamId: string): Promise<string> {
  return formatApprovalRef(await nextNumber(q, "client_portal_approval_sequences", teamId));
}

export async function nextChangeRequestNo(q: Queryable, teamId: string): Promise<string> {
  return formatChangeRequestNo(await nextNumber(q, "client_portal_change_request_sequences", teamId));
}
