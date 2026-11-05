import db from "../../config/db";
import { getClientPortalBaseUrl } from "../../cron_jobs/helpers";
import { sendEmail } from "../../shared/email";
import { IO } from "../../shared/io";
import { htmlToPlainText, log_error, sanitizePlainText } from "../../shared/utils";
import {
  CLIENT_PORTAL_SOCKET,
  ClientPortalDataUpdatedPayload,
  clientPortalClientRoomName,
  clientPortalContactRoomName,
  clientPortalTeamRoomName,
} from "../../socket.io/client-portal-room";
import { NotificationsService } from "../notifications/notifications.service";
import {
  ClientNotificationEvent,
  TeamNotificationEvent,
  getPortalSettingsV2,
} from "./settings.service";
import { CONTACT_CAN_OPEN_PROJECT_SQL } from "./scope";
import { Queryable } from "./types";

/**
 * Notifications for Client Portal v2.
 *
 * Staff side: one notification per meaningful event, fanned out to every workspace Owner and Admin
 * (the only people who can use the portal), each with their own read state, written to
 * user_notifications with a deep link to the exact item and pushed over the existing socket.
 * In-app is always on; email is per event in Portal Settings > Notifications.
 *
 * Client side: a client_portal_notifications row (in-app, always on) and, per event, an email to
 * the active client users on the project. Client notifications never contain internal-only text:
 * callers pass only client-visible titles and bodies.
 *
 * Both paths also emit `client_portal:data_updated` so open Admin / Client Portal UIs can invalidate
 * their caches. The shared client room receives an identifier-free event. projectId and referenceId
 * go only to the contact rooms of people allowed to see that item.
 */

export type StaffNotificationKind =
  | "Comment"
  | "Approval"
  | "Change Request"
  | "File"
  | "Access"
  | "Project";

const STAFF_KIND_TO_TYPE: Record<StaffNotificationKind, string> = {
  Comment: "discussion",
  Approval: "approval",
  "Change Request": "change_request",
  File: "file",
  Access: "access",
  Project: "project_update",
};

export interface PortalDataUpdatedOptions {
  staffSocketIds?: Array<string | null | undefined>;
  /**
   * Contacts who may receive projectId and referenceId. When set (including an empty list), those
   * identifiers are delivered only to this set, still limited to contacts who can open the project.
   * When omitted, a change request goes to its viewers (requester and client admins); any other
   * event with a project goes to contacts who can open that project. The shared client room never
   * receives the identifiers.
   */
  onlyContactIds?: string[];
}

/** Shared client room hears that something changed, without learning which project or item. */
const identifierFreePayload = (payload: ClientPortalDataUpdatedPayload): ClientPortalDataUpdatedPayload => ({
  teamId: payload.teamId,
  clientId: payload.clientId ?? null,
  type: payload.type,
  source: payload.source,
  projectId: null,
  referenceId: null,
});

const ACTIVE_CONTACT_SQL = `
  cc.client_id = $1
  AND cc.team_id = $2
  AND cc.disabled_at IS NULL
  AND cc.activated_at IS NOT NULL
  AND cu.status = 'active'
  AND cu.deleted_at IS NULL
  AND c.deleted_at IS NULL
  AND c.status <> 'inactive'
  AND ($3::uuid IS NULL OR ${CONTACT_CAN_OPEN_PROJECT_SQL("cc.id", "$3")})
`;

/**
 * Active contacts allowed to learn a portal item's identifiers. `onlyContactIds` null means every
 * contact who passes the project check; an array (including empty) restricts to that set.
 */
async function listIdentifierAudience(input: {
  clientId: string;
  teamId: string;
  projectId: string | null;
  onlyContactIds: string[] | null;
  changeRequestId?: string | null;
}): Promise<string[]> {
  const changeRequestOnly = Boolean(input.changeRequestId);
  const result = await db.query(
    `SELECT DISTINCT cc.id
       FROM client_contacts cc
       JOIN client_users cu ON cu.id = cc.client_user_id
       JOIN clients c ON c.id = cc.client_id
      WHERE ${ACTIVE_CONTACT_SQL}
        AND ($4::uuid[] IS NULL OR cc.id = ANY($4::uuid[]))
        AND (
          $5::uuid IS NULL
          OR cc.role = 'admin'
          OR cc.id = (
            SELECT r.requester_contact_id
              FROM client_portal_change_requests r
             WHERE r.id = $5
               AND r.client_id = $1
               AND r.organization_team_id = $2
             LIMIT 1
          )
        )`,
    [
      input.clientId,
      input.teamId,
      input.projectId,
      input.onlyContactIds,
      changeRequestOnly ? input.changeRequestId : null,
    ]
  );
  return result.rows.map(row => row.id as string).filter((id): id is string => Boolean(id));
}

async function deliverIdentifiersToContacts(
  payload: ClientPortalDataUpdatedPayload,
  onlyContactIds: string[] | undefined
): Promise<void> {
  const clientId = payload.clientId;
  if (!clientId) return;

  const explicitAudience = onlyContactIds !== undefined;
  const privateChangeRequest = !explicitAudience && payload.type === "change_request" && Boolean(payload.referenceId);
  if (!explicitAudience && !privateChangeRequest && !payload.projectId) return;

  const contactIds = await listIdentifierAudience({
    clientId,
    teamId: payload.teamId,
    projectId: payload.projectId ?? null,
    onlyContactIds: explicitAudience ? onlyContactIds : null,
    changeRequestId: privateChangeRequest ? payload.referenceId : null,
  });

  for (const contactId of contactIds) {
    IO.emitToRoom(
      clientPortalContactRoomName(payload.teamId, clientId, contactId),
      CLIENT_PORTAL_SOCKET.DATA_UPDATED,
      payload
    );
  }
}

/** Fan-out for open Admin / Client Portal UIs (no DB write). Safe to call after commit. */
export async function emitPortalDataUpdated(
  payload: ClientPortalDataUpdatedPayload,
  options?: PortalDataUpdatedOptions
): Promise<void> {
  try {
    IO.emitToRoom(clientPortalTeamRoomName(payload.teamId), CLIENT_PORTAL_SOCKET.DATA_UPDATED, payload);
    // Direct emit to staff sockets (same path as the notification toast). Room join is best-effort;
    // without this, an admin who never joined the portal room sees the bell but not the list refresh.
    // Staff are workspace owners/admins, so they still receive item identifiers.
    for (const socketId of options?.staffSocketIds ?? []) {
      if (socketId) {
        IO.emit(CLIENT_PORTAL_SOCKET.DATA_UPDATED, socketId, payload);
      }
    }
    if (payload.clientId) {
      // Everyone in the org may refresh lists they are allowed to see. Item identifiers stay on
      // the contact rooms of people who can open that project (and, when set, onlyContactIds).
      IO.emitToRoom(
        clientPortalClientRoomName(payload.teamId, payload.clientId),
        CLIENT_PORTAL_SOCKET.DATA_UPDATED,
        identifierFreePayload(payload)
      );
      await deliverIdentifiersToContacts(payload, options?.onlyContactIds);
    }
  } catch (error) {
    log_error(error);
  }
}

export interface StaffNotificationInput {
  teamId: string;
  kind: StaffNotificationKind;
  title: string;
  body: string;
  /** In-app deep link, e.g. /worklenz/client-portal/approvals/<id>. */
  url: string;
  projectId?: string | null;
  /** When set, also fans out to the client socket room for live portal sync. */
  clientId?: string | null;
  referenceId?: string | null;
  /** When set, the team's email toggle for this event decides whether an email also goes out. */
  emailEvent?: TeamNotificationEvent;
  /** A published project update is created already read so it does not raise the badge. */
  alreadyRead?: boolean;
}

interface StaffRecipient {
  user_id: string;
  name: string;
  email: string;
  socket_id: string | null;
  team_name: string;
}

const NOTIFICATION_TYPE_KEY: Record<StaffNotificationKind, string> = {
  Comment: "CLIENT_PORTAL_COMMENT",
  Approval: "CLIENT_PORTAL_APPROVAL",
  "Change Request": "CLIENT_PORTAL_CHANGE_REQUEST",
  File: "CLIENT_PORTAL_FILE",
  Access: "CLIENT_PORTAL_ACCESS",
  Project: "CLIENT_PORTAL_PROJECT",
};

/** Owners and Admins of the workspace: the people the client activity bell is for. */
export async function getStaffRecipients(q: Queryable, teamId: string): Promise<StaffRecipient[]> {
  const result = await q.query(
    `SELECT u.id AS user_id, u.name, u.email, u.socket_id, t.name AS team_name
       FROM team_members tm
       JOIN users u ON u.id = tm.user_id
       JOIN roles r ON r.id = tm.role_id
       JOIN teams t ON t.id = tm.team_id
      WHERE tm.team_id = $1
        AND tm.active IS TRUE
        AND (r.admin_role IS TRUE OR r.owner IS TRUE)`,
    [teamId]
  );
  return result.rows as StaffRecipient[];
}

const escapeHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const buildEmailHtml = (title: string, body: string, link: string) =>
  `<div style="font-family:Arial,sans-serif;font-size:14px;color:#222">
     <p style="font-weight:bold;margin:0 0 8px">${escapeHtml(title)}</p>
     <p style="margin:0 0 16px">${escapeHtml(body)}</p>
     <p style="margin:0"><a href="${escapeHtml(link)}">Open in Worklenz</a></p>
   </div>`;

/**
 * Notifies the workspace's Owners and Admins. Never throws: a notification failure must not undo
 * the action that caused it.
 */
export async function notifyStaff(input: StaffNotificationInput): Promise<void> {
  try {
    const recipients = await getStaffRecipients(db, input.teamId);
    if (recipients.length === 0) return;

    // Bodies may be rich-text HTML from portal editors; notifications and emails are plain text.
    const plainBody = htmlToPlainText(input.body);
    const message = sanitizePlainText(`${input.title}: ${plainBody}`.slice(0, 500));
    const typeKey = NOTIFICATION_TYPE_KEY[input.kind];

    for (const recipient of recipients) {
      if (input.alreadyRead) {
        // Created already read, so it appears in the bell without raising the unread badge.
        await db.query(
          `INSERT INTO user_notifications (message, user_id, team_id, project_id, notification_type_key, url, read)
           VALUES ($1, $2, $3, $4, $5, $6, TRUE)`,
          [message, recipient.user_id, input.teamId, input.projectId ?? null, typeKey, input.url]
        );
        continue;
      }

      await NotificationsService.createNotification({
        userId: recipient.user_id,
        teamId: input.teamId,
        socketId: recipient.socket_id ?? undefined,
        message,
        notificationTypeKey: typeKey,
        taskId: null,
        projectId: input.projectId ?? null,
        url: input.url,
      });
    }

    if (input.emailEvent && !input.alreadyRead) {
      const settings = await getPortalSettingsV2(db, input.teamId);
      if (settings.team_email_events[input.emailEvent]) {
        const appUrl = process.env.FRONTEND_URL || "";
        const link = `${appUrl}${input.url}`;
        const html = buildEmailHtml(input.title, plainBody, link);
        await Promise.all(
          recipients
            .filter(recipient => recipient.email)
            .map(recipient =>
              sendEmail({ to: [recipient.email], subject: input.title, html }).catch(log_error)
            )
        );
      }
    }

    // Live sync for open Admin Client Portal pages. Clients in the shared room get an
    // identifier-free refresh; item ids go only to authorized contact rooms.
    await emitPortalDataUpdated(
      {
        teamId: input.teamId,
        clientId: input.clientId ?? null,
        projectId: input.projectId ?? null,
        type: STAFF_KIND_TO_TYPE[input.kind],
        referenceId: input.referenceId ?? null,
        source: "client",
      },
      { staffSocketIds: recipients.map(recipient => recipient.socket_id) }
    );
  } catch (error) {
    log_error(error);
  }
}

/**
 * In-app notification to project members mentioned in an internal discussion comment, deep-linked to
 * the thread. Never throws: a notification failure must not undo the comment.
 */
export async function notifyMentionedMembers(input: {
  teamId: string;
  projectId: string;
  threadId: string;
  authorName: string;
  projectName: string;
  text: string;
  userIds: string[];
}): Promise<void> {
  try {
    if (input.userIds.length === 0) return;
    const users = await db.query(`SELECT id, socket_id FROM users WHERE id = ANY($1::uuid[])`, [input.userIds]);
    const preview = input.text.length > 140 ? `${input.text.slice(0, 137)}...` : input.text;
    const message = sanitizePlainText(
      `${input.authorName} mentioned you in a discussion on ${input.projectName}: ${preview}`.slice(0, 500)
    );

    for (const user of users.rows) {
      await NotificationsService.createNotification({
        userId: user.id,
        teamId: input.teamId,
        socketId: user.socket_id ?? undefined,
        message,
        notificationTypeKey: "CLIENT_PORTAL_COMMENT",
        taskId: null,
        projectId: input.projectId,
        url: `/worklenz/client-portal/discussions/${input.threadId}`,
      });
    }
  } catch (error) {
    log_error(error);
  }
}

export interface ClientNotificationInput {
  teamId: string;
  clientId: string;
  projectId?: string | null;
  /** Stored as the notification type (approval, change_request, discussion, milestone, project_update, file, access). */
  type: string;
  /** Client-visible title and body only. */
  title: string;
  message: string;
  referenceId?: string | null;
  referenceNumber?: string | null;
  /** When set, the team's per-event email toggle decides whether active client users are also emailed. */
  emailEvent?: ClientNotificationEvent;
  /** Restricts the email (and the in-app audience) to specific client users, e.g. the named approver. */
  onlyContactIds?: string[];
  /** Path inside the client portal the notification opens. */
  portalPath?: string;
}

/**
 * Creates the in-app notification for a client organization and emails the active client users on
 * the project when the event is switched on. Never throws.
 */
export async function notifyClientUsers(input: ClientNotificationInput): Promise<void> {
  try {
    const plainMessage = htmlToPlainText(input.message);
    await db.query(
      `INSERT INTO client_portal_notifications
         (client_id, organization_team_id, type, reference_id, reference_number, title, message, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)`,
      [
        input.clientId,
        input.teamId,
        input.type,
        input.referenceId ?? null,
        input.referenceNumber ?? null,
        input.title.slice(0, 255),
        plainMessage,
        JSON.stringify({
          project_id: input.projectId ?? null,
          portal_path: input.portalPath ?? null,
          contact_ids: input.onlyContactIds ?? null,
        }),
      ]
    );

    if (input.emailEvent) {
      const settings = await getPortalSettingsV2(db, input.teamId);
      if (settings.client_email_events[input.emailEvent]) {
        const recipients = await db.query(
          `SELECT DISTINCT cc.email
             FROM client_contacts cc
             JOIN client_users cu ON cu.id = cc.client_user_id AND cu.status = 'active'
            WHERE cc.client_id = $1
              AND cc.team_id = $2
              AND cc.disabled_at IS NULL
              AND cc.activated_at IS NOT NULL
              AND ($3::uuid IS NULL OR ${CONTACT_CAN_OPEN_PROJECT_SQL("cc.id", "$3")})
              AND ($4::uuid[] IS NULL OR cc.id = ANY($4::uuid[]))
              -- Email is disabled by default for clients; a client must explicitly enable it in Settings > Notifications.
              AND EXISTS (
                    SELECT 1 FROM client_contact_notification_prefs np
                     WHERE np.contact_id = cc.id AND np.event_type = $5 AND np.email IS TRUE)`,
          [input.clientId, input.teamId, input.projectId ?? null, input.onlyContactIds ?? null, input.emailEvent]
        );

        const link = `${getClientPortalBaseUrl()}${input.portalPath ?? ""}`;
        const html = buildEmailHtml(input.title, plainMessage, link);
        await Promise.all(
          recipients.rows.map(row =>
            sendEmail({ to: [row.email as string], subject: input.title, html }).catch(log_error)
          )
        );
      }
    }

    // Live sync for open client-portal + admin portal pages (direct staff sockets + rooms).
    // Identifiers follow the same audience as the notification: project access, and onlyContactIds
    // when the item is private to named contacts.
    const staff = await getStaffRecipients(db, input.teamId);
    await emitPortalDataUpdated(
      {
        teamId: input.teamId,
        clientId: input.clientId,
        projectId: input.projectId ?? null,
        type: input.type,
        referenceId: input.referenceId ?? null,
        source: "staff",
      },
      {
        staffSocketIds: staff.map(recipient => recipient.socket_id),
        onlyContactIds: input.onlyContactIds,
      }
    );
  } catch (error) {
    log_error(error);
  }
}
