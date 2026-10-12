import db from "../config/db";
import { sendEmail } from "../shared/email";
import FileConstants from "../shared/file-constants";
import { IEmailTemplateType } from "../interfaces/email-template-type";
import { getClientPortalBaseUrl } from "../cron_jobs/helpers";
import { generatePrefixedToken } from "../utils/base62";
import {
  ClientContactRole,
  ClientPermissionLevel,
  isClientPermissionLevel,
} from "../shared/client-portal-permissions";

/**
 * Company Users ("client contacts"): one row per person at a client company.
 *
 * A contact exists before its person has a login. Once an invitation is accepted, `client_user_id`
 * points at the login row in client_users. Portal status is derived from that link and the
 * contact's latest invitation; only `disabled_at` is stored. See migration
 * 20260927100000_create_client_contacts.
 */

export type ContactPortalStatus = "active" | "invited" | "expired" | "not_invited" | "disabled";

export const CONTACT_PORTAL_STATUSES: ContactPortalStatus[] = [
  "active",
  "invited",
  "expired",
  "not_invited",
  "disabled",
];

// Invitations are valid for 7 days (TokenService.createInvitation uses the same interval).
const INVITATION_TTL_INTERVAL = "7 days";

/** Anything with a pg-style `query`: the shared pool, or a client checked out for a transaction. */
export interface Queryable {
  query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount?: number | null }>;
}

export const CONTACT_PORTAL_STATUS_LABELS: Record<ContactPortalStatus, { label: string; color: string }> = {
  active: { label: "Active", color: "green" },
  invited: { label: "Invited", color: "orange" },
  expired: { label: "Expired", color: "red" },
  not_invited: { label: "Not Invited", color: "default" },
  disabled: { label: "Disabled", color: "red" },
};

/** Runs `work` in a transaction on a dedicated connection; rolls back if it throws. */
export async function withTransaction<T>(work: (client: Queryable) => Promise<T>): Promise<T> {
  const client = await db.pool.connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => void 0);
    throw error;
  } finally {
    client.release();
  }
}

export type ContactServiceErrorCode =
  | "NOT_FOUND"
  | "EMAIL_TAKEN"
  | "INVALID_EMAIL"
  | "INVALID_PROJECT"
  | "INVALID_LEVEL"
  | "DISABLED"
  | "ALREADY_ACTIVE"
  | "HAS_LOGIN"
  | "NO_EMAIL"
  | "MISSING_FIELDS"
  | "INVALID_NAME"
  | "COMPANY_EXISTS"
  | "TOO_MANY_ROWS";

/** HTTP status a controller answers with for each expected failure. */
export const CONTACT_ERROR_HTTP_STATUS: Record<ContactServiceErrorCode, number> = {
  NOT_FOUND: 404,
  EMAIL_TAKEN: 409,
  INVALID_EMAIL: 400,
  INVALID_PROJECT: 400,
  INVALID_LEVEL: 400,
  DISABLED: 409,
  ALREADY_ACTIVE: 409,
  HAS_LOGIN: 409,
  NO_EMAIL: 400,
  MISSING_FIELDS: 400,
  INVALID_NAME: 400,
  COMPANY_EXISTS: 409,
  TOO_MANY_ROWS: 400,
};

/** Expected, user-facing failures. Controllers map `code` to an HTTP status. */
export class ContactServiceError extends Error {
  constructor(
    public readonly code: ContactServiceErrorCode,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "ContactServiceError";
  }
}

/**
 * Joins that give a contact (aliased `cc`) its login (`cu`) and its latest invitation (`inv`).
 * Used together with CONTACT_PORTAL_STATUS_SQL.
 */
export const CONTACT_STATE_JOINS_SQL = `
  LEFT JOIN client_users cu ON cu.id = cc.client_user_id
  LEFT JOIN LATERAL (
    SELECT ci.id, ci.status, ci.expires_at, ci.created_at
    FROM client_invitations ci
    WHERE ci.client_contact_id = cc.id
    ORDER BY ci.created_at DESC
    LIMIT 1
  ) inv ON TRUE
`;

/**
 * Derived portal status for a contact. Re-enabling a disabled contact only clears `disabled_at`,
 * so the status simply returns to whatever the login / invitation state implies. One edge: an
 * Invited contact who stays disabled past the invitation's expiry comes back as Expired.
 */
export const CONTACT_PORTAL_STATUS_SQL = `
  CASE
    WHEN cc.disabled_at IS NOT NULL THEN 'disabled'
    WHEN cu.status = 'active' THEN 'active'
    WHEN inv.id IS NULL OR inv.status <> 'pending' THEN 'not_invited'
    WHEN inv.expires_at > NOW() THEN 'invited'
    ELSE 'expired'
  END
`;

/**
 * A contact's per-project access as JSON. Only projects that still belong to the contact's company
 * count, so a project that moved to another client drops out without a cleanup job.
 */
export const PROJECT_ACCESS_SQL = `
  COALESCE((
    SELECT json_agg(
             json_build_object('project_id', p.id, 'name', p.name, 'level', a.permission_level)
             ORDER BY p.name
           )
    FROM client_contact_project_access a
    JOIN projects p ON p.id = a.project_id AND p.client_id = cc.client_id
    WHERE a.client_contact_id = cc.id
  ), '[]'::json)
`;

export interface ProjectAccessRow {
  project_id: string;
  name: string;
  level: string;
}

/** The shape every company-user endpoint returns for one person. */
export function mapContactRow(row: any) {
  const statusKey = row.portal_status_key as ContactPortalStatus;
  const projects: ProjectAccessRow[] = Array.isArray(row.projects) ? row.projects : [];

  return {
    id: row.id,
    client_id: row.client_id,
    company_name: row.company_name,
    name: row.name,
    email: row.email,
    phone: row.phone,
    job_title: row.job_title,
    role: row.role,
    has_login: row.has_login === true,
    last_login_at: row.last_login_at,
    invited_at: row.invited_at,
    created_at: row.created_at,
    portal_status: { status: statusKey, ...CONTACT_PORTAL_STATUS_LABELS[statusKey] },
    project_count: projects.length,
    projects,
  };
}

export async function loadContactView(teamId: string, contactId: string) {
  const result = await db.query(
    `SELECT
       cc.id, cc.client_id, cc.name, cc.email, cc.phone, cc.job_title, cc.role,
       cc.disabled_at, cc.created_at,
       COALESCE(NULLIF(TRIM(c.company_name), ''), c.name) AS company_name,
       cu.last_login AS last_login_at,
       (cc.client_user_id IS NOT NULL) AS has_login,
       inv.created_at AS invited_at,
       (${CONTACT_PORTAL_STATUS_SQL}) AS portal_status_key,
       ${PROJECT_ACCESS_SQL} AS projects
     FROM client_contacts cc
     JOIN clients c ON c.id = cc.client_id
     ${CONTACT_STATE_JOINS_SQL}
     WHERE cc.id = $1 AND cc.team_id = $2`,
    [contactId, teamId]
  );
  return result.rows[0] ? mapContactRow(result.rows[0]) : null;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidContactEmail(email: unknown): email is string {
  return typeof email === "string" && email.length <= 255 && EMAIL_PATTERN.test(email.trim());
}

export function normalizeContactEmail(email: string): string {
  return email.trim();
}

export interface ContactRow {
  id: string;
  team_id: string;
  client_id: string;
  client_user_id: string | null;
  name: string;
  email: string;
  phone: string | null;
  job_title: string | null;
  role: ClientContactRole;
  disabled_at: string | null;
}

export async function getContactById(
  q: Queryable,
  teamId: string,
  contactId: string
): Promise<ContactRow | null> {
  const result = await q.query(
    `SELECT id, team_id, client_id, client_user_id, name, email, phone, job_title, role, disabled_at
     FROM client_contacts
     WHERE id = $1 AND team_id = $2`,
    [contactId, teamId]
  );
  return result.rows[0] ?? null;
}

/**
 * Returns the contact that owns `email` in this team, if any. Contact emails are unique per team
 * because a portal login is unique per email.
 */
export async function findContactByEmail(
  q: Queryable,
  teamId: string,
  email: string
): Promise<(ContactRow & { company_name: string | null; client_name: string }) | null> {
  const result = await q.query(
    `SELECT cc.id, cc.team_id, cc.client_id, cc.client_user_id, cc.name, cc.email, cc.phone,
            cc.job_title, cc.role, cc.disabled_at,
            c.company_name, c.name AS client_name
     FROM client_contacts cc
     JOIN clients c ON c.id = cc.client_id
     WHERE cc.team_id = $1 AND lower(cc.email) = lower($2)`,
    [teamId, normalizeContactEmail(email)]
  );
  return result.rows[0] ?? null;
}

export interface NewContactInput {
  teamId: string;
  clientId: string;
  name: string;
  email: string;
  phone?: string | null;
  jobTitle?: string | null;
  role?: ClientContactRole;
}

/** Inserts a contact. Throws EMAIL_TAKEN if the email already belongs to a contact in the team. */
export async function createContact(q: Queryable, input: NewContactInput): Promise<ContactRow> {
  const email = normalizeContactEmail(input.email);
  if (!isValidContactEmail(email)) {
    throw new ContactServiceError("INVALID_EMAIL", "A valid email address is required");
  }

  const existing = await findContactByEmail(q, input.teamId, email);
  if (existing) {
    throw new ContactServiceError(
      "EMAIL_TAKEN",
      `${email} is already a contact of ${existing.company_name || existing.client_name}`,
      { contactId: existing.id, clientId: existing.client_id }
    );
  }

  const result = await q.query(
    `INSERT INTO client_contacts (team_id, client_id, name, email, phone, job_title, role)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, team_id, client_id, client_user_id, name, email, phone, job_title, role, disabled_at`,
    [
      input.teamId,
      input.clientId,
      input.name.trim().slice(0, 255),
      email,
      input.phone?.trim() ? input.phone.trim().slice(0, 50) : null,
      input.jobTitle?.trim() ? input.jobTitle.trim().slice(0, 100) : null,
      input.role ?? "member",
    ]
  );
  return result.rows[0];
}

/**
 * Makes sure a client has a contact for `email`, for the legacy paths that only know the client's
 * own email/contact_person (create, invite, resend). Returns null if the email already belongs to a
 * contact of a different company, so those paths keep working without linking to the wrong person.
 */
export async function ensureContactForClient(
  q: Queryable,
  input: {
    teamId: string;
    clientId: string;
    email: string | null | undefined;
    name: string;
    phone?: string | null;
    role?: ClientContactRole;
  }
): Promise<ContactRow | null> {
  if (!input.email || !isValidContactEmail(input.email)) return null;

  const existing = await findContactByEmail(q, input.teamId, input.email);
  if (existing) {
    return existing.client_id === input.clientId ? existing : null;
  }

  return createContact(q, {
    teamId: input.teamId,
    clientId: input.clientId,
    name: input.name,
    email: input.email,
    phone: input.phone,
    role: input.role ?? "poc",
  });
}

/**
 * Convenience for the legacy company-level invite paths (create, resend, link generation): ensures
 * the company's own email has a contact and returns its id, or null if it can't have one (no email,
 * or the email belongs to another company's contact). Never throws, so an invite that used to work
 * without company users keeps working.
 */
export async function ensureContactIdForClient(
  q: Queryable,
  teamId: string,
  client: {
    id: string;
    name: string;
    email?: string | null;
    phone?: string | null;
    contact_person?: string | null;
  }
): Promise<string | null> {
  try {
    const contact = await ensureContactForClient(q, {
      teamId,
      clientId: client.id,
      email: client.email,
      name: client.contact_person?.trim() || client.name,
      phone: client.phone,
      role: "poc",
    });
    return contact?.id ?? null;
  } catch (error) {
    console.error("Could not ensure a company user for the client:", error);
    return null;
  }
}

/**
 * Called when someone accepts an invitation (or is linked directly) and a login row exists.
 * Points the contact at that login, creating the contact first if the invitation predates
 * client_contacts. A login is linked to one contact per team, so a login that moved between
 * companies is unlinked from its previous contact in the same team first.
 */
export async function linkContactToLogin(
  q: Queryable,
  input: {
    teamId: string;
    clientId: string;
    clientUserId: string;
    email: string;
    name: string;
    contactId?: string | null;
    role?: ClientContactRole;
  }
): Promise<string | null> {
  let contactId = input.contactId ?? null;

  if (!contactId) {
    const existing = await findContactByEmail(q, input.teamId, input.email);
    if (existing) {
      // The email belongs to a contact of another company; leave it alone rather than steal it.
      if (existing.client_id !== input.clientId) return null;
      contactId = existing.id;
    } else {
      const created = await createContact(q, {
        teamId: input.teamId,
        clientId: input.clientId,
        name: input.name,
        email: input.email,
        role: input.role ?? "member",
      });
      contactId = created.id;
    }
  }

  await q.query(
    `UPDATE client_contacts
     SET client_user_id = NULL, updated_at = NOW()
     WHERE client_user_id = $1 AND team_id = $2 AND id <> $3`,
    [input.clientUserId, input.teamId, contactId]
  );

  await q.query(
    `UPDATE client_contacts
     SET client_user_id = $1, updated_at = NOW()
     WHERE id = $2 AND client_user_id IS DISTINCT FROM $1`,
    [input.clientUserId, contactId]
  );

  return contactId;
}

/** True when the contact tied to this login (for this company) has been disabled by an admin. */
export interface LoginAccessState {
  exists: boolean;
  loginStatus: string | null;
  isDisabled: boolean;
}

/**
 * What the per-request auth check needs about a login: does the row still exist, is it active, and
 * has the company's admin disabled its contact. Disable lives on the contact (per company) rather
 * than on client_users.status, so it does not cut off the same person's other organisations and
 * is not overwritten by company-level activate / bulk status writes.
 */
export async function getLoginAccessState(
  q: Queryable,
  clientUserId: string,
  clientId: string
): Promise<LoginAccessState> {
  const result = await q.query(
    `SELECT cu.status AS login_status,
            EXISTS (
              SELECT 1 FROM client_contacts cc
              WHERE cc.client_user_id = cu.id AND cc.client_id = $2 AND cc.disabled_at IS NOT NULL
            ) AS is_disabled
     FROM client_users cu
     WHERE cu.id = $1`,
    [clientUserId, clientId]
  );

  const row = result.rows[0];
  if (!row) return { exists: false, loginStatus: null, isDisabled: false };
  return { exists: true, loginStatus: row.login_status, isDisabled: row.is_disabled === true };
}

export interface ProjectAccessInput {
  projectId: string;
  level: ClientPermissionLevel;
}

/**
 * Replaces a contact's per-project access. Every project must belong to the contact's company and
 * team, and every level must be valid. Levels are stored and displayed only; the client-facing API
 * still scopes by company.
 */
export async function replaceProjectAccess(
  q: Queryable,
  input: { contactId: string; clientId: string; teamId: string; access: ProjectAccessInput[] }
): Promise<ProjectAccessInput[]> {
  const byProject = new Map<string, ClientPermissionLevel>();
  for (const item of input.access) {
    if (!isClientPermissionLevel(item.level)) {
      throw new ContactServiceError("INVALID_LEVEL", "Invalid permission level");
    }
    byProject.set(item.projectId, item.level);
  }

  const projectIds = Array.from(byProject.keys());

  if (projectIds.length > 0) {
    const valid = await q.query(
      `SELECT id FROM projects WHERE id = ANY($1::uuid[]) AND client_id = $2 AND team_id = $3`,
      [projectIds, input.clientId, input.teamId]
    );
    if (valid.rows.length !== projectIds.length) {
      throw new ContactServiceError(
        "INVALID_PROJECT",
        "One or more projects do not belong to this company"
      );
    }
  }

  await q.query(`DELETE FROM client_contact_project_access WHERE client_contact_id = $1`, [
    input.contactId,
  ]);

  if (projectIds.length > 0) {
    await q.query(
      `INSERT INTO client_contact_project_access (client_contact_id, project_id, permission_level)
       SELECT $1, x.project_id, x.level
       FROM unnest($2::uuid[], $3::text[]) AS x(project_id, level)`,
      [input.contactId, projectIds, projectIds.map((id) => byProject.get(id))]
    );
  }

  return projectIds.map((projectId) => ({ projectId, level: byProject.get(projectId)! }));
}

export type InviteDelivery = "email" | "link";

export interface ContactInviteResult {
  contactId: string;
  email: string;
  delivery: InviteDelivery;
  /** Set when delivery is "link" (the operator copies it), or when an email could not be sent. */
  link: string | null;
  expiresAt: string;
  emailSent: boolean;
}

/**
 * Sends a contact its first invitation, or resends it. There is at most one pending invitation per
 * contact: a resend rotates its token and restarts the 7-day window in place, so the status clock
 * (`expires_at`) always reflects the latest send and the previous link stops working.
 */
export async function inviteContact(input: {
  teamId: string;
  contactId: string;
  invitedBy: string;
  delivery: InviteDelivery;
}): Promise<ContactInviteResult> {
  const contactResult = await db.query(
    `SELECT cc.id, cc.client_id, cc.name, cc.email, cc.disabled_at,
            c.name AS client_name, c.company_name, c.phone AS client_phone,
            EXISTS (SELECT 1 FROM client_users cu WHERE cu.id = cc.client_user_id AND cu.status = 'active') AS is_active,
            t.name AS team_name
     FROM client_contacts cc
     JOIN clients c ON c.id = cc.client_id
     LEFT JOIN teams t ON t.id = cc.team_id
     WHERE cc.id = $1 AND cc.team_id = $2`,
    [input.contactId, input.teamId]
  );

  const contact = contactResult.rows[0];
  if (!contact) throw new ContactServiceError("NOT_FOUND", "Company user not found");
  if (contact.disabled_at) {
    throw new ContactServiceError("DISABLED", "This user is disabled. Enable them before inviting.");
  }
  if (contact.is_active) {
    throw new ContactServiceError("ALREADY_ACTIVE", "This user already has portal access");
  }
  if (!isValidContactEmail(contact.email)) {
    throw new ContactServiceError("NO_EMAIL", "This user has no valid email address");
  }

  const token = generatePrefixedToken("wli", 10);

  const refreshed = await db.query(
    `UPDATE client_invitations
     SET token = $1,
         name = $2,
         email = $3,
         invited_by = $4,
         status = 'pending',
         created_at = NOW(),
         expires_at = NOW() + INTERVAL '${INVITATION_TTL_INTERVAL}',
         updated_at = NOW()
     WHERE id = (
       SELECT id FROM client_invitations
       WHERE client_contact_id = $5 AND status = 'pending'
       ORDER BY created_at DESC
       LIMIT 1
     )
     RETURNING expires_at`,
    [token, contact.name, contact.email, input.invitedBy, input.contactId]
  );

  let expiresAt: string | undefined = refreshed.rows[0]?.expires_at;

  if (!expiresAt) {
    const inserted = await db.query(
      `INSERT INTO client_invitations (
         client_id, email, name, role, invited_by, token, status, created_at, expires_at, client_contact_id
       ) VALUES ($1, $2, $3, 'member', $4, $5, 'pending', NOW(), NOW() + INTERVAL '${INVITATION_TTL_INTERVAL}', $6)
       RETURNING expires_at`,
      [contact.client_id, contact.email, contact.name, input.invitedBy, token, input.contactId]
    );
    expiresAt = inserted.rows[0].expires_at;
  }

  const link = `${getClientPortalBaseUrl()}/invite?token=${token}`;

  if (input.delivery === "link") {
    return {
      contactId: contact.id,
      email: contact.email,
      delivery: "link",
      link,
      expiresAt: expiresAt as string,
      emailSent: false,
    };
  }

  const emailSent = await sendContactInvitationEmail({
    to: contact.email,
    contactName: contact.name,
    clientName: contact.client_name,
    companyName: contact.company_name,
    phone: contact.client_phone,
    teamName: contact.team_name || "Worklenz Team",
    link,
  });

  return {
    contactId: contact.id,
    email: contact.email,
    delivery: "email",
    // When the email could not be sent, hand the link back so the operator can share it manually.
    link: emailSent ? null : link,
    expiresAt: expiresAt as string,
    emailSent,
  };
}

async function sendContactInvitationEmail(input: {
  to: string;
  contactName: string;
  clientName: string;
  companyName: string | null;
  phone: string | null;
  teamName: string;
  link: string;
}): Promise<boolean> {
  try {
    const template = FileConstants.getEmailTemplate(IEmailTemplateType.ClientInvitation) as string;
    if (!template) throw new Error("Client invitation email template not found");

    const html = template
      .replace(/\[VAR_CLIENT_NAME\]/g, input.contactName || "Client")
      .replace(/\[VAR_CLIENT_EMAIL\]/g, input.to)
      .replace(/\[VAR_COMPANY_NAME\]/g, input.companyName || input.clientName || "N/A")
      .replace(/\[VAR_CLIENT_PHONE\]/g, input.phone || "N/A")
      .replace(/\[VAR_TEAM_NAME\]/g, input.teamName)
      .replace(/\[VAR_PORTAL_LINK\]/g, input.link);

    const messageId = await sendEmail({
      to: [input.to],
      subject: `Welcome to your Client Portal - ${input.teamName}`,
      html,
    });
    return messageId !== null;
  } catch (error) {
    console.error("Error sending company user invitation email:", error);
    return false;
  }
}
