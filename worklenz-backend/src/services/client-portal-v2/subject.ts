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
 * Why a person can no longer act, in terms safe to show them. The client app turns each into guidance on
 * who to contact; none of them names a company, a team or another person.
 *
 *   organization_unavailable  the organization was deactivated or deleted, or its portal access is off
 *   account_deleted           the person deleted their own account
 *   access_disabled           staff deactivated them, or their login is switched off
 *   access_removed            they are no longer a user of this organization
 */
export type AccessLossReason =
  | "organization_unavailable"
  | "account_deleted"
  | "access_disabled"
  | "access_removed";

/**
 * What a person is told for each reason access ended, on a signed-in screen and on the sign-in page of a
 * person who holds a private invitation link. Generic on purpose: no company, team or person is named.
 */
export const ACCESS_LOSS_MESSAGES: Record<AccessLossReason, string> = {
  organization_unavailable: "This portal is no longer available. Please contact your project team.",
  account_deleted:
    "Your account has been deleted. If this was a mistake, please contact your Client Admin or project team.",
  access_disabled: "Your access has been disabled. Please contact your Client Admin or project team.",
  access_removed: "Your access has been removed. Please contact your Client Admin or project team.",
};

/**
 * Classifies why `loadClientSubject` found nobody. Only called after access was refused, to choose the
 * wording; it never grants anything. Never throws: if it cannot tell, the answer is the neutral
 * `access_removed`.
 */
export async function explainAccessLoss(
  q: Queryable,
  input: { clientUserId: string; clientId: string; teamId: string }
): Promise<AccessLossReason> {
  try {
    const result = await q.query(
      `SELECT cu.status AS login_status, cu.deleted_at AS login_deleted_at,
              c.id AS client_exists, c.status AS client_status, c.deleted_at AS client_deleted_at,
              cc.id AS contact_id, cc.disabled_at,
              COALESCE((SELECT cpa.is_active FROM client_portal_access cpa WHERE cpa.client_id = $2 LIMIT 1), TRUE) AS portal_active
         FROM client_users cu
         LEFT JOIN clients c ON c.id = $2
         LEFT JOIN client_contacts cc ON cc.client_user_id = cu.id AND cc.client_id = $2 AND cc.team_id = $3
        WHERE cu.id = $1
        LIMIT 1`,
      [input.clientUserId, input.clientId, input.teamId]
    );
    const row = result.rows[0];
    if (!row) return "access_removed";
    if (!row.client_exists || row.client_deleted_at || row.client_status === "inactive" || row.portal_active === false) {
      return "organization_unavailable";
    }
    if (row.login_deleted_at) return "account_deleted";
    if (!row.contact_id) return "access_removed";
    if (row.disabled_at || row.login_status !== "active") return "access_disabled";
    return "access_removed";
  } catch {
    return "access_removed";
  }
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
