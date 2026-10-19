import axios from "axios";
import { withTransaction } from "../client-contacts-service";
import { clientRoleCan } from "../../shared/client-portal-permissions";
import { log_error } from "../../shared/utils";
import { recordAuditEvent } from "./audit.service";
import { PortalError, badRequest, conflict } from "./errors";
import { notifyStaff } from "./notify.service";
import { ClientSubject } from "./subject";
import { Queryable } from "./types";

/**
 * A client user deleting their own account, under the same rules as the main app's account deletion:
 * a soft delete (the login is flagged, nothing is removed), a 30-day window, then support removes the
 * data by hand from the queue in `client_user_deletion_logs`. Support restores a login in that window.
 *
 * The login (`client_users`) is shared by every portal the person belongs to, so deleting the account
 * leaves all of them. Access ends on the next request: every client request re-checks the person and
 * an Active user needs `client_users.deleted_at` to be NULL. Sign-in and the staff user lists honor it too.
 *
 * Only a Client Admin can do this themselves. In a company account the Client Admins decide who has an
 * identity in the workspace, so a Member or Viewer asks instead (`submitAccountDeletionRequest`): the request
 * is audited and reaches the team that controls the data, and a Client Admin can remove them at once under
 * Members. The person's own profile stays in each workspace's admin console with the status "Account
 * deleted", and the audit entry written here is the history staff see.
 */

export const ACCOUNT_DELETION_CONFIRMATION = "DELETE";
export const ACCOUNT_DELETION_RETENTION_DAYS = 30;

export interface AccountDeletionResult {
  scheduled_deletion_date: string;
}

/**
 * Organizations where this person is the only active Client Admin. Without an admin nobody can approve
 * anything for that organization, so the deletion is refused (staff get the same rule as a warning).
 */
async function findSoleAdminOrganizations(q: Queryable, clientUserId: string): Promise<string[]> {
  const result = await q.query(
    `SELECT DISTINCT COALESCE(NULLIF(TRIM(c.company_name), ''), c.name) AS organization_name
       FROM client_contacts cc
       JOIN clients c ON c.id = cc.client_id AND c.deleted_at IS NULL
      WHERE cc.client_user_id = $1
        AND cc.role = 'admin'
        AND cc.disabled_at IS NULL
        AND NOT EXISTS (
          SELECT 1
            FROM client_contacts other
            JOIN client_users ou ON ou.id = other.client_user_id
           WHERE other.client_id = cc.client_id
             AND other.team_id = cc.team_id
             AND other.id <> cc.id
             AND other.role = 'admin'
             AND other.disabled_at IS NULL
             AND other.activated_at IS NOT NULL
             AND ou.status = 'active'
             AND ou.deleted_at IS NULL
        )
      ORDER BY organization_name`,
    [clientUserId]
  );
  return result.rows.map(row => row.organization_name as string);
}

/** Awaiting approvals this person is named on where no one else who can still act is named. */
async function findSoleApproverApprovals(q: Queryable, clientUserId: string): Promise<string[]> {
  const result = await q.query(
    `SELECT DISTINCT a.title
       FROM client_portal_approvals a
       JOIN client_portal_approval_approvers ap ON ap.approval_id = a.id
       JOIN client_contacts me ON me.id = ap.contact_id AND me.client_user_id = $1
      WHERE a.status = 'awaiting'
        AND NOT EXISTS (
          SELECT 1
            FROM client_portal_approval_approvers ap2
            JOIN client_contacts c2 ON c2.id = ap2.contact_id
            JOIN client_users u2 ON u2.id = c2.client_user_id
           WHERE ap2.approval_id = a.id
             AND c2.client_user_id <> $1
             AND c2.disabled_at IS NULL
             AND c2.activated_at IS NOT NULL
             AND u2.status = 'active'
             AND u2.deleted_at IS NULL
        )
      ORDER BY a.title`,
    [clientUserId]
  );
  return result.rows.map(row => row.title as string);
}

const listForMessage = (items: string[]): string => items.slice(0, 5).join(", ") + (items.length > 5 ? ", ..." : "");

export async function requestAccountDeletion(
  subject: ClientSubject,
  input: { confirmation?: unknown }
): Promise<AccountDeletionResult> {
  if (!clientRoleCan(subject.role, "manage_users")) {
    throw new PortalError(
      403,
      "Only a Client Admin can delete an account here. Ask a Client Admin to remove you, or send a deletion request.",
      "ADMIN_ONLY"
    );
  }
  if (input.confirmation !== ACCOUNT_DELETION_CONFIRMATION) {
    throw badRequest(`Type ${ACCOUNT_DELETION_CONFIRMATION} to confirm`, "INVALID_CONFIRMATION");
  }
  if (!subject.clientUserId) {
    throw new PortalError(403, "This account cannot be deleted from here. Please contact support.", "NO_LOGIN");
  }
  const clientUserId = subject.clientUserId;

  const requestedAt = new Date();
  const scheduled = new Date(requestedAt);
  scheduled.setDate(scheduled.getDate() + ACCOUNT_DELETION_RETENTION_DAYS);

  const deleted = await withTransaction(async tx => {
    // Locking the login serializes this against a second request and against a colleague's
    // deactivation that would change who else is an admin.
    const login = await tx.query(
      `SELECT id, name, email FROM client_users WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`,
      [clientUserId]
    );
    if (login.rows.length === 0) throw conflict("This account has already been deleted.", "ALREADY_DELETED");

    const organizations = await findSoleAdminOrganizations(tx, clientUserId);
    if (organizations.length > 0) {
      throw conflict(
        `You are the only Client Admin of ${listForMessage(organizations)}. Make another person a Client Admin before deleting your account.`,
        "LAST_ADMIN",
        { organizations }
      );
    }
    const approvals = await findSoleApproverApprovals(tx, clientUserId);
    if (approvals.length > 0) {
      throw conflict(
        `You are the only approver on: ${listForMessage(approvals)}. Ask your project team to reassign ${approvals.length === 1 ? "it" : "them"} before deleting your account.`,
        "SOLE_APPROVER",
        { approvals }
      );
    }

    await tx.query(`UPDATE client_users SET deleted_at = $2, updated_at = NOW() WHERE id = $1`, [clientUserId, requestedAt]);
    await tx.query(
      `INSERT INTO client_user_deletion_logs (client_user_id, email, name, requested_at, scheduled_deletion_date)
       VALUES ($1, $2, $3, $4, $5)`,
      [clientUserId, login.rows[0].email, login.rows[0].name, requestedAt, scheduled]
    );

    // One audit entry per portal they belonged to, so every operator can see why the user went away.
    const memberships = await tx.query(
      `SELECT cc.id, cc.team_id, cc.client_id, cc.name, cc.role,
              COALESCE(NULLIF(TRIM(c.company_name), ''), c.name) AS client_name
         FROM client_contacts cc
         JOIN clients c ON c.id = cc.client_id
        WHERE cc.client_user_id = $1`,
      [clientUserId]
    );
    for (const row of memberships.rows) {
      await recordAuditEvent(tx, {
        teamId: row.team_id,
        event: "Client account deleted",
        actor: { side: "client", name: row.name, contactId: row.id },
        clientId: row.client_id,
        clientName: row.client_name,
        targetType: "client_user",
        targetId: row.id,
        targetLabel: `${row.name} · ${row.client_name}`,
        // The role and the end of the restore window help staff; no email, because the log is append-only.
        metadata: { role: row.role, restorable_until: scheduled.toISOString() },
      });
    }
    return {
      name: login.rows[0].name as string,
      email: login.rows[0].email as string,
      portals: memberships.rowCount ?? 0,
      memberships: memberships.rows as Array<{
        id: string;
        team_id: string;
        client_id: string;
        name: string;
        client_name: string;
      }>,
    };
  });

  // Every workspace the person belonged to hears about it in its activity bell. Their profile stays in
  // that workspace's admin console as "Account deleted" until the window ends.
  for (const row of deleted.memberships) {
    void notifyStaff({
      teamId: row.team_id,
      kind: "Access",
      title: `${row.name} deleted their own account`,
      body: `${row.client_name} · they can no longer sign in. Their profile stays here for ${ACCOUNT_DELETION_RETENTION_DAYS} days.`,
      url: `/worklenz/client-portal/clients/${row.client_id}?tab=users`,
    });
  }

  await notifySupport({
    clientUserId,
    name: deleted.name,
    email: deleted.email,
    portals: deleted.portals,
    requestedAt,
    scheduled,
  });
  return { scheduled_deletion_date: scheduled.toISOString() };
}

/** Tells support to purge the data within 30 days. Best effort, like the main app: a failure never undoes the deletion. */
async function notifySupport(input: {
  clientUserId: string;
  name: string;
  email: string;
  portals: number;
  requestedAt: Date;
  scheduled: Date;
}): Promise<void> {
  const webhook = process.env.TEAMS_SUPPORT_WEBHOOK;
  if (!webhook) {
    log_error("Teams webhook URL not configured");
    return;
  }
  const fact = (title: string, value: string) => ({ title, value });
  const card = {
    type: "message",
    attachments: [
      {
        contentType: "application/vnd.microsoft.card.adaptive",
        content: {
          $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
          type: "AdaptiveCard",
          version: "1.4",
          body: [
            { type: "TextBlock", text: "⚠️ Client Portal Account Deletion Request", weight: "Bolder", size: "Large", color: "Warning" },
            { type: "TextBlock", text: "A client portal user has deleted their account.", wrap: true, spacing: "Medium" },
            {
              type: "FactSet",
              spacing: "Medium",
              facts: [
                fact("User Name:", input.name || "Unknown"),
                fact("Email:", input.email || "Unknown"),
                fact("Client User ID:", input.clientUserId),
                fact("Portals:", String(input.portals)),
                fact("Deletion Date:", input.requestedAt.toISOString()),
                fact("Data Removal:", `Within ${ACCOUNT_DELETION_RETENTION_DAYS} days (${input.scheduled.toISOString()})`),
              ],
            },
            {
              type: "TextBlock",
              text: "Please archive and permanently delete this user's data within 30 days, as per the data retention policy.",
              wrap: true,
            },
          ],
        },
      },
    ],
  };
  try {
    await axios.post(webhook, card, { headers: { "Content-Type": "application/json" }, timeout: 10000 });
  } catch (error: any) {
    log_error("Teams webhook error:", error?.response?.data || error?.message);
  }
}

export interface AccountDeletionRequestResult {
  /** False when they had already asked in the last 24 hours, so nothing was sent twice. */
  sent: boolean;
}

/**
 * A Member or Viewer asking for their account to be deleted. They cannot delete it themselves (a Client Admin
 * owns who has an identity in the workspace), but they never need to go outside the product to ask: the
 * request is audited and the workspace's Owners and Admins are notified, who can remove them from Members
 * straight away or arrange the erasure with them. Asking again within 24 hours is a no-op.
 */
export async function submitAccountDeletionRequest(subject: ClientSubject): Promise<AccountDeletionRequestResult> {
  if (clientRoleCan(subject.role, "manage_users")) {
    throw conflict("As a Client Admin you can delete your account yourself.", "USE_DELETE");
  }

  const sent = await withTransaction(async tx => {
    // Serialize the same person's repeat clicks so a double submit cannot notify twice.
    await tx.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`account-deletion-request:${subject.contactId}`]);
    const recent = await tx.query(
      `SELECT 1 FROM client_portal_audit_events
        WHERE actor_contact_id = $1 AND event_key = 'Account deletion requested'
          AND created_at > NOW() - INTERVAL '24 hours'
        LIMIT 1`,
      [subject.contactId]
    );
    if (recent.rows.length > 0) return false;

    const org = await tx.query(
      `SELECT COALESCE(NULLIF(TRIM(company_name), ''), name) AS name FROM clients WHERE id = $1`,
      [subject.clientId]
    );
    const organizationName: string = org.rows[0]?.name ?? "";
    await recordAuditEvent(tx, {
      teamId: subject.teamId,
      event: "Account deletion requested",
      actor: { side: "client", name: subject.name, contactId: subject.contactId },
      clientId: subject.clientId,
      clientName: organizationName,
      targetType: "client_user",
      targetId: subject.contactId,
      targetLabel: `${subject.name} · ${organizationName}`,
      metadata: { role: subject.role },
    });
    return true;
  });

  if (sent) {
    void notifyStaff({
      teamId: subject.teamId,
      kind: "Access",
      title: `${subject.name} asked to delete their account`,
      body: "Remove them from Client Users now, or arrange the deletion with them.",
      url: `/worklenz/client-portal/clients/${subject.clientId}?tab=users`,
    });
  }
  return { sent };
}
