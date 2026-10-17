import db from "../../config/db";
import { containsPattern, splitList } from "./list-params";
import {
  CLIENT_ROLE_DEFINITIONS,
  ClientContactRole,
  isClientContactRole,
} from "../../shared/client-portal-permissions";
import {
  CONTACT_STATE_JOINS_SQL,
  InviteDelivery,
  inviteContact,
  isValidContactEmail,
  normalizeContactEmail,
  withTransaction,
} from "../client-contacts-service";
import { AuditActor, recordAuditEvent } from "./audit.service";
import { PortalError, badRequest, conflict, notFound } from "./errors";
import { lockOrganization } from "./organization-lock";
import { assignContactToProject, removeContactFromProject } from "./project-core";
import { Queryable } from "./types";

/**
 * Client users (v2). A client user is a client_contacts row (see migration
 * 1791298000000_client_users_v2_roles_and_status).
 *
 * Status is derived, not stored, so reactivating a user restores exactly the status they held:
 *   Deleted      the person deleted their own account (`client_users.deleted_at`). They lose access in
 *                the client portal, but the profile stays here until the 30-day window ends, so staff
 *                can see what happened. Staff cannot "reactivate" it; they restore the account or remove the user.
 *   Deactivated  disabled_at is set, or the login itself is inactive
 *   Active       linked to an active login and activated (email verified)
 *   Invited      everything else; "Invite expired" is a flag on an Invited user
 */

export type ClientUserStatus = "invited" | "active" | "deactivated" | "deleted";

export interface ClientUserView {
  id: string;
  organization_id: string;
  organization_name: string;
  name: string;
  email: string;
  phone: string | null;
  job_title: string | null;
  role: ClientContactRole;
  status: ClientUserStatus;
  /** When the person deleted their own account; set only for status `deleted`. */
  account_deleted_at: string | null;
  /** Until when staff can restore a self-deleted account; null once the window has ended. */
  restorable_until: string | null;
  invite_expired: boolean;
  invite_not_sent: boolean;
  new_link_requested: boolean;
  email_verified: boolean;
  invited_at: string | null;
  last_access_at: string | null;
  projects: Array<{ id: string; name: string }>;
}

const STATUS_SQL = `
  CASE
    WHEN cc.client_user_id IS NOT NULL AND cu.deleted_at IS NOT NULL THEN 'deleted'
    WHEN cc.disabled_at IS NOT NULL THEN 'deactivated'
    WHEN cc.client_user_id IS NOT NULL AND cu.status IS DISTINCT FROM 'active' THEN 'deactivated'
    WHEN cc.client_user_id IS NOT NULL AND cc.activated_at IS NOT NULL THEN 'active'
    ELSE 'invited'
  END
`;

/** One row per client user of a team with everything the admin console shows. Parameter $1 = team id. */
export const USER_VIEW_SQL = `
  SELECT cc.id, cc.client_id, cc.name, cc.email, cc.phone, cc.job_title, cc.role,
         cc.email_verified_at, cc.new_link_requested_at, cc.created_at,
         COALESCE(NULLIF(TRIM(c.company_name), ''), c.name) AS organization_name,
         cu.last_login AS last_access_at,
         inv.created_at AS invited_at,
         cu.deleted_at AS account_deleted_at,
         (SELECT l.scheduled_deletion_date
            FROM client_user_deletion_logs l
           WHERE l.client_user_id = cu.id AND NOT l.deletion_completed AND l.scheduled_deletion_date > NOW()
           ORDER BY l.requested_at DESC
           LIMIT 1) AS restorable_until,
         (${STATUS_SQL}) AS status_key,
         (inv.id IS NOT NULL AND inv.status = 'pending' AND inv.expires_at <= NOW()) AS invitation_lapsed,
         (inv.id IS NULL) AS no_invitation,
         COALESCE((
           SELECT json_agg(json_build_object('id', p.id, 'name', p.name) ORDER BY p.name)
             FROM client_contact_project_access a
             JOIN projects p ON p.id = a.project_id AND p.client_id = cc.client_id
            WHERE a.client_contact_id = cc.id
         ), '[]'::json) AS projects
    FROM client_contacts cc
    JOIN clients c ON c.id = cc.client_id AND c.deleted_at IS NULL
    ${CONTACT_STATE_JOINS_SQL}
   WHERE cc.team_id = $1
`;

const toIsoOrNull = (value: unknown): string | null =>
  value instanceof Date ? value.toISOString() : typeof value === "string" ? value : null;

export function mapUserRow(row: any): ClientUserView {
  const status = row.status_key as ClientUserStatus;
  const invited = status === "invited";
  return {
    id: row.id,
    organization_id: row.client_id,
    organization_name: row.organization_name,
    name: row.name,
    email: row.email,
    phone: row.phone ?? null,
    job_title: row.job_title ?? null,
    role: row.role,
    status,
    account_deleted_at: status === "deleted" ? toIsoOrNull(row.account_deleted_at) : null,
    restorable_until: status === "deleted" ? toIsoOrNull(row.restorable_until) : null,
    invite_expired: invited && row.invitation_lapsed === true,
    invite_not_sent: invited && row.no_invitation === true,
    new_link_requested: invited && row.new_link_requested_at != null,
    email_verified: row.email_verified_at != null,
    invited_at: row.invited_at ?? null,
    last_access_at: row.last_access_at ?? null,
    projects: Array.isArray(row.projects) ? row.projects : [],
  };
}

export interface ClientUsersParams {
  search?: string;
  organization_id?: string;
  role?: string;
  status?: string;
  sort?: string;
  order?: string;
  page?: number;
  limit?: number;
}

/** Sortable list columns and the SQL each one orders by. Never interpolate a client value into SQL. */
const USER_SORTS: Record<string, string> = {
  name: "LOWER(u.name)",
  email: "LOWER(u.email)",
  job_title: "LOWER(u.job_title)",
  phone: "u.phone",
  organization: "LOWER(u.organization_name)",
  role: "u.role",
  status: "u.status_key",
  projects: "json_array_length(u.projects)",
  last_access: "u.last_access_at",
};

export async function listClientUsers(teamId: string, params: ClientUsersParams) {
  const page = Math.max(Number(params.page) || 1, 1);
  const limit = Math.min(Math.max(Number(params.limit) || 10, 1), 100);
  const filters: string[] = [];
  const values: unknown[] = [teamId];

  const search = (params.search ?? "").trim();
  if (search) {
    values.push(containsPattern(search));
    const n = values.length;
    filters.push(
      `(u.name ILIKE $${n} OR u.email ILIKE $${n} OR u.organization_name ILIKE $${n} OR u.job_title ILIKE $${n} OR u.phone ILIKE $${n}
        OR EXISTS (SELECT 1 FROM json_array_elements(u.projects) up WHERE up->>'name' ILIKE $${n}))`
    );
  }
  const clientIds = splitList(params.organization_id);
  if (clientIds.length) filters.push(`u.client_id = ANY($${values.push(clientIds)}::uuid[])`);
  // Role and status accept a comma-separated list; a user matches when any chosen value matches.
  const roles = splitList(params.role);
  if (roles.length) {
    if (!roles.every(isClientContactRole)) throw badRequest("Invalid role filter");
    filters.push(`u.role = ANY($${values.push(roles)}::text[])`);
  }
  const statuses = splitList(params.status);
  if (statuses.length) {
    const plainStatuses = statuses.filter(status => status !== "invite_expired");
    if (!plainStatuses.every(status => ["invited", "active", "deactivated", "deleted"].includes(status))) {
      throw badRequest("Invalid status filter");
    }
    const clauses: string[] = [];
    if (plainStatuses.length) clauses.push(`u.status_key = ANY($${values.push(plainStatuses)}::text[])`);
    if (plainStatuses.length !== statuses.length) clauses.push(`(u.status_key = 'invited' AND u.invitation_lapsed)`);
    filters.push(`(${clauses.join(" OR ")})`);
  }

  const sortSql = params.sort ? USER_SORTS[params.sort] : undefined;
  if (params.sort && !sortSql) throw badRequest("Invalid sort column");
  const direction = params.order === "desc" ? "DESC" : "ASC";
  const orderBy = sortSql
    ? `${sortSql} ${direction} NULLS LAST, u.organization_name, u.name`
    : "u.organization_name, u.name";

  values.push(limit, (page - 1) * limit);
  const limitParam = values.length - 1;
  const offsetParam = values.length;

  const result = await db.query(
    `SELECT u.*, COUNT(*) OVER()::int AS total_count
       FROM (${USER_VIEW_SQL}) u
      ${filters.length ? `WHERE ${filters.join(" AND ")}` : ""}
      ORDER BY ${orderBy}
      LIMIT $${limitParam} OFFSET $${offsetParam}`,
    values
  );

  return {
    items: result.rows.map(mapUserRow),
    total: result.rows[0]?.total_count ?? 0,
    page,
    limit,
  };
}

export async function getClientUser(q: Queryable, teamId: string, userId: string): Promise<ClientUserView> {
  const result = await q.query(`SELECT u.* FROM (${USER_VIEW_SQL}) u WHERE u.id = $2`, [teamId, userId]);
  if (result.rows.length === 0) throw notFound("Client user");
  return mapUserRow(result.rows[0]);
}

const roleLabel = (role: string) =>
  CLIENT_ROLE_DEFINITIONS.find(definition => definition.role === role)?.label ?? role;

interface UserRef {
  id: string;
  name: string;
  email: string;
  clientId: string;
  organizationName: string;
  role: ClientContactRole;
  status: ClientUserStatus;
  hasLogin: boolean;
  /** The sign-in (client_users row) behind this company user, when there is one. */
  loginId: string | null;
}

async function getUserRef(q: Queryable, teamId: string, userId: string): Promise<UserRef> {
  const result = await q.query(
    `SELECT u.id, u.name, u.email, u.client_id, u.organization_name, u.role, u.status_key,
            (cc.client_user_id IS NOT NULL) AS has_login, cc.client_user_id AS login_id
       FROM (${USER_VIEW_SQL}) u
       JOIN client_contacts cc ON cc.id = u.id
      WHERE u.id = $2`,
    [teamId, userId]
  );
  const row = result.rows[0];
  if (!row) throw notFound("Client user");
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    clientId: row.client_id,
    organizationName: row.organization_name,
    role: row.role,
    status: row.status_key,
    hasLogin: row.has_login === true,
    loginId: row.login_id ?? null,
  };
}

/**
 * The user, read after locking their organization. Changes that depend on who else is an Active Client
 * Admin or approver take this lock first (see organization-lock.ts), then read the user again, so a
 * concurrent removal cannot slip between the check and the write. The first read only finds the organization.
 */
async function loadLockedUser(
  q: Queryable,
  teamId: string,
  userId: string,
  onlyOrganizationId?: string
): Promise<UserRef> {
  const found = await getUserRef(q, teamId, userId);
  // Someone from another organization is indistinguishable from someone who does not exist, and their
  // organization is never locked on a stranger's behalf.
  if (onlyOrganizationId && found.clientId !== onlyOrganizationId) throw notFound("User");
  await lockOrganization(q, teamId, found.clientId);
  return getUserRef(q, teamId, userId);
}

/**
 * Whether taking `userId` out of (or demoting) its organization's Active Client Admins would leave
 * the organization with none. An organization with no Client Admin cannot be the approver of an
 * approval, so staff must confirm before it happens.
 */
async function wouldRemoveLastClientAdmin(q: Queryable, teamId: string, user: UserRef): Promise<boolean> {
  if (user.role !== "admin" || user.status !== "active") return false;
  const result = await q.query(
    `SELECT COUNT(*)::int AS n
       FROM (${USER_VIEW_SQL}) u
      WHERE u.client_id = $2 AND u.role = 'admin' AND u.status_key = 'active' AND u.id <> $3`,
    [teamId, user.clientId, user.id]
  );
  return (result.rows[0]?.n ?? 0) === 0;
}

async function assertNotLastClientAdmin(
  q: Queryable,
  teamId: string,
  user: UserRef,
  confirmed: boolean | undefined
): Promise<void> {
  if (confirmed) return;
  if (await wouldRemoveLastClientAdmin(q, teamId, user)) {
    throw conflict(
      `${user.name} is the last active Client Admin of ${user.organizationName}. Without one, no approval can be sent to this organization.`,
      "LAST_CLIENT_ADMIN"
    );
  }
}

/**
 * Awaiting approvals that this user is the ONLY remaining able approver of. Taking them out (removing or
 * deactivating) would leave a request nobody can decide, so staff must confirm, and each affected
 * approval gets a history line telling the team to name someone else.
 */
async function assertNoOrphanedApprovals(
  q: Queryable,
  teamId: string,
  user: UserRef,
  confirmed: boolean | undefined,
  actor: AuditActor
): Promise<void> {
  const orphaned = await q.query(
    `SELECT a.id, a.ref_no, a.revision
       FROM client_portal_approvals a
       JOIN client_portal_approval_approvers ap ON ap.approval_id = a.id AND ap.contact_id = $2
      WHERE a.organization_team_id = $1 AND a.status = 'awaiting'
        AND NOT EXISTS (
          SELECT 1
            FROM client_portal_approval_approvers other
            JOIN client_contacts oc ON oc.id = other.contact_id
           WHERE other.approval_id = a.id AND other.contact_id <> $2
             AND oc.disabled_at IS NULL AND oc.activated_at IS NOT NULL)`,
    [teamId, user.id]
  );
  if (orphaned.rows.length === 0) return;
  if (!confirmed) {
    const refs = orphaned.rows.map(row => row.ref_no as string).join(", ");
    throw conflict(
      `${user.name} is the only approver of ${orphaned.rows.length === 1 ? "an approval" : `${orphaned.rows.length} approvals`} still waiting for a decision (${refs}). Name another approver first, or confirm to leave ${orphaned.rows.length === 1 ? "it" : "them"} without one.`,
      "PENDING_APPROVALS",
      { approvals: orphaned.rows.map(row => row.ref_no as string) }
    );
  }
  for (const row of orphaned.rows) {
    await q.query(
      `INSERT INTO client_portal_approval_events (approval_id, revision, actor_side, actor_name, text)
       VALUES ($1, $2, $3, $4, $5)`,
      [row.id, row.revision, actor.side, actor.name, `${user.name} was removed as an approver. Name a new approver so this request can be decided.`]
    );
  }
}

export interface UpdateUserInput {
  name?: string;
  email?: string;
  phone?: string | null;
  job_title?: string | null;
  role?: string;
  confirm_last_admin?: boolean;
  confirm_pending_approvals?: boolean;
}

/**
 * Edits name, email, phone, job title and role. A role change writes `Role changed` with the from
 * and to roles and applies on the user's next authorization check, not only at next sign-in. The
 * email cannot change once the person has a login (it is their login and invitation address).
 * Demoting a Client Admin is held to the same rules as removing one: the last Client Admin and the
 * sole approver of an awaiting approval both need an explicit confirmation.
 */
export async function updateClientUser(input: {
  teamId: string;
  userId: string;
  actor: AuditActor;
  patch: UpdateUserInput;
}): Promise<ClientUserView> {
  const { teamId, userId, actor, patch } = input;

  await withTransaction(async tx => {
    const user = await loadLockedUser(tx, teamId, userId);
    const sets: string[] = [];
    const values: unknown[] = [userId, teamId];
    const set = (column: string, value: unknown) => {
      values.push(value);
      sets.push(`${column} = $${values.length}`);
    };

    if (patch.name !== undefined) {
      const name = patch.name.trim();
      if (!name) throw badRequest("A name is required");
      set("name", name.slice(0, 255));
    }
    if (patch.email !== undefined) {
      const email = normalizeContactEmail(patch.email);
      if (!isValidContactEmail(email)) throw badRequest("A valid email address is required");
      if (email.toLowerCase() !== user.email.toLowerCase()) {
        if (user.hasLogin) {
          throw conflict("This user has already signed in, so their email can no longer change", "HAS_LOGIN");
        }
        const taken = await tx.query(
          `SELECT id FROM client_contacts WHERE team_id = $1 AND lower(email) = lower($2) AND id <> $3`,
          [teamId, email, userId]
        );
        if (taken.rows.length > 0) throw conflict(`${email} already belongs to another client user`, "EMAIL_TAKEN");
        set("email", email);
      }
    }
    if (patch.phone !== undefined) set("phone", patch.phone?.trim() ? patch.phone.trim().slice(0, 50) : null);
    if (patch.job_title !== undefined) {
      set("job_title", patch.job_title?.trim() ? patch.job_title.trim().slice(0, 100) : null);
    }

    let roleChanged: { from: string; to: ClientContactRole } | null = null;
    if (patch.role !== undefined && patch.role !== user.role) {
      if (!isClientContactRole(patch.role)) throw badRequest("Role must be admin, member or viewer");
      if (user.role === "admin") {
        await assertNotLastClientAdmin(tx, teamId, user, patch.confirm_last_admin);
        await assertNoOrphanedApprovals(tx, teamId, user, patch.confirm_pending_approvals, actor);
      }
      set("role", patch.role);
      roleChanged = { from: user.role, to: patch.role };
    }

    if (sets.length > 0) {
      await tx.query(
        `UPDATE client_contacts SET ${sets.join(", ")}, updated_at = NOW() WHERE id = $1 AND team_id = $2`,
        values
      );
    }

    if (roleChanged) {
      await recordAuditEvent(tx, {
        teamId,
        event: "Role changed",
        actor,
        clientId: user.clientId,
        clientName: user.organizationName,
        targetType: "client_user",
        targetId: user.id,
        targetLabel: `${user.name} · ${roleLabel(roleChanged.from)} → ${roleLabel(roleChanged.to)}`,
        metadata: roleChanged,
      });
    }
  });

  return getClientUser(db, teamId, userId);
}

/**
 * Replaces a user's project assignments. Projects whose Client Portal is off cannot be newly
 * assigned. Writes one `Project access assigned` or `Project access removed` event per change, and
 * removed access applies on the client's next request.
 */
export async function assignClientUserProjects(input: {
  teamId: string;
  userId: string;
  projectIds: string[];
  actor: AuditActor;
}): Promise<ClientUserView> {
  const { teamId, userId, actor } = input;
  const wanted = Array.from(new Set(input.projectIds));

  await withTransaction(async tx => {
    const user = await getUserRef(tx, teamId, userId);

    if (wanted.length > 0) {
      const valid = await tx.query(
        `SELECT id FROM projects WHERE id = ANY($1::uuid[]) AND client_id = $2 AND team_id = $3`,
        [wanted, user.clientId, teamId]
      );
      if (valid.rows.length !== wanted.length) {
        throw badRequest("One or more projects do not belong to this organization", "INVALID_PROJECT");
      }
    }

    const current = await tx.query(
      `SELECT project_id FROM client_contact_project_access WHERE client_contact_id = $1`,
      [userId]
    );
    const currentIds = new Set(current.rows.map(row => row.project_id as string));

    for (const projectId of wanted.filter(id => !currentIds.has(id))) {
      await assignContactToProject(tx, { teamId, contactId: userId, projectId, actor });
    }
    for (const projectId of Array.from(currentIds).filter(id => !wanted.includes(id))) {
      await removeContactFromProject(tx, { teamId, contactId: userId, projectId, actor });
    }
  });

  return getClientUser(db, teamId, userId);
}

/**
 * Resends the invitation: status Invited, the expired flag and any "asked for a new link" request
 * are cleared, the link is valid for 7 days, and `Invitation resent` is written. With delivery
 * "link" nothing is emailed: the sign-in link is returned for staff to copy. It carries the user's
 * address, so opening it emails them a one-time code. Any earlier link stops working.
 */
export async function resendClientInvitation(input: {
  teamId: string;
  userId: string;
  invitedBy: string;
  actor: AuditActor;
  delivery?: InviteDelivery;
}) {
  const user = await getUserRef(db, input.teamId, input.userId);

  const result = await inviteContact({
    teamId: input.teamId,
    contactId: input.userId,
    invitedBy: input.invitedBy,
    delivery: input.delivery ?? "email",
  });

  await db.query(`UPDATE client_contacts SET new_link_requested_at = NULL, updated_at = NOW() WHERE id = $1`, [
    input.userId,
  ]);

  // A fresh sign-in link for someone who is already active is not an invitation.
  if (user.status !== "active") {
    await recordAuditEvent(db, {
      teamId: input.teamId,
      event: "Invitation resent",
      actor: input.actor,
      clientId: user.clientId,
      clientName: user.organizationName,
      targetType: "client_user",
      targetId: user.id,
      targetLabel: `${user.name} · ${user.organizationName}`,
    });
  }

  return result;
}

/**
 * Deactivates a user. Access is revoked immediately: an open session fails on its next request
 * (every client request re-checks the user) and the user is signed out. Reactivating restores the
 * status they held, because status is derived.
 */
export async function deactivateClientUser(input: {
  teamId: string;
  userId: string;
  actor: AuditActor;
  confirmLastAdmin?: boolean;
  confirmPendingApprovals?: boolean;
}): Promise<ClientUserView> {
  await withTransaction(async tx => {
    const user = await loadLockedUser(tx, input.teamId, input.userId);
    if (user.status === "deactivated") return;
    if (user.status === "deleted") throw accountDeletedConflict(user);
    await assertNotLastClientAdmin(tx, input.teamId, user, input.confirmLastAdmin);
    await assertNoOrphanedApprovals(tx, input.teamId, user, input.confirmPendingApprovals, input.actor);

    const updated = await tx.query(
      `UPDATE client_contacts SET disabled_at = COALESCE(disabled_at, NOW()), updated_at = NOW() WHERE id = $1 AND team_id = $2`,
      [input.userId, input.teamId]
    );
    // Someone else removed the user between the read and the write: nothing to record.
    if (updated.rowCount === 0) throw notFound("Client user");
    await recordAuditEvent(tx, {
      teamId: input.teamId,
      event: "Client deactivated",
      actor: input.actor,
      clientId: user.clientId,
      clientName: user.organizationName,
      targetType: "client_user",
      targetId: user.id,
      targetLabel: `${user.name} · ${user.organizationName}`,
    });
  });
  return getClientUser(db, input.teamId, input.userId);
}

/** Reactivates a deactivated user, restoring the status they held before. */
export async function reactivateClientUser(input: {
  teamId: string;
  userId: string;
  actor: AuditActor;
}): Promise<ClientUserView> {
  await withTransaction(async tx => {
    const user = await loadLockedUser(tx, input.teamId, input.userId);
    // Clearing `disabled_at` cannot undo a deleted account; that has its own restore.
    if (user.status === "deleted") throw accountDeletedConflict(user);
    const updated = await tx.query(
      `UPDATE client_contacts SET disabled_at = NULL, updated_at = NOW() WHERE id = $1 AND team_id = $2`,
      [input.userId, input.teamId]
    );
    if (updated.rowCount === 0) throw notFound("Client user");
    await recordAuditEvent(tx, {
      teamId: input.teamId,
      event: "Client activated",
      actor: input.actor,
      clientId: user.clientId,
      clientName: user.organizationName,
      targetType: "client_user",
      targetId: user.id,
      targetLabel: `${user.name} · ${user.organizationName}`,
    });
  });
  return getClientUser(db, input.teamId, input.userId);
}

const accountDeletedConflict = (user: UserRef): PortalError =>
  conflict(
    `${user.name} deleted their own account. Restore the account instead, or remove the user.`,
    "ACCOUNT_DELETED"
  );

export interface RemoveContactInput {
  teamId: string;
  userId: string;
  /** Who removes: staff (`side: "internal"`) or a Client Admin (`side: "client"`). */
  actor: AuditActor;
  confirmLastAdmin?: boolean;
  confirmPendingApprovals?: boolean;
  /** A Client Admin may only remove people of their own organization; anyone else answers 404. */
  onlyOrganizationId?: string;
  /**
   * Refuse a user staff deactivated or that deleted their own account. A Client Admin must not undo a
   * staff decision, and removing a self-deleted person would erase the profile staff keep during the
   * retention window.
   */
  refuseStaffManaged?: boolean;
}

/**
 * The one way to remove a client user, for staff and for a Client Admin alike, so both are held to the
 * same rules: the organization is locked first, the last Client Admin and the sole approver of an
 * awaiting approval are protected, the person's link to this portal is dropped with them, and the
 * removal is audited once, whoever got there first. Their comments, approvals and audit events stay in
 * history because those keep a snapshot of the name instead of a hard dependency.
 *
 * Call inside a transaction.
 */
export async function removeContact(tx: Queryable, input: RemoveContactInput): Promise<void> {
  const user = await loadLockedUser(tx, input.teamId, input.userId, input.onlyOrganizationId);

  if (input.refuseStaffManaged) {
    if (user.status === "deactivated") {
      throw conflict(
        `${user.name}'s access was deactivated by your project team. Ask them to remove or reactivate it.`,
        "DEACTIVATED_BY_STAFF"
      );
    }
    if (user.status === "deleted") {
      throw conflict(`${user.name} deleted their own account.`, "ACCOUNT_DELETED");
    }
  }

  await assertNotLastClientAdmin(tx, input.teamId, user, input.confirmLastAdmin);
  await assertNoOrphanedApprovals(tx, input.teamId, user, input.confirmPendingApprovals, input.actor);

  const removed = await tx.query(`DELETE FROM client_contacts WHERE id = $1 AND team_id = $2`, [
    input.userId,
    input.teamId,
  ]);
  // Already removed by someone who got there first: no second audit entry, no second set of history notes.
  if (removed.rowCount === 0) throw new PortalError(404, "This user has already been removed.", "ALREADY_REMOVED");

  // The login and its link to this portal would otherwise outlive the contact. Drop the link when this
  // was the person's last company user here, so every route (legacy and refresh included) stops at once.
  if (user.loginId) {
    await tx.query(
      `DELETE FROM client_user_organizations cuo
        WHERE cuo.client_user_id = $1 AND cuo.team_id = $2 AND cuo.client_id = $3
          AND NOT EXISTS (
            SELECT 1 FROM client_contacts cc
             WHERE cc.client_user_id = $1 AND cc.team_id = $2 AND cc.client_id = $3)`,
      [user.loginId, input.teamId, user.clientId]
    );
  }
  await recordAuditEvent(tx, {
    teamId: input.teamId,
    event: "Client removed",
    actor: input.actor,
    clientId: user.clientId,
    clientName: user.organizationName,
    targetType: "client_user",
    targetId: user.id,
    targetLabel: `${user.name} · ${user.organizationName}`,
    metadata: { role: user.role, removed_by: input.actor.side },
  });
}

/** Staff removal of a client user. See `removeContact`. */
export async function removeClientUser(input: {
  teamId: string;
  userId: string;
  actor: AuditActor;
  confirmLastAdmin?: boolean;
  confirmPendingApprovals?: boolean;
}): Promise<void> {
  await withTransaction(tx => removeContact(tx, input));
}

/**
 * Restores a client user who deleted their own account, inside the 30-day window, with their profile,
 * role, project access and history. This reverses a decision the person made themselves, so it is meant
 * for when they ask staff to bring the account back.
 *
 * The login is shared by every portal the person belongs to. Restoring it from one workspace is only
 * allowed when this is the only workspace they are in; otherwise the person must ask Worklenz support,
 * so one workspace can never undo a deletion that also concerns another one.
 */
export async function restoreClientAccount(input: {
  teamId: string;
  userId: string;
  actor: AuditActor;
}): Promise<ClientUserView> {
  await withTransaction(async tx => {
    const user = await loadLockedUser(tx, input.teamId, input.userId);
    if (user.status !== "deleted" || !user.loginId) {
      throw conflict(`${user.name} has not deleted their account.`, "NOT_DELETED");
    }

    const scheduled = await tx.query(
      `SELECT scheduled_deletion_date
         FROM client_user_deletion_logs
        WHERE client_user_id = $1 AND NOT deletion_completed
        ORDER BY requested_at DESC
        LIMIT 1
        FOR UPDATE`,
      [user.loginId]
    );
    const window = scheduled.rows[0]?.scheduled_deletion_date as Date | undefined;
    if (!window || window.getTime() <= Date.now()) {
      throw new PortalError(410, "The 30-day window to restore this account has ended.", "RETENTION_EXPIRED");
    }

    const memberships = await tx.query(
      `SELECT COUNT(DISTINCT team_id)::int AS teams FROM client_contacts WHERE client_user_id = $1`,
      [user.loginId]
    );
    if ((memberships.rows[0]?.teams ?? 0) > 1) {
      throw conflict(
        `${user.name} also belongs to other portals, so this account can only be restored by Worklenz support.`,
        "SHARED_LOGIN"
      );
    }

    await tx.query(`UPDATE client_users SET deleted_at = NULL, updated_at = NOW() WHERE id = $1`, [user.loginId]);
    // The log is the purge queue: a restored account must leave it, or support would still purge it.
    await tx.query(`DELETE FROM client_user_deletion_logs WHERE client_user_id = $1 AND NOT deletion_completed`, [
      user.loginId,
    ]);
    await recordAuditEvent(tx, {
      teamId: input.teamId,
      event: "Client account restored",
      actor: input.actor,
      clientId: user.clientId,
      clientName: user.organizationName,
      targetType: "client_user",
      targetId: user.id,
      targetLabel: `${user.name} · ${user.organizationName}`,
    });
  });
  return getClientUser(db, input.teamId, input.userId);
}
