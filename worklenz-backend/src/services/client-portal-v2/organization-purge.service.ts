import db from "../../config/db";
import { withTransaction } from "../client-contacts-service";
import { recordAuditEvent } from "./audit.service";
import { CLIENT_DELETION_RETENTION_DAYS } from "./organization-lock";
import { Queryable } from "./types";

/**
 * Retention purge of deleted client organizations. A client deleted by staff stays restorable for
 * CLIENT_DELETION_RETENTION_DAYS; after that this removes what the portal holds about it:
 *
 *   - No invoices or quotes: the `clients` row is deleted. Its foreign keys cascade to the contacts,
 *     invitations, approvals, change requests and discussions; audit events keep their `client_name`
 *     snapshot (client_id is set to NULL); projects lose their client link.
 *   - Invoices or quotes exist: they are financial records the business may have to keep, and they already
 *     carry the issued-to snapshot, so the `clients` row stays as a tombstone with its contact details
 *     scrubbed, and everything else about the portal is removed.
 *
 * The login (`client_users`) is shared by every portal its owner belongs to, so a login is only removed
 * once nothing else references it.
 */

export interface PurgeCandidate {
  id: string;
  team_id: string;
  name: string;
}

export type PurgeOutcome = "deleted" | "tombstoned" | "skipped";

/** Deleted organizations whose retention window has ended. */
export async function findPurgeCandidates(q: Queryable, limit = 50): Promise<PurgeCandidate[]> {
  const result = await q.query(
    `SELECT id, team_id, COALESCE(NULLIF(TRIM(company_name), ''), name) AS name
       FROM clients
      WHERE deleted_at IS NOT NULL
        AND deleted_at < NOW() - INTERVAL '${CLIENT_DELETION_RETENTION_DAYS} days'
        AND purged_at IS NULL
      ORDER BY deleted_at
      LIMIT $1`,
    [limit]
  );
  return result.rows as PurgeCandidate[];
}

/** Purges one organization. Re-checks that it is still deleted and past the window, under a row lock. */
export async function purgeOrganization(candidate: PurgeCandidate): Promise<PurgeOutcome> {
  return withTransaction(async tx => {
    const locked = await tx.query(
      `SELECT id FROM clients
        WHERE id = $1 AND deleted_at IS NOT NULL
          AND deleted_at < NOW() - INTERVAL '${CLIENT_DELETION_RETENTION_DAYS} days'
        FOR UPDATE`,
      [candidate.id]
    );
    if (locked.rows.length === 0) return "skipped";

    const financial = await tx.query(
      `SELECT (EXISTS (SELECT 1 FROM client_portal_invoices WHERE client_id = $1)
            OR EXISTS (SELECT 1 FROM client_portal_quotes WHERE client_id = $1)) AS has_financial`,
      [candidate.id]
    );

    // The logins that belonged to this organization, to remove the ones nothing else needs afterwards.
    const logins = await tx.query(
      `SELECT DISTINCT client_user_id FROM client_contacts WHERE client_id = $1 AND client_user_id IS NOT NULL`,
      [candidate.id]
    );
    const loginIds = logins.rows.map(row => row.client_user_id as string);

    let outcome: PurgeOutcome;
    if (financial.rows[0]?.has_financial === true) {
      await tombstone(tx, candidate.id);
      outcome = "tombstoned";
    } else {
      await tx.query(`DELETE FROM clients WHERE id = $1`, [candidate.id]);
      outcome = "deleted";
    }

    if (loginIds.length > 0) {
      await tx.query(
        `DELETE FROM client_users cu
          WHERE cu.id = ANY($1::uuid[])
            AND NOT EXISTS (SELECT 1 FROM client_contacts cc WHERE cc.client_user_id = cu.id)
            AND NOT EXISTS (SELECT 1 FROM client_user_organizations cuo WHERE cuo.client_user_id = cu.id)`,
        [loginIds]
      );
    }

    await recordAuditEvent(tx, {
      teamId: candidate.team_id,
      event: "Client organization purged",
      actor: { side: "internal", name: "Retention policy" },
      clientId: outcome === "tombstoned" ? candidate.id : null,
      clientName: candidate.name,
      targetType: "client",
      targetId: candidate.id,
      targetLabel: candidate.name,
      metadata: { result: outcome, retention_days: CLIENT_DELETION_RETENTION_DAYS },
    });

    return outcome;
  });
}

/** Removes the portal's data about an organization but keeps the row and its financial documents. */
async function tombstone(tx: Queryable, clientId: string): Promise<void> {
  // Contacts first: their invitations, project access, approvers and read markers go with them.
  await tx.query(`DELETE FROM client_contacts WHERE client_id = $1`, [clientId]);
  await tx.query(`DELETE FROM client_invitations WHERE client_id = $1`, [clientId]);
  await tx.query(`DELETE FROM client_user_organizations WHERE client_id = $1`, [clientId]);
  await tx.query(`DELETE FROM client_portal_access WHERE client_id = $1`, [clientId]);
  await tx.query(`DELETE FROM client_portal_approvals WHERE client_id = $1`, [clientId]);
  await tx.query(`DELETE FROM client_portal_change_requests WHERE client_id = $1`, [clientId]);
  await tx.query(`DELETE FROM client_portal_threads WHERE client_id = $1`, [clientId]);
  // Personal contact details; the name stays, because the invoices and quotes belong to it.
  await tx.query(
    `UPDATE clients
        SET email = NULL, phone = NULL, contact_person = NULL, address = NULL, address_line_1 = NULL,
            city = NULL, state = NULL, zip_code = NULL, country = NULL, invite_slug = NULL,
            purged_at = NOW(), updated_at = NOW()
      WHERE id = $1`,
    [clientId]
  );
}

export interface PurgeSummary {
  candidates: number;
  deleted: number;
  tombstoned: number;
  skipped: number;
  failed: number;
}

/**
 * One sweep. With `execute` false it only reports what it would do (the default until staff opt in with
 * CLIENT_PURGE_ENABLED), so turning the job on is a decision, not a deployment side effect.
 */
export async function runClientPurge(options: { execute: boolean; limit?: number }): Promise<PurgeSummary> {
  const candidates = await findPurgeCandidates(db, options.limit);
  const summary: PurgeSummary = { candidates: candidates.length, deleted: 0, tombstoned: 0, skipped: 0, failed: 0 };
  if (!options.execute) return summary;

  for (const candidate of candidates) {
    try {
      const outcome = await purgeOrganization(candidate);
      summary[outcome] += 1;
    } catch (error) {
      summary.failed += 1;
      console.error(`client-purge: could not purge client ${candidate.id}:`, error);
    }
  }
  return summary;
}
