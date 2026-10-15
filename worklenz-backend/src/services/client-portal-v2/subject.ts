import { ClientContactRole } from "../../shared/client-portal-permissions";
import { Queryable } from "./types";

/**
 * Who a client request is acting as. Resolved from the database on EVERY request, never from the
 * token: the JWT carries identity only. That is what makes the spec's "every access change takes
 * effect on the client's next request" true - deactivating a user, changing their role or removing
 * a project assignment needs no token revocation.
 */
export interface ClientSubject {
  contactId: string;
  clientId: string;
  teamId: string;
  role: ClientContactRole;
  name: string;
  email: string;
  clientUserId: string | null;
}

const SUBJECT_COLUMNS = `
  cc.id AS contact_id, cc.client_id, cc.team_id, cc.role, cc.name, cc.email, cc.client_user_id
`;

/**
 * A client user is Active only when all of these hold: not deactivated, linked to a login that is
 * itself active, the invited email verified and the account activated, and the client organization
 * neither deleted nor inactive.
 */
const ACTIVE_SUBJECT_SQL = `
  cc.disabled_at IS NULL
  AND cc.activated_at IS NOT NULL
  AND cu.status = 'active'
  AND cu.deleted_at IS NULL
  AND c.deleted_at IS NULL
  AND c.status <> 'inactive'
`;

const toSubject = (row: any): ClientSubject => ({
  contactId: row.contact_id,
  clientId: row.client_id,
  teamId: row.team_id,
  role: row.role,
  name: row.name,
  email: row.email,
  clientUserId: row.client_user_id ?? null,
});

/** The subject behind an authenticated client token, or null when they may no longer act. */
export async function loadClientSubject(
  q: Queryable,
  input: { clientUserId: string; clientId: string; teamId: string }
): Promise<ClientSubject | null> {
  const result = await q.query(
    `SELECT ${SUBJECT_COLUMNS}
       FROM client_contacts cc
       JOIN client_users cu ON cu.id = cc.client_user_id
       JOIN clients c ON c.id = cc.client_id
      WHERE cc.client_user_id = $1
        AND cc.client_id = $2
        AND cc.team_id = $3
        AND ${ACTIVE_SUBJECT_SQL}
      LIMIT 1`,
    [input.clientUserId, input.clientId, input.teamId]
  );
  return result.rows[0] ? toSubject(result.rows[0]) : null;
}

/**
 * The subject for a given client user, for the staff-side "Preview as client". Only an Active user
 * can be previewed: an Invited or Deactivated user has nothing to preview.
 */
export async function loadSubjectByContactId(
  q: Queryable,
  teamId: string,
  contactId: string
): Promise<ClientSubject | null> {
  const result = await q.query(
    `SELECT ${SUBJECT_COLUMNS}
       FROM client_contacts cc
       JOIN client_users cu ON cu.id = cc.client_user_id
       JOIN clients c ON c.id = cc.client_id
      WHERE cc.id = $1
        AND cc.team_id = $2
        AND ${ACTIVE_SUBJECT_SQL}
      LIMIT 1`,
    [contactId, teamId]
  );
  return result.rows[0] ? toSubject(result.rows[0]) : null;
}
