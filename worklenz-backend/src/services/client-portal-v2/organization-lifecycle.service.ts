import db from "../../config/db";
import { withTransaction } from "../client-contacts-service";
import { AuditActor, recordAuditEvent } from "./audit.service";
import { PortalError, badRequest, conflict } from "./errors";
import { CLIENT_DELETION_RETENTION_DAYS, lockOrganization } from "./organization-lock";
import { OrganizationView, getOrganization } from "./organizations.service";
import { Queryable } from "./types";

export { CLIENT_DELETION_RETENTION_DAYS };

/**
 * Lifecycle of a client organization (the `clients` row) as staff manage it:
 *
 *   Deactivate / Reactivate  a reversible suspension. Nobody in the organization can sign in or use an
 *                            open session; users, projects and history are untouched.
 *   Delete / Restore         a soft delete (`clients.deleted_at`) with a 30-day retention window. All of the
 *                            organization's client users lose access on their next request, because every
 *                            client request re-checks `deleted_at` (see subject.ts). Nothing else is
 *                            changed, so a restore brings everything back, history included. The purge job
 *                            removes what is left after the window.
 *
 * Neither writes `client_users.status`: a login is shared by every portal its owner belongs to, so one
 * organization must never switch it off for the others. Per-user state lives on `client_contacts`.
 *
 * Every operation locks the organization row first (see organization-lock.ts), which serializes it
 * against user removal, deactivation and role changes.
 */

export interface OpenInvoice {
  invoice_no: string;
  currency: string;
  outstanding: number;
}

export interface DeletePreview {
  organization_id: string;
  name: string;
  status: string;
  active_users: number;
  invited_users: number;
  total_users: number;
  portal_projects: number;
  /** Unpaid invoices. Any of these blocks the delete. */
  open_invoices: OpenInvoice[];
  /** Approvals still waiting for a decision. Deleting needs an explicit confirmation. */
  pending_approvals: Array<{ ref_no: string; title: string }>;
  /** Change requests that are neither completed, rejected nor cancelled. Needs an explicit confirmation. */
  open_change_requests: Array<{ title: string }>;
  retention_days: number;
}

interface Assessment {
  open_invoices: OpenInvoice[];
  pending_approvals: Array<{ ref_no: string; title: string }>;
  open_change_requests: Array<{ title: string }>;
}

/**
 * What stands in the way of deleting an organization. "Unpaid" is the same definition the Clients list
 * uses for its Outstanding column (sent, pending or overdue, not paid, a balance left), so the number
 * staff see in the list and the reason a delete is refused always agree.
 */
async function assessDeletion(q: Queryable, teamId: string, organizationId: string): Promise<Assessment> {
  const [invoices, approvals, changeRequests] = await Promise.all([
    q.query(
      `SELECT i.invoice_no, i.currency, (i.amount - COALESCE(i.paid_amount, 0))::float AS outstanding
         FROM client_portal_invoices i
        WHERE i.client_id = $1 AND i.deleted_at IS NULL
          AND i.status IN ('sent', 'pending', 'overdue')
          AND COALESCE(i.payment_status, '') <> 'paid'
          AND (i.amount - COALESCE(i.paid_amount, 0)) > 0
        ORDER BY i.created_at`,
      [organizationId]
    ),
    q.query(
      `SELECT ref_no, title FROM client_portal_approvals
        WHERE organization_team_id = $1 AND client_id = $2 AND status = 'awaiting'
        ORDER BY created_at`,
      [teamId, organizationId]
    ),
    q.query(
      `SELECT title FROM client_portal_change_requests
        WHERE organization_team_id = $1 AND client_id = $2 AND status NOT IN ('completed', 'rejected', 'cancelled')
        ORDER BY created_at`,
      [teamId, organizationId]
    ),
  ]);

  return {
    open_invoices: invoices.rows.map(row => ({
      invoice_no: String(row.invoice_no),
      currency: String(row.currency),
      outstanding: Number(row.outstanding) || 0,
    })),
    pending_approvals: approvals.rows.map(row => ({ ref_no: String(row.ref_no), title: String(row.title) })),
    open_change_requests: changeRequests.rows.map(row => ({ title: String(row.title) })),
  };
}

const listForMessage = (items: string[]): string => items.slice(0, 5).join(", ") + (items.length > 5 ? ", ..." : "");

/** What the Delete dialog shows before anything happens, so staff are never surprised by a refusal. */
export async function getDeletePreview(q: Queryable, teamId: string, organizationId: string): Promise<DeletePreview> {
  const organization = await getOrganization(q, teamId, organizationId);
  const assessment = await assessDeletion(q, teamId, organizationId);
  return {
    organization_id: organization.id,
    name: organization.name,
    status: organization.status,
    active_users: organization.active_users,
    invited_users: organization.invited_users,
    total_users: organization.total_users,
    portal_projects: organization.portal_projects,
    ...assessment,
    retention_days: CLIENT_DELETION_RETENTION_DAYS,
  };
}

export interface DeleteResult {
  organization_id: string;
  deleted_at: string;
  purge_on: string;
}

/**
 * Soft-deletes an organization. Unpaid invoices block it outright (no override: staff must settle or
 * cancel them first). Awaiting approvals and open change requests are allowed once staff confirm them.
 */
export async function deleteOrganization(input: {
  teamId: string;
  organizationId: string;
  actor: AuditActor;
  confirmPendingApprovals?: boolean;
  confirmOpenChangeRequests?: boolean;
}): Promise<DeleteResult> {
  const { teamId, organizationId, actor } = input;

  return withTransaction(async tx => {
    const locked = await lockOrganization(tx, teamId, organizationId, { allowDeleted: true });
    if (locked.deletedAt) throw conflict("This client has already been deleted.", "ALREADY_DELETED");

    const organization = await getOrganization(tx, teamId, organizationId);
    const assessment = await assessDeletion(tx, teamId, organizationId);

    if (assessment.open_invoices.length > 0) {
      const numbers = assessment.open_invoices.map(invoice => invoice.invoice_no);
      throw conflict(
        `${locked.displayName} has ${numbers.length === 1 ? "an unpaid invoice" : `${numbers.length} unpaid invoices`} (${listForMessage(numbers)}). Settle or cancel ${numbers.length === 1 ? "it" : "them"} before deleting this client.`,
        "OPEN_INVOICES",
        { invoices: assessment.open_invoices }
      );
    }
    if (assessment.pending_approvals.length > 0 && !input.confirmPendingApprovals) {
      const refs = assessment.pending_approvals.map(approval => approval.ref_no);
      throw conflict(
        `${refs.length === 1 ? "An approval is" : `${refs.length} approvals are`} still waiting for a decision (${listForMessage(refs)}). Confirm to delete this client anyway.`,
        "PENDING_APPROVALS",
        { approvals: refs }
      );
    }
    if (assessment.open_change_requests.length > 0 && !input.confirmOpenChangeRequests) {
      const titles = assessment.open_change_requests.map(request => request.title);
      throw conflict(
        `${titles.length === 1 ? "A change request is" : `${titles.length} change requests are`} still open (${listForMessage(titles)}). Confirm to delete this client anyway.`,
        "OPEN_CHANGE_REQUESTS",
        { change_requests: titles }
      );
    }

    const updated = await tx.query(
      `UPDATE clients SET deleted_at = NOW(), updated_at = NOW()
        WHERE id = $1 AND team_id = $2 AND deleted_at IS NULL
        RETURNING deleted_at, deleted_at + INTERVAL '${CLIENT_DELETION_RETENTION_DAYS} days' AS purge_on`,
      [organizationId, teamId]
    );
    const deletedAt: Date = updated.rows[0].deleted_at;
    // Computed by the database, with the same interval the restore window and the purge job use.
    const purgeOn: Date = updated.rows[0].purge_on;

    await recordAuditEvent(tx, {
      teamId,
      event: "Client organization deleted",
      actor,
      clientId: organizationId,
      clientName: locked.displayName,
      targetType: "client",
      targetId: organizationId,
      targetLabel: locked.displayName,
      metadata: {
        users_affected: organization.total_users,
        pending_approvals: assessment.pending_approvals.length,
        open_change_requests: assessment.open_change_requests.length,
        restorable_until: purgeOn.toISOString(),
      },
    });

    return {
      organization_id: organizationId,
      deleted_at: deletedAt.toISOString(),
      purge_on: purgeOn.toISOString(),
    };
  });
}

/**
 * Restores a deleted organization inside its retention window, with every user, project and record it had.
 * If another live client took its name meanwhile the restore asks for a new one (409 NAME_TAKEN).
 */
export async function restoreOrganization(input: {
  teamId: string;
  organizationId: string;
  actor: AuditActor;
  newName?: string;
}): Promise<OrganizationView> {
  const { teamId, organizationId, actor } = input;

  await withTransaction(async tx => {
    const locked = await lockOrganization(tx, teamId, organizationId, { allowDeleted: true });
    if (!locked.deletedAt) throw conflict("This client is not deleted.", "NOT_DELETED");

    const window = await tx.query(
      `SELECT (deleted_at > NOW() - INTERVAL '${CLIENT_DELETION_RETENTION_DAYS} days') AS restorable
         FROM clients WHERE id = $1`,
      [organizationId]
    );
    if (window.rows[0]?.restorable !== true) {
      throw new PortalError(
        410,
        `The ${CLIENT_DELETION_RETENTION_DAYS}-day window to restore this client has ended.`,
        "RETENTION_EXPIRED"
      );
    }

    let name = locked.name;
    if (input.newName !== undefined) {
      name = input.newName.trim();
      if (!name) throw badRequest("A client name is required", "INVALID_NAME");
      if (name.length > 255) throw badRequest("The client name is too long", "INVALID_NAME");
    }

    const taken = await tx.query(
      `SELECT 1 FROM clients WHERE team_id = $1 AND id <> $2 AND deleted_at IS NULL AND LOWER(name) = LOWER($3) LIMIT 1`,
      [teamId, organizationId, name]
    );
    if (taken.rows.length > 0) {
      throw conflict(
        `Another client is already named "${name}". Give this client a new name to restore it.`,
        "NAME_TAKEN",
        { name }
      );
    }

    // A custom sign-in slug is unique among live clients; if someone took it meanwhile, drop it
    // rather than refuse the restore (staff can set a new one).
    const restore = (keepSlug: boolean) =>
      tx.query(
        `UPDATE clients c
            SET deleted_at = NULL,
                name = $3,
                company_name = CASE WHEN c.company_name = c.name THEN $3 ELSE c.company_name END,
                invite_slug = CASE
                  WHEN NOT $4 THEN NULL
                  WHEN c.invite_slug IS NOT NULL AND EXISTS (
                    SELECT 1 FROM clients o
                     WHERE o.id <> c.id AND o.deleted_at IS NULL AND LOWER(o.invite_slug) = LOWER(c.invite_slug)
                  ) THEN NULL
                  ELSE c.invite_slug
                END,
                updated_at = NOW()
          WHERE c.id = $1 AND c.team_id = $2`,
        [organizationId, teamId, name, keepSlug]
      );

    // The checks above are not enough on their own: a live client created in the meantime wins the unique
    // index. A savepoint keeps that failure from aborting the whole transaction.
    await tx.query("SAVEPOINT restore_client");
    try {
      await restore(true);
    } catch (error) {
      await tx.query("ROLLBACK TO SAVEPOINT restore_client");
      const violation = error as { code?: string; constraint?: string };
      if (violation?.code !== "23505") throw error;
      if (violation.constraint === "clients_invite_slug_unique") {
        await restore(false);
      } else {
        throw conflict(
          `Another client is already named "${name}". Give this client a new name to restore it.`,
          "NAME_TAKEN",
          { name }
        );
      }
    }
    await tx.query("RELEASE SAVEPOINT restore_client");

    await recordAuditEvent(tx, {
      teamId,
      event: "Client organization restored",
      actor,
      clientId: organizationId,
      clientName: name,
      targetType: "client",
      targetId: organizationId,
      targetLabel: name,
      metadata: name !== locked.name ? { renamed_from: locked.name } : {},
    });
  });

  return getOrganization(db, teamId, organizationId);
}

/**
 * Suspends an organization. Staff can reverse it at any time. Only `clients.status` changes: portal access
 * (`client_portal_access.is_active`) is a separate switch that every sign-in and session check reads next to
 * the status, so leaving it alone is what lets a reactivation bring back exactly the access there was. Pending approvals stay where they are; the
 * client simply cannot reach them until the organization is reactivated.
 */
export async function deactivateOrganization(input: {
  teamId: string;
  organizationId: string;
  actor: AuditActor;
}): Promise<OrganizationView> {
  const { teamId, organizationId, actor } = input;

  await withTransaction(async tx => {
    const locked = await lockOrganization(tx, teamId, organizationId);
    if (locked.status === "inactive") return;

    await tx.query(`UPDATE clients SET status = 'inactive', updated_at = NOW() WHERE id = $1 AND team_id = $2`, [
      organizationId,
      teamId,
    ]);
    await recordAuditEvent(tx, {
      teamId,
      event: "Client organization deactivated",
      actor,
      clientId: organizationId,
      clientName: locked.displayName,
      targetType: "client",
      targetId: organizationId,
      targetLabel: locked.displayName,
    });
  });

  return getOrganization(db, teamId, organizationId);
}

/** Ends a suspension: the organization's users can sign in again, with the access they had. Portal access is not touched. */
export async function reactivateOrganization(input: {
  teamId: string;
  organizationId: string;
  actor: AuditActor;
}): Promise<OrganizationView> {
  const { teamId, organizationId, actor } = input;

  await withTransaction(async tx => {
    const locked = await lockOrganization(tx, teamId, organizationId);
    if (locked.status !== "inactive") return;

    await tx.query(`UPDATE clients SET status = 'active', updated_at = NOW() WHERE id = $1 AND team_id = $2`, [
      organizationId,
      teamId,
    ]);
    await recordAuditEvent(tx, {
      teamId,
      event: "Client organization reactivated",
      actor,
      clientId: organizationId,
      clientName: locked.displayName,
      targetType: "client",
      targetId: organizationId,
      targetLabel: locked.displayName,
    });
  });

  return getOrganization(db, teamId, organizationId);
}
