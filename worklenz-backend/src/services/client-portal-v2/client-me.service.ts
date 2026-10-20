import { clientRoleCan } from "../../shared/client-portal-permissions";
import { ClientNotificationEvent, getPortalSettingsV2 } from "./settings.service";
import { badRequest } from "./errors";
import { ClientSubject } from "./subject";
import { Queryable } from "./types";

/**
 * The signed-in client user's own account: who they are, what their role lets them do, the operator's
 * switches that decide what the app shows, and their personal preferences (profile, language, time
 * zone, email notifications). Everything is read from the database per request, like the subject.
 */

/** The seven event types a client is notified about, as the client app names them. */
export type ClientNotificationType =
  | "Approval"
  | "Comment"
  | "File"
  | "Milestone"
  | "Project"
  | "Change Request"
  | "Access";

/** Client notification type -> the operator's per-event email switch. One mapping, used everywhere. */
export const NOTIFICATION_EVENT_BY_TYPE: Record<ClientNotificationType, ClientNotificationEvent> = {
  Approval: "approval_request",
  Comment: "comment_or_reply",
  File: "file_shared",
  Milestone: "milestone_change",
  Project: "project_update",
  "Change Request": "change_request_update",
  Access: "access_changes",
};

export const NOTIFICATION_TYPES = Object.keys(NOTIFICATION_EVENT_BY_TYPE) as ClientNotificationType[];

/** The portal's shipped locales (the client app's `src/locales` folders). Mirrors the DB CHECK. */
export const CLIENT_LANGUAGES = ["en", "es", "pt", "al", "de", "zh", "pl", "fr"] as const;

export interface ClientMeDto {
  id: string;
  name: string;
  email: string;
  jobTitle: string;
  role: ClientSubject["role"];
  organizationName: string;
  operatorName: string;
  language: string;
  /** IANA name from the timezones table; null means "use the browser's". */
  timezone: string | null;
  capabilities: { comment: boolean; upload: boolean; submitChangeRequest: boolean; approve: boolean; manageUsers: boolean };
  invoicesVisible: boolean;
  adminsCanInvite: boolean;
  adminsCanRemove: boolean;
  /** Event types the operator turned email on for; only those offer an email checkbox. */
  emailedEventTypes: ClientNotificationType[];
}

export async function getClientMe(q: Queryable, subject: ClientSubject): Promise<ClientMeDto> {
  const [person, settings] = await Promise.all([
    q.query(
      `SELECT cc.id, cc.name, cc.email, cc.job_title, cc.role, cc.language, cc.timezone,
              COALESCE(NULLIF(TRIM(c.company_name), ''), c.name) AS organization_name,
              COALESCE(
                (SELECT NULLIF(BTRIM(cps.portal_title), '')
                   FROM client_portal_settings cps
                  WHERE cps.organization_team_id = cc.team_id
                  LIMIT 1),
                t.name
              ) AS operator_name
         FROM client_contacts cc
         JOIN clients c ON c.id = cc.client_id
         LEFT JOIN teams t ON t.id = cc.team_id
        WHERE cc.id = $1 AND cc.team_id = $2`,
      [subject.contactId, subject.teamId]
    ),
    getPortalSettingsV2(q, subject.teamId),
  ]);
  const row = person.rows[0];
  const emailed = NOTIFICATION_TYPES.filter(type => settings.client_email_events[NOTIFICATION_EVENT_BY_TYPE[type]]);

  return {
    id: subject.contactId,
    name: row?.name ?? subject.name,
    email: row?.email ?? subject.email,
    jobTitle: row?.job_title ?? "",
    role: subject.role,
    organizationName: row?.organization_name ?? "",
    operatorName: row?.operator_name ?? "",
    language: row?.language ?? "en",
    timezone: row?.timezone ?? null,
    capabilities: {
      comment: clientRoleCan(subject.role, "comment"),
      upload: clientRoleCan(subject.role, "upload"),
      submitChangeRequest: clientRoleCan(subject.role, "submit_change_request"),
      approve: clientRoleCan(subject.role, "approve"),
      manageUsers: clientRoleCan(subject.role, "manage_users"),
    },
    invoicesVisible: settings.show_invoices,
    adminsCanInvite: settings.admins_can_invite_users,
    adminsCanRemove: settings.admins_can_remove_users,
    emailedEventTypes: emailed,
  };
}

export interface UpdateClientMeInput {
  name?: unknown;
  job_title?: unknown;
  language?: unknown;
  timezone?: unknown;
}

/**
 * Updates the person's own profile and preferences. Only these four fields are accepted: the email
 * is their sign-in address and the role is the operator's to change. Nothing here is audited: none of
 * it is a permission or access change.
 */
export async function updateClientMe(q: Queryable, subject: ClientSubject, input: UpdateClientMeInput): Promise<ClientMeDto> {
  const sets: string[] = [];
  const values: unknown[] = [subject.contactId, subject.teamId];
  const set = (column: string, value: unknown) => sets.push(`${column} = $${values.push(value)}`);

  if (input.name !== undefined) {
    const name = typeof input.name === "string" ? input.name.trim() : "";
    if (!name) throw badRequest("Name is required", "MISSING_FIELDS");
    if (name.length > 255) throw badRequest("A name can be at most 255 characters");
    set("name", name);
  }
  if (input.job_title !== undefined) {
    const title = input.job_title === null ? "" : typeof input.job_title === "string" ? input.job_title.trim() : null;
    if (title === null) throw badRequest("Job title must be text");
    if (title.length > 100) throw badRequest("A job title can be at most 100 characters");
    set("job_title", title === "" ? null : title);
  }
  if (input.language !== undefined) {
    if (typeof input.language !== "string" || !(CLIENT_LANGUAGES as readonly string[]).includes(input.language)) {
      throw badRequest("Choose one of the available languages", "INVALID_LANGUAGE");
    }
    set("language", input.language);
  }
  if (input.timezone !== undefined) {
    if (input.timezone === null || input.timezone === "") {
      set("timezone", null);
    } else {
      if (typeof input.timezone !== "string") throw badRequest("Choose a time zone from the list", "INVALID_TIMEZONE");
      const known = await q.query(`SELECT 1 FROM timezones WHERE name = $1 LIMIT 1`, [input.timezone]);
      if (known.rows.length === 0) throw badRequest("Choose a time zone from the list", "INVALID_TIMEZONE");
      set("timezone", input.timezone);
    }
  }

  if (sets.length > 0) {
    await q.query(
      `UPDATE client_contacts SET ${sets.join(", ")}, updated_at = NOW() WHERE id = $1 AND team_id = $2`,
      values
    );
  }
  return getClientMe(q, subject);
}

/** The time zones to choose from: the same list the main app offers. */
export async function listTimezones(q: Queryable): Promise<Array<{ id: string; name: string; abbrev: string }>> {
  const result = await q.query(`SELECT id, name, abbrev FROM timezones ORDER BY name`);
  return result.rows.map(row => ({ id: row.id, name: row.name, abbrev: row.abbrev }));
}

export type ClientNotificationPrefs = Record<ClientNotificationType, boolean>;

/** Email per event type. A type with no stored choice defaults to on; in-app is always on and not stored. */
export async function getNotificationPrefs(q: Queryable, subject: ClientSubject): Promise<ClientNotificationPrefs> {
  const result = await q.query(
    `SELECT event_type, email FROM client_contact_notification_prefs WHERE contact_id = $1`,
    [subject.contactId]
  );
  const stored = new Map<string, boolean>(result.rows.map(row => [row.event_type as string, row.email === true]));
  return Object.fromEntries(
    NOTIFICATION_TYPES.map(type => [type, stored.get(NOTIFICATION_EVENT_BY_TYPE[type]) ?? true])
  ) as ClientNotificationPrefs;
}

export async function updateNotificationPrefs(
  q: Queryable,
  subject: ClientSubject,
  patch: Record<string, unknown>
): Promise<ClientNotificationPrefs> {
  for (const type of NOTIFICATION_TYPES) {
    const value = patch[type];
    if (value === undefined) continue;
    if (typeof value !== "boolean") throw badRequest(`${type} must be true or false`);
    await q.query(
      `INSERT INTO client_contact_notification_prefs (contact_id, event_type, email)
       VALUES ($1, $2, $3)
       ON CONFLICT (contact_id, event_type) DO UPDATE SET email = EXCLUDED.email, updated_at = NOW()`,
      [subject.contactId, NOTIFICATION_EVENT_BY_TYPE[type], value]
    );
  }
  return getNotificationPrefs(q, subject);
}
