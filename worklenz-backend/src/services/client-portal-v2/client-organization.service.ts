import db from "../../config/db";
import { ContactServiceError, createContact, findContactByEmail, inviteContact, isValidContactEmail, normalizeContactEmail, withTransaction } from "../client-contacts-service";
import { recordAuditEvent } from "./audit.service";
import { clientRoleCan } from "../../shared/client-portal-permissions";
import { requireCapability } from "./client-read.service";
import { assertSubjectProject } from "./scope";
import { PortalError, badRequest, conflict, forbidden, notFound } from "./errors";
import { assignContactToProject, removeContactFromProject } from "./project-core";
import { getPortalSettingsV2 } from "./settings.service";
import { ClientSubject } from "./subject";
import { Queryable } from "./types";
import { USER_VIEW_SQL, removeContact, updateClientUser } from "./users.service";

/**
 * Account > Organization for a client user: the people in their own organization, and (when the
 * operator switched it on in Portal Settings) a Client Admin inviting or removing colleagues.
 *
 * Everything is scoped to `subject.clientId`: a person only ever sees, invites or removes people of their
 * own organization. The operator's switches are checked on every call, not just hidden in the UI.
 */

export interface ClientOrgUserDto {
  id: string;
  name: string;
  email: string;
  jobTitle: string;
  role: ClientSubject["role"];
  status: "Active" | "Invited" | "Deactivated" | "Deleted";
  isYou: boolean;
}

const STATUS_LABEL: Record<string, ClientOrgUserDto["status"]> = {
  active: "Active",
  invited: "Invited",
  deactivated: "Deactivated",
  deleted: "Deleted",
};

export const INVITE_LINK_DAYS = 7;

export async function listOrganizationUsers(q: Queryable, subject: ClientSubject): Promise<ClientOrgUserDto[]> {
  const result = await q.query(
    `SELECT u.id, u.name, u.email, u.job_title, u.role, u.status_key
       FROM (${USER_VIEW_SQL}) u
      WHERE u.client_id = $2
      ORDER BY LOWER(u.name)`,
    [subject.teamId, subject.clientId]
  );
  return result.rows.map(row => ({
    id: row.id,
    name: row.name,
    email: row.email,
    jobTitle: row.job_title ?? "",
    role: row.role,
    status: STATUS_LABEL[row.status_key] ?? "Invited",
    isYou: row.id === subject.contactId,
  }));
}

const nameFromEmail = (email: string): string => {
  const local = email.split("@")[0] ?? email;
  return local.replace(/[._-]+/g, " ").trim() || email;
};

/**
 * A Client Admin creates an invite link for a colleague. The colleague joins as a Client Viewer with no
 * projects (the operator assigns projects and any other role), confirms their email with a one-time code,
 * and the link works for seven days. Needs the Manage users capability AND the operator's "admins can
 * invite" switch. Audited as `Invite link created`. With `sendEmail` the invitation is also emailed to them.
 */
export async function createOrganizationInviteLink(
  subject: ClientSubject,
  emailInput: unknown,
  sendEmail = false
): Promise<{ link: string | null; expires_in_days: number; email: string; emailed: boolean }> {
  requireCapability(subject, "manage_users");
  const settings = await getPortalSettingsV2(db, subject.teamId);
  if (!settings.admins_can_invite_users) {
    throw forbidden("Inviting colleagues isn't enabled for your portal", "INVITES_DISABLED");
  }

  const email = typeof emailInput === "string" ? normalizeContactEmail(emailInput) : "";
  if (!isValidContactEmail(email)) throw badRequest("Enter a valid email address.", "INVALID_EMAIL");

  const created = await withTransaction(async tx => {
    const existing = await findContactByEmail(tx, subject.teamId, email);
    if (existing) throw conflict("That address already has access.", "ALREADY_EXISTS");

    const contact = await createContact(tx, {
      teamId: subject.teamId,
      clientId: subject.clientId,
      name: nameFromEmail(email),
      email,
      role: "viewer",
    });
    const clientName = await tx.query(`SELECT COALESCE(NULLIF(TRIM(company_name), ''), name) AS name FROM clients WHERE id = $1`, [
      subject.clientId,
    ]);
    await recordAuditEvent(tx, {
      teamId: subject.teamId,
      event: "Invite link created",
      actor: { side: "client", name: subject.name, contactId: subject.contactId },
      clientId: subject.clientId,
      clientName: clientName.rows[0]?.name ?? null,
      targetType: "client_user",
      targetId: contact.id,
      targetLabel: `${contact.email} · invited by ${subject.name}`,
    });
    return contact;
  }).catch(error => {
    if (error instanceof ContactServiceError && error.code === "EMAIL_TAKEN") {
      throw conflict("That address already has access.", "ALREADY_EXISTS");
    }
    throw error;
  });

  const invite = await inviteContact({
    teamId: subject.teamId,
    contactId: created.id,
    invitedBy: null,
    invitedByContactId: subject.contactId,
    delivery: sendEmail ? "email" : "link",
  });

  // When the email could not be sent the link comes back anyway, so the admin can share it by hand.
  return { link: invite.link, expires_in_days: INVITE_LINK_DAYS, email: created.email, emailed: invite.emailSent };
}

/**
 * Removes a colleague. Needs Manage users AND the operator's "admins can remove" switch. You can't remove
 * yourself, and an organization can't be left without a Client Admin. Their access ends on their very next
 * request (every request re-checks the person). Audited as `Client removed`.
 */
export async function removeOrganizationUser(subject: ClientSubject, userId: string): Promise<void> {
  requireCapability(subject, "manage_users");
  const settings = await getPortalSettingsV2(db, subject.teamId);
  if (!settings.admins_can_remove_users) {
    throw forbidden("Removing colleagues isn't enabled for your portal", "REMOVAL_DISABLED");
  }
  if (userId === subject.contactId) throw conflict("You can't remove yourself.", "CANNOT_REMOVE_SELF");

  // The same removal staff use (see removeContact), with no way to confirm past a protection: a Client
  // Admin cannot leave the organization without an admin, nor strand an approval nobody else can decide.
  await withTransaction(tx =>
    removeContact(tx, {
      teamId: subject.teamId,
      userId,
      actor: { side: "client", name: subject.name, contactId: subject.contactId },
      onlyOrganizationId: subject.clientId,
      refuseStaffManaged: true,
    })
  ).catch(error => {
    if (error instanceof PortalError && error.code === "LAST_CLIENT_ADMIN") {
      throw conflict("An organization needs at least one Client Admin.", "LAST_ADMIN");
    }
    if (error instanceof PortalError && error.code === "PENDING_APPROVALS") {
      throw conflict(
        "This person is the only approver of an approval that is still waiting. Ask your project team to name another approver first.",
        "PENDING_APPROVALS",
        error.details
      );
    }
    throw error;
  });
}

/** The org-scoped lookup shared by edit and resend: someone from another organization looks like nobody. */
async function requireOrganizationMember(subject: ClientSubject, userId: string) {
  const found = await db.query(
    `SELECT u.id, u.name, u.email, u.job_title, u.role, u.status_key
       FROM (${USER_VIEW_SQL}) u
      WHERE u.id = $2 AND u.client_id = $3`,
    [subject.teamId, userId, subject.clientId]
  );
  const target = found.rows[0];
  if (!target) throw notFound("User");
  return target;
}

/**
 * A Client Admin edits a colleague's name, job title or role. Needs the Manage users capability. The
 * email is the sign-in address and never changes here. You can't change your own role, and demoting the
 * last active Client Admin is refused. A role change is audited as `Role changed`.
 */
export async function updateOrganizationUser(
  subject: ClientSubject,
  userId: string,
  input: { name?: unknown; job_title?: unknown; role?: unknown }
): Promise<ClientOrgUserDto> {
  requireCapability(subject, "manage_users");
  const target = await requireOrganizationMember(subject, userId);

  const patch: { name?: string; job_title?: string | null; role?: string } = {};
  if (input.name !== undefined) {
    if (typeof input.name !== "string" || !input.name.trim()) throw badRequest("Name is required", "MISSING_FIELDS");
    if (input.name.trim().length > 255) throw badRequest("A name can be at most 255 characters");
    patch.name = input.name;
  }
  if (input.job_title !== undefined) {
    if (input.job_title !== null && typeof input.job_title !== "string") throw badRequest("Job title must be text");
    if (typeof input.job_title === "string" && input.job_title.trim().length > 100) {
      throw badRequest("A job title can be at most 100 characters");
    }
    patch.job_title = input.job_title as string | null;
  }
  if (input.role !== undefined) {
    if (typeof input.role !== "string" || !["admin", "member", "viewer"].includes(input.role)) {
      throw badRequest("Role must be admin, member or viewer", "INVALID_ROLE");
    }
    if (input.role !== target.role) {
      if (userId === subject.contactId) throw conflict("You can't change your own role.", "CANNOT_CHANGE_OWN_ROLE");
      patch.role = input.role;
    }
  }

  await updateClientUser({
    teamId: subject.teamId,
    userId,
    actor: { side: "client", name: subject.name, contactId: subject.contactId },
    patch,
  });

  const [updated] = (await listOrganizationUsers(db, subject)).filter(user => user.id === userId);
  return updated;
}

/**
 * Sends a fresh invitation for a colleague who hasn't joined yet: by email, or as a link to copy. The
 * previous link stops working. Needs Manage users AND the operator's "admins can invite" switch.
 */
export async function resendOrganizationInvite(
  subject: ClientSubject,
  userId: string,
  sendEmail: boolean
): Promise<{ link: string | null; expires_in_days: number; email: string; emailed: boolean }> {
  requireCapability(subject, "manage_users");
  const settings = await getPortalSettingsV2(db, subject.teamId);
  if (!settings.admins_can_invite_users) {
    throw forbidden("Inviting colleagues isn't enabled for your portal", "INVITES_DISABLED");
  }
  const target = await requireOrganizationMember(subject, userId);
  if (target.status_key === "active") throw conflict("This person has already joined.", "ALREADY_ACTIVE");

  try {
    const invite = await inviteContact({
      teamId: subject.teamId,
      contactId: userId,
      invitedBy: null,
      invitedByContactId: subject.contactId,
      delivery: sendEmail ? "email" : "link",
    });
    if (sendEmail && !invite.emailSent) {
      throw new PortalError(502, "We could not send the invitation email. Copy the invite link instead.", "EMAIL_NOT_SENT");
    }
    return { link: sendEmail ? null : invite.link, expires_in_days: INVITE_LINK_DAYS, email: invite.email, emailed: invite.emailSent };
  } catch (error) {
    if (error instanceof ContactServiceError) {
      if (error.code === "NOT_FOUND") throw notFound("User");
      throw conflict(error.message, error.code);
    }
    throw error;
  }
}

export interface OrganizationUserProjectsDto {
  role: ClientSubject["role"];
  projects: Array<{ id: string; name: string; assigned: boolean }>;
}

/** The organization's projects that have the Client Portal on: the only ones a person can be assigned to. */
async function listAssignableProjects(q: Queryable, subject: ClientSubject): Promise<Array<{ id: string; name: string }>> {
  const result = await q.query(
    `SELECT p.id, p.name
       FROM projects p
       JOIN project_client_settings pcs ON pcs.project_id = p.id AND pcs.portal_enabled IS TRUE
      WHERE p.client_id = $1 AND p.team_id = $2
      ORDER BY LOWER(p.name)`,
    [subject.clientId, subject.teamId]
  );
  return result.rows.map(row => ({ id: row.id as string, name: row.name as string }));
}

async function currentProjectIds(q: Queryable, userId: string): Promise<Set<string>> {
  const result = await q.query(`SELECT project_id FROM client_contact_project_access WHERE client_contact_id = $1`, [userId]);
  return new Set(result.rows.map(row => row.project_id as string));
}

/**
 * Which of the organization's projects a Member or Viewer is assigned to. A Client Admin opens every
 * project automatically, so there is nothing to assign to them.
 */
export async function getOrganizationUserProjects(subject: ClientSubject, userId: string): Promise<OrganizationUserProjectsDto> {
  requireCapability(subject, "manage_users");
  const target = await requireOrganizationMember(subject, userId);
  const [projects, assigned] = await Promise.all([listAssignableProjects(db, subject), currentProjectIds(db, userId)]);
  return { role: target.role, projects: projects.map(project => ({ ...project, assigned: assigned.has(project.id) })) };
}

/**
 * A Client Admin sets which projects a Client Member or Client Viewer can open. Needs Manage users. Only
 * this organization's projects with the Client Portal on can be chosen; anything outside that set is left
 * as it was. Each change is audited as `Project access assigned` or `Project access removed`, and removed
 * access ends on the person's next request.
 */
export async function setOrganizationUserProjects(
  subject: ClientSubject,
  userId: string,
  projectIdsInput: unknown
): Promise<OrganizationUserProjectsDto> {
  requireCapability(subject, "manage_users");
  if (!Array.isArray(projectIdsInput) || projectIdsInput.some(id => typeof id !== "string")) {
    throw badRequest("project_ids must be a list of project ids", "INVALID_PROJECT");
  }
  const wanted = Array.from(new Set(projectIdsInput as string[]));
  const target = await requireOrganizationMember(subject, userId);
  if (target.role === "admin") {
    throw conflict("A Client Admin already opens every project of the organization.", "ADMIN_HAS_ALL_PROJECTS");
  }

  const actor = { side: "client" as const, name: subject.name, contactId: subject.contactId };
  await withTransaction(async tx => {
    const assignable = await listAssignableProjects(tx, subject);
    const assignableIds = new Set(assignable.map(project => project.id));
    if (wanted.some(id => !assignableIds.has(id))) {
      throw badRequest("One or more projects are not available to assign", "INVALID_PROJECT");
    }
    const current = await currentProjectIds(tx, userId);
    for (const projectId of wanted.filter(id => !current.has(id))) {
      await assignContactToProject(tx, { teamId: subject.teamId, contactId: userId, projectId, actor });
    }
    for (const projectId of Array.from(current).filter(id => assignableIds.has(id) && !wanted.includes(id))) {
      await removeContactFromProject(tx, { teamId: subject.teamId, contactId: userId, projectId, actor });
    }
  });

  return getOrganizationUserProjects(subject, userId);
}

export interface ProjectMemberDto {
  id: string;
  name: string;
  email: string;
  jobTitle: string;
  role: ClientSubject["role"];
  isYou: boolean;
  /** Client Admins open every project, so they can't be removed from one. */
  locked: boolean;
}

export interface ProjectMembersDto {
  members: ProjectMemberDto[];
  /** Colleagues who could be added. Empty unless the caller has Manage users. */
  candidates: ProjectMemberDto[];
}

/**
 * Who of the organization can open a project: assigned Members/Viewers plus every Client Admin. Any user
 * who can open the project sees the list; only Manage users sees who could still be added.
 */
export async function listProjectMembers(subject: ClientSubject, projectId: string): Promise<ProjectMembersDto> {
  await assertSubjectProject(db, subject, projectId);
  const [users, assigned] = await Promise.all([
    db.query(
      `SELECT u.id, u.name, u.email, u.job_title, u.role
         FROM (${USER_VIEW_SQL}) u
        WHERE u.client_id = $2 AND u.status_key <> 'deactivated'
        ORDER BY LOWER(u.name)`,
      [subject.teamId, subject.clientId]
    ),
    db.query(`SELECT client_contact_id FROM client_contact_project_access WHERE project_id = $1`, [projectId]),
  ]);
  const assignedIds = new Set(assigned.rows.map(row => row.client_contact_id as string));
  const toDto = (row: any): ProjectMemberDto => ({
    id: row.id,
    name: row.name,
    email: row.email,
    jobTitle: row.job_title ?? "",
    role: row.role,
    isYou: row.id === subject.contactId,
    locked: row.role === "admin",
  });
  const members: ProjectMemberDto[] = [];
  const candidates: ProjectMemberDto[] = [];
  for (const row of users.rows) {
    if (row.role === "admin" || assignedIds.has(row.id)) members.push(toDto(row));
    else candidates.push(toDto(row));
  }
  return { members, candidates: clientRoleCan(subject.role, "manage_users") ? candidates : [] };
}

/**
 * A Client Admin adds or removes Members and Viewers on one project. Needs Manage users. The project must
 * be open to the caller and have the Client Portal on; every id must belong to the caller's organization.
 * Each change is audited by the same helpers as the Organization page.
 */
export async function setProjectMembers(
  subject: ClientSubject,
  projectId: string,
  input: { add?: unknown; remove?: unknown }
): Promise<ProjectMembersDto> {
  requireCapability(subject, "manage_users");
  const toIds = (value: unknown): string[] => {
    if (value === undefined) return [];
    if (!Array.isArray(value) || value.some(id => typeof id !== "string")) {
      throw badRequest("add and remove must be lists of user ids", "INVALID_USER");
    }
    return Array.from(new Set(value as string[]));
  };
  const add = toIds(input.add);
  const remove = toIds(input.remove).filter(id => !add.includes(id));
  await assertSubjectProject(db, subject, projectId);

  const actor = { side: "client" as const, name: subject.name, contactId: subject.contactId };
  await withTransaction(async tx => {
    const assignable = await listAssignableProjects(tx, subject);
    if (!assignable.some(project => project.id === projectId)) throw notFound("Project");
    for (const userId of [...add, ...remove]) {
      const target = await requireOrganizationMember(subject, userId);
      if (target.role === "admin") {
        throw conflict("A Client Admin already opens every project of the organization.", "ADMIN_HAS_ALL_PROJECTS");
      }
    }
    const current = await tx.query(`SELECT client_contact_id FROM client_contact_project_access WHERE project_id = $1`, [projectId]);
    const currentIds = new Set(current.rows.map(row => row.client_contact_id as string));
    for (const contactId of add.filter(id => !currentIds.has(id))) {
      await assignContactToProject(tx, { teamId: subject.teamId, contactId, projectId, actor });
    }
    for (const contactId of remove.filter(id => currentIds.has(id))) {
      await removeContactFromProject(tx, { teamId: subject.teamId, contactId, projectId, actor });
    }
  });

  return listProjectMembers(subject, projectId);
}
