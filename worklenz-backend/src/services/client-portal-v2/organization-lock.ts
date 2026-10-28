import { conflict, notFound } from "./errors";
import { Queryable } from "./types";

/**
 * How long a deleted client organization can be restored with all its history. Matches the 30-day
 * window of a client user deleting their own account; the purge job removes it after this.
 */
export const CLIENT_DELETION_RETENTION_DAYS = 30;

export interface LockedOrganization {
  id: string;
  /** `clients.name`, the value the per-team unique index is on. */
  name: string;
  /** What the admin console shows: the company name when set, otherwise `name`. */
  displayName: string;
  status: string;
  deletedAt: Date | null;
}

/**
 * Locks one client organization row (`SELECT ... FOR UPDATE`) inside the caller's transaction.
 *
 * Every operation that changes who can use an organization takes this lock first: deleting,
 * deactivating or restoring the organization, and removing, deactivating or demoting its users. The
 * "last Client Admin" and "sole approver" checks count other rows, so without one shared lock two
 * concurrent changes (staff and staff, or staff and a Client Admin) can each pass the check and
 * together leave the organization with no admin. Always lock this row before any other.
 *
 * The lookup is scoped by `team_id`, so an id from another workspace answers the same 404 as a
 * missing one.
 */
export async function lockOrganization(
  q: Queryable,
  teamId: string,
  organizationId: string,
  options: { allowDeleted?: boolean } = {}
): Promise<LockedOrganization> {
  const result = await q.query(
    `SELECT id, name, COALESCE(NULLIF(TRIM(company_name), ''), name) AS display_name, status, deleted_at
       FROM clients
      WHERE id = $1 AND team_id = $2
        FOR UPDATE`,
    [organizationId, teamId]
  );
  const row = result.rows[0];
  if (!row) throw notFound("Client");
  if (row.deleted_at && !options.allowDeleted) {
    throw conflict("This client has been deleted.", "CLIENT_DELETED");
  }
  return {
    id: row.id,
    name: row.name,
    displayName: row.display_name,
    status: row.status,
    deletedAt: row.deleted_at ?? null,
  };
}
