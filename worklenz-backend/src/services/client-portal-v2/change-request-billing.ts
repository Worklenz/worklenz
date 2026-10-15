import { badRequest, notFound } from "./errors";
import { BILLABLE_STATUSES } from "./change-requests.service";
import { Queryable } from "./types";

/**
 * Quotes and invoices now start from a Change Request instead of a service request. These helpers keep
 * that link in one place so the quote and invoice controllers (which pre-date v2) stay small: resolve
 * the request a document is being created from, store the link, and read it back for the list and detail.
 */

export type BillingDocumentTable = "client_portal_quotes" | "client_portal_invoices";

export interface BillableChangeRequest {
  id: string;
  cr_no: string;
  title: string;
  client_id: string;
}

export interface LinkedChangeRequest {
  id: string;
  cr_no: string;
  title: string;
  status: string;
}

/**
 * The change request a quote or invoice is being created from. It must belong to this workspace and be
 * Approved, In Progress or Completed: anything earlier has no agreed scope to bill for.
 */
export async function resolveBillableChangeRequest(
  q: Queryable,
  teamId: string,
  changeRequestId: string
): Promise<BillableChangeRequest> {
  const result = await q.query(
    `SELECT id, cr_no, title, client_id, status
       FROM client_portal_change_requests
      WHERE id = $1 AND organization_team_id = $2`,
    [changeRequestId, teamId]
  );
  const row = result.rows[0];
  if (!row) throw notFound("Change request");
  if (!BILLABLE_STATUSES.includes(row.status)) {
    throw badRequest(
      "Only approved, in-progress or completed change requests can be quoted or invoiced",
      "CHANGE_REQUEST_NOT_BILLABLE"
    );
  }
  return { id: row.id, cr_no: row.cr_no, title: row.title, client_id: row.client_id };
}

/** Stores the link on a document created in the same transaction. */
export async function linkDocumentToChangeRequest(
  q: Queryable,
  table: BillingDocumentTable,
  documentId: string,
  changeRequestId: string
): Promise<void> {
  await q.query(`UPDATE ${table} SET change_request_id = $2 WHERE id = $1`, [documentId, changeRequestId]);
}

/** A duplicate of a document is billing for the same request, so it keeps the link. */
export async function copyChangeRequestLink(
  q: Queryable,
  table: BillingDocumentTable,
  fromDocumentId: string,
  toDocumentId: string
): Promise<void> {
  await q.query(
    `UPDATE ${table} SET change_request_id = (SELECT change_request_id FROM ${table} WHERE id = $1) WHERE id = $2`,
    [fromDocumentId, toDocumentId]
  );
}

/** The change request one document is linked to, or null (older documents link to a retired service request). */
export async function getLinkedChangeRequest(
  q: Queryable,
  teamId: string,
  table: BillingDocumentTable,
  documentId: string
): Promise<LinkedChangeRequest | null> {
  const result = await q.query(
    `SELECT r.id, r.cr_no, r.title, r.status
       FROM ${table} d
       JOIN client_portal_change_requests r ON r.id = d.change_request_id
      WHERE d.id = $1 AND r.organization_team_id = $2`,
    [documentId, teamId]
  );
  const row = result.rows[0];
  return row ? { id: row.id, cr_no: row.cr_no, title: row.title, status: row.status } : null;
}

/** CR numbers for a page of documents in one query, keyed by document id. */
export async function getChangeRequestNumbers(
  q: Queryable,
  teamId: string,
  table: BillingDocumentTable,
  documentIds: string[]
): Promise<Map<string, string>> {
  if (documentIds.length === 0) return new Map();
  const result = await q.query(
    `SELECT d.id, r.cr_no
       FROM ${table} d
       JOIN client_portal_change_requests r ON r.id = d.change_request_id
      WHERE d.id = ANY($1::uuid[]) AND r.organization_team_id = $2`,
    [documentIds, teamId]
  );
  return new Map(result.rows.map(row => [row.id as string, row.cr_no as string]));
}
