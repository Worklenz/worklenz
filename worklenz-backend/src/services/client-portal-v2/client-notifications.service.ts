import { ClientTargetDto } from "./client-read.service";
import { ClientNotificationType, NOTIFICATION_EVENT_BY_TYPE, getNotificationPrefs } from "./client-me.service";
import { notFound } from "./errors";
import { fileClientVisibleSql, getSubjectProjectIds, milestoneClientVisibleSql } from "./scope";
import { getPortalSettingsV2 } from "./settings.service";
import { ClientSubject } from "./subject";
import { Queryable } from "./types";

/**
 * Notifications as a client user sees them.
 *
 * A `client_portal_notifications` row is written once per organization event. Who it reaches is decided
 * HERE, on every read, never at write time, so the list can't outlive a change of access:
 *   - the notification's project must be one the person can still open (assigned, portal on);
 *   - a notification addressed to named people (an approval's approvers, a change request's requester)
 *     reaches only them;
 *   - what it points at (a file, milestone or discussion) must still be Client Visible;
 *   - read state is the person's own (client_portal_notification_reads), not the organization's.
 * Old v1 notification types (request updates, invoices, chat) are not v2 events and are not returned.
 */

/** Stored `type` -> the type the client app shows. */
const TYPE_LABEL: Record<string, ClientNotificationType> = {
  approval: "Approval",
  change_request: "Change Request",
  discussion: "Comment",
  file: "File",
  milestone: "Milestone",
  project_update: "Project",
  access: "Access",
};

export interface ClientNotificationDto {
  id: string;
  type: ClientNotificationType;
  title: string;
  body: string;
  at: string;
  unread: boolean;
  /** The operator emails this event type AND this person has not switched it off. */
  emailed: boolean;
  target: ClientTargetDto;
}

export interface ClientNotificationsDto {
  items: ClientNotificationDto[];
  unread_count: number;
}

const LIST_LIMIT = 100;

// Parameters: $1 client id, $2 team id, $3 project ids, $4 contact id.
const VISIBLE_NOTIFICATIONS_SQL = `
  FROM client_portal_notifications n
 WHERE n.client_id = $1
   AND n.organization_team_id = $2
   AND n.type = ANY($5::text[])
   AND (n.metadata ->> 'project_id') IS NOT NULL
   AND (n.metadata ->> 'project_id')::uuid = ANY($3::uuid[])
   AND (
        n.metadata -> 'contact_ids' IS NULL
     OR jsonb_typeof(n.metadata -> 'contact_ids') = 'null'
     OR n.metadata -> 'contact_ids' @> to_jsonb(($4::uuid)::text)
   )
   AND CASE n.type
         WHEN 'file' THEN EXISTS (
           SELECT 1 FROM project_files pf WHERE pf.id = n.reference_id AND ${fileClientVisibleSql("pf")})
         WHEN 'milestone' THEN EXISTS (
           SELECT 1 FROM client_portal_milestones m WHERE m.id = n.reference_id AND ${milestoneClientVisibleSql("m")})
         WHEN 'discussion' THEN EXISTS (
           SELECT 1 FROM client_portal_threads th
             LEFT JOIN client_portal_task_settings cts ON cts.task_id = th.context_task_id
             LEFT JOIN project_files tf ON tf.id = th.context_file_id
             LEFT JOIN client_portal_approvals ap ON ap.id = th.context_approval_id
            WHERE th.id = n.reference_id
              AND CASE th.context_type
                    WHEN 'task' THEN COALESCE(cts.visibility = 'client', FALSE)
                    WHEN 'file' THEN COALESCE(tf.portal_visibility = 'client' AND tf.status = 'active', FALSE)
                    WHEN 'approval' THEN COALESCE(ap.status <> 'draft', FALSE)
                    ELSE TRUE
                  END)
         WHEN 'approval' THEN EXISTS (
           SELECT 1 FROM client_portal_approvals ap WHERE ap.id = n.reference_id AND ap.status <> 'draft')
         ELSE TRUE
       END
`;

const V2_TYPES = Object.keys(TYPE_LABEL);

const params = (subject: ClientSubject, projectIds: string[]) => [
  subject.clientId,
  subject.teamId,
  projectIds,
  subject.contactId,
  V2_TYPES,
];

const toTarget = (row: any): ClientTargetDto => {
  const projectId = row.project_id as string;
  switch (row.type) {
    case "approval":
      return { page: "approval", id: row.reference_id };
    case "change_request":
      return { page: "change_request", id: row.reference_id };
    case "discussion":
      return { page: "thread", projectId, id: row.reference_id };
    case "file":
      return { page: "file", projectId, id: row.reference_id };
    case "milestone":
      return { page: "milestone", projectId, id: row.reference_id };
    default:
      return { page: "project", projectId };
  }
};

export async function listClientNotifications(q: Queryable, subject: ClientSubject): Promise<ClientNotificationsDto> {
  const projectIds = await getSubjectProjectIds(q, subject);
  if (projectIds.length === 0) return { items: [], unread_count: 0 };

  const [rows, settings, prefs] = await Promise.all([
    q.query(
      `SELECT n.id, n.type, n.reference_id, n.title, n.message, n.created_at,
              (n.metadata ->> 'project_id') AS project_id,
              EXISTS (SELECT 1 FROM client_portal_notification_reads r
                       WHERE r.notification_id = n.id AND r.contact_id = $4::uuid) AS is_read
         ${VISIBLE_NOTIFICATIONS_SQL}
        ORDER BY n.created_at DESC
        LIMIT ${LIST_LIMIT}`,
      params(subject, projectIds)
    ),
    getPortalSettingsV2(q, subject.teamId),
    getNotificationPrefs(q, subject),
  ]);

  const items: ClientNotificationDto[] = rows.rows.map(row => {
    const type = TYPE_LABEL[row.type];
    return {
      id: row.id,
      type,
      title: row.title,
      body: row.message ?? "",
      at: row.created_at,
      unread: row.is_read !== true,
      emailed: settings.client_email_events[NOTIFICATION_EVENT_BY_TYPE[type]] === true && prefs[type] === true,
      target: toTarget(row),
    };
  });

  // The badge counts every unread one, not just the page of 100 above.
  const unread = await q.query(
    `SELECT COUNT(*)::int AS n ${VISIBLE_NOTIFICATIONS_SQL}
        AND NOT EXISTS (SELECT 1 FROM client_portal_notification_reads r
                         WHERE r.notification_id = n.id AND r.contact_id = $4::uuid)`,
    params(subject, projectIds)
  );
  return { items, unread_count: unread.rows[0]?.n ?? items.filter(item => item.unread).length };
}

/** Marks one notification read or unread for this person. A notification they cannot see is a 404. */
export async function setClientNotificationRead(
  q: Queryable,
  subject: ClientSubject,
  notificationId: string,
  read: boolean
): Promise<void> {
  const projectIds = await getSubjectProjectIds(q, subject);
  if (projectIds.length === 0) throw notFound("Notification");

  const visible = await q.query(
    `SELECT n.id ${VISIBLE_NOTIFICATIONS_SQL} AND n.id = $6::uuid`,
    [...params(subject, projectIds), notificationId]
  );
  if (visible.rows.length === 0) throw notFound("Notification");

  if (read) {
    await q.query(
      `INSERT INTO client_portal_notification_reads (notification_id, contact_id) VALUES ($1, $2)
       ON CONFLICT (notification_id, contact_id) DO NOTHING`,
      [notificationId, subject.contactId]
    );
  } else {
    await q.query(`DELETE FROM client_portal_notification_reads WHERE notification_id = $1 AND contact_id = $2`, [
      notificationId,
      subject.contactId,
    ]);
  }
}

/** Marks everything this person can currently see as read. Never touches anyone else's state. */
export async function markAllClientNotificationsRead(q: Queryable, subject: ClientSubject): Promise<void> {
  const projectIds = await getSubjectProjectIds(q, subject);
  if (projectIds.length === 0) return;

  await q.query(
    `INSERT INTO client_portal_notification_reads (notification_id, contact_id)
     SELECT n.id, $4::uuid ${VISIBLE_NOTIFICATIONS_SQL}
     ON CONFLICT (notification_id, contact_id) DO NOTHING`,
    params(subject, projectIds)
  );
}
