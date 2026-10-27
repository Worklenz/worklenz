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
import { badRequest, conflict, notFound } from "./errors";
import { assignContactToProject, removeContactFromProject } from "./project-core";
import { Queryable } from "./types";

/**
 * Client users (v2). A client user is a client_contacts row (see migration
 * 1791298000000_client_users_v2_roles_and_status).
 *
 * Status is derived, not stored, so reactivating a user restores exactly the status they held:
 *   Deactivated  disabled_at is set, or the login itself is inactive or deleted by its owner
 *   Active       linked to an active login and activated (email verified)
 *   Invited      everything else; "Invite expired" is a flag on an Invited user
 */

export type ClientUserStatus = "invited" | "active" | "deactivated";

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
    WHEN cc.disabled_at IS NOT NULL THEN 'deactivated'
    WHEN cc.client_user_id IS NOT NULL AND (cu.status IS DISTINCT FROM 'active' OR cu.deleted_at IS NOT NULL) THEN 'deactivated'
    WHEN cc.client_user_id IS NOT NULL AND cc.activated_at IS NOT NULL THEN 'active'
    ELSE 'invited'
  END
`;

/**
 * One row per client user of a team with everything the admin console shows. Parameter $1 = team id.
 *
 * Projects match what the user can open (see CONTACT_CAN_OPEN_PROJECT_SQL): a Client Admin opens every
 * portal-enabled project of their organization without rows in client_contact_project_access, so the
 * Clients table and Client Users table stay aligned when projects are linked at the organization level.
 * Members and Viewers still list only their explicit assignments (including portal-off rows staff may
 * keep for later), matching the Assign Projects modal.
 */
export const USER_VIEW_SQL = `
  SELECT cc.id, cc.client_id, cc.name, cc.email, cc.phone, cc.job_title, cc.role,
         cc.email_verified_at, cc.new_link_requested_at, cc.created_at,
         COALESCE(NULLIF(TRIM(c.company_name), ''), c.name) AS organization_name,
         cu.last_login AS last_access_at,
         inv.created_at AS invited_at,
         (${STATUS_SQL}) AS status_key,
         (inv.id IS NOT NULL AND inv.status = 'pending' AND inv.expires_at <= NOW()) AS invitation_lapsed,
         (inv.id IS NULL) AS no_invitation,
         COALESCE(
           CASE
             WHEN cc.role = 'admin' THEN (
               SELECT json_agg(json_build_object('id', p.id, 'name', p.name) ORDER BY p.name)
                 FROM projects p
                 JOIN project_client_settings pcs
                   ON pcs.project_id = p.id AND pcs.portal_enabled IS TRUE
                WHERE p.client_id = cc.client_id AND p.team_id = cc.team_id
             )
             ELSE (
               SELECT json_agg(json_build_object('id', p.id, 'name', p.name) ORDER BY p.name)
                 FROM client_contact_project_access a
                 JOIN projects p ON p.id = a.project_id AND p.client_id = cc.client_id
                WHERE a.client_contact_id = cc.id
             )
           END,
           '[]'::json
         ) AS projects
    FROM client_contacts cc
    JOIN clients c ON c.id = cc.client_id AND c.deleted_at IS NULL
    ${CONTACT_STATE_JOINS_SQL}
   WHERE cc.team_id = $1
`;

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
    if (!plainStatuses.every(status => ["invited", "active", "deactivated"].includes(status))) {
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
}

/**
 * Edits name, email, phone, job title and role. A role change writes `Role changed` with the from
 * and to roles and applies on the user's next authorization check, not only at next sign-in. The
 * email cannot change once the person has a login (it is their login and invitation address).
 */
export async function updateClientUser(input: {
  teamId: string;
  userId: string;
  actor: AuditActor;
  patch: UpdateUserInput;
}): Promise<ClientUserView> {
  const { teamId, userId, actor, patch } = input;

  await withTransaction(async tx => {
    const user = await getUserRef(tx, teamId, userId);
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
      if (user.role === "admin") await assertNotLastClientAdmin(tx, teamId, user, patch.confirm_last_admin);
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
    const user = await getUserRef(tx, input.teamId, input.userId);
    if (user.status === "deactivated") return;
    await assertNotLastClientAdmin(tx, input.teamId, user, input.confirmLastAdmin);
    await assertNoOrphanedApprovals(tx, input.teamId, user, input.confirmPendingApprovals, input.actor);

    await tx.query(
      `UPDATE client_contacts SET disabled_at = COALESCE(disabled_at, NOW()), updated_at = NOW() WHERE id = $1 AND team_id = $2`,
      [input.userId, input.teamId]
    );
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
    const user = await getUserRef(tx, input.teamId, input.userId);
    await tx.query(
      `UPDATE client_contacts SET disabled_at = NULL, updated_at = NOW() WHERE id = $1 AND team_id = $2`,
      [input.userId, input.teamId]
    );
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

/**
 * Removes a user and their project assignments. Their past comments, approvals and audit events
 * stay in history because those keep a snapshot of the name instead of a hard dependency.
 */
export async function removeClientUser(input: {
  teamId: string;
  userId: string;
  actor: AuditActor;
  confirmLastAdmin?: boolean;
  confirmPendingApprovals?: boolean;
}): Promise<void> {
  await withTransaction(async tx => {
    const user = await getUserRef(tx, input.teamId, input.userId);
    await assertNotLastClientAdmin(tx, input.teamId, user, input.confirmLastAdmin);
    await assertNoOrphanedApprovals(tx, input.teamId, user, input.confirmPendingApprovals, input.actor);

    await tx.query(`DELETE FROM client_contacts WHERE id = $1 AND team_id = $2`, [input.userId, input.teamId]);
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
    });
  });
}

