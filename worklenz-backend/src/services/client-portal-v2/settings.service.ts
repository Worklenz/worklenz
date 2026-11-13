import { AuditActor, recordAuditEvent } from "./audit.service";
import { Queryable } from "./types";

/**
 * The Portal Settings sections that v2 rebuilds. Company Details and Branding are unchanged and stay
 * with the v1 settings controller. There is no sign-in configuration: clients always sign in with a
 * one-time code sent to an email address the team (or a Client Admin) has added.
 */
export type ClientNotificationEvent =
  | "approval_request"
  | "comment_or_reply"
  | "file_shared"
  | "milestone_change"
  | "project_update"
  | "change_request_update"
  | "access_changes";

export type TeamNotificationEvent =
  | "client_comment"
  | "approval_decision"
  | "change_request"
  | "client_file_upload";

export const CLIENT_NOTIFICATION_EVENTS: readonly ClientNotificationEvent[] = [
  "approval_request",
  "comment_or_reply",
  "file_shared",
  "milestone_change",
  "project_update",
  "change_request_update",
  "access_changes",
];

export const TEAM_NOTIFICATION_EVENTS: readonly TeamNotificationEvent[] = [
  "client_comment",
  "approval_decision",
  "change_request",
  "client_file_upload",
];

export interface PortalSettingsV2 {
  show_invoices: boolean;
  allow_client_uploads_default: boolean;
  admins_can_invite_users: boolean;
  admins_can_remove_users: boolean;
  client_email_events: Record<ClientNotificationEvent, boolean>;
  team_email_events: Record<TeamNotificationEvent, boolean>;
}

/** Spec defaults, used for a team that has never saved settings. */
export const DEFAULT_PORTAL_SETTINGS_V2: PortalSettingsV2 = {
  show_invoices: false,
  allow_client_uploads_default: true,
  admins_can_invite_users: false,
  admins_can_remove_users: false,
  client_email_events: {
    approval_request: false,
    comment_or_reply: false,
    file_shared: false,
    milestone_change: false,
    project_update: false,
    change_request_update: false,
    access_changes: false,
  },
  team_email_events: {
    client_comment: false,
    approval_decision: false,
    change_request: false,
    client_file_upload: false,
  },
};

export type PortalSettingsV2Patch = {
  show_invoices?: boolean;
  allow_client_uploads_default?: boolean;
  admins_can_invite_users?: boolean;
  admins_can_remove_users?: boolean;
  client_email_events?: Partial<Record<ClientNotificationEvent, boolean>>;
  team_email_events?: Partial<Record<TeamNotificationEvent, boolean>>;
};

const asBool = (value: unknown, fallback: boolean): boolean =>
  typeof value === "boolean" ? value : fallback;

/** Keeps only known keys with boolean values, over the existing value. */
function mergeFlags<K extends string>(
  keys: readonly K[],
  current: Record<K, boolean>,
  patch: unknown
): Record<K, boolean> {
  const source = patch && typeof patch === "object" ? (patch as Record<string, unknown>) : {};
  const next = { ...current };
  for (const key of keys) next[key] = asBool(source[key], current[key]);
  return next;
}

const rowToSettings = (row: any): PortalSettingsV2 => ({
  show_invoices: row.visible_invoices === true,
  allow_client_uploads_default: row.allow_client_uploads_default !== false,
  admins_can_invite_users: row.poc_can_add_users === true,
  admins_can_remove_users: row.poc_can_remove_users === true,
  client_email_events: mergeFlags(
    CLIENT_NOTIFICATION_EVENTS,
    DEFAULT_PORTAL_SETTINGS_V2.client_email_events,
    row.client_email_events
  ),
  team_email_events: mergeFlags(
    TEAM_NOTIFICATION_EVENTS,
    DEFAULT_PORTAL_SETTINGS_V2.team_email_events,
    row.team_email_events
  ),
});

const SETTINGS_COLUMNS = `
  visible_invoices, allow_client_uploads_default, poc_can_add_users, poc_can_remove_users,
  client_email_events, team_email_events
`;

export async function getPortalSettingsV2(q: Queryable, teamId: string): Promise<PortalSettingsV2> {
  const result = await q.query(
    `SELECT ${SETTINGS_COLUMNS} FROM client_portal_settings WHERE organization_team_id = $1 LIMIT 1`,
    [teamId]
  );
  return result.rows[0] ? rowToSettings(result.rows[0]) : structuredCloneSettings(DEFAULT_PORTAL_SETTINGS_V2);
}

const structuredCloneSettings = (settings: PortalSettingsV2): PortalSettingsV2 =>
  JSON.parse(JSON.stringify(settings)) as PortalSettingsV2;

/** Applies a patch over the current settings and validates the result. Pure. */
export function applySettingsPatch(
  current: PortalSettingsV2,
  patch: PortalSettingsV2Patch
): PortalSettingsV2 {
  const next: PortalSettingsV2 = {
    show_invoices: asBool(patch.show_invoices, current.show_invoices),
    allow_client_uploads_default: asBool(
      patch.allow_client_uploads_default,
      current.allow_client_uploads_default
    ),
    admins_can_invite_users: asBool(patch.admins_can_invite_users, current.admins_can_invite_users),
    admins_can_remove_users: asBool(patch.admins_can_remove_users, current.admins_can_remove_users),
    client_email_events: mergeFlags(
      CLIENT_NOTIFICATION_EVENTS,
      current.client_email_events,
      patch.client_email_events
    ),
    team_email_events: mergeFlags(
      TEAM_NOTIFICATION_EVENTS,
      current.team_email_events,
      patch.team_email_events
    ),
  };

  return next;
}

/** The settings whose change is itself an auditable permission change. */
const PERMISSION_SETTINGS: Array<{
  label: string;
  read: (settings: PortalSettingsV2) => boolean;
}> = [
  { label: "Show Invoices in the client portal", read: s => s.show_invoices },
  { label: "Let Client Admins invite users", read: s => s.admins_can_invite_users },
  { label: "Let Client Admins remove users", read: s => s.admins_can_remove_users },
];

/**
 * Saves a partial update and returns the full settings. Changing the Invoices switch or either
 * Client Admin switch writes `Permission setting changed` with the setting and its new value.
 * Run it in a transaction so the audit events commit with the change.
 */
export async function savePortalSettingsV2(
  q: Queryable,
  input: { teamId: string; actor: AuditActor; patch: PortalSettingsV2Patch }
): Promise<PortalSettingsV2> {
  const current = await getPortalSettingsV2(q, input.teamId);
  const next = applySettingsPatch(current, input.patch);

  await q.query(
    `INSERT INTO client_portal_settings (
       team_id, organization_team_id, visible_invoices, allow_client_uploads_default,
       poc_can_add_users, poc_can_remove_users, client_email_events, team_email_events
     ) VALUES ($1, $1, $2, $3, $4, $5, $6::jsonb, $7::jsonb)
     ON CONFLICT (organization_team_id) DO UPDATE SET
       visible_invoices = EXCLUDED.visible_invoices,
       allow_client_uploads_default = EXCLUDED.allow_client_uploads_default,
       poc_can_add_users = EXCLUDED.poc_can_add_users,
       poc_can_remove_users = EXCLUDED.poc_can_remove_users,
       client_email_events = EXCLUDED.client_email_events,
       team_email_events = EXCLUDED.team_email_events,
       updated_at = CURRENT_TIMESTAMP`,
    [
      input.teamId,
      next.show_invoices,
      next.allow_client_uploads_default,
      next.admins_can_invite_users,
      next.admins_can_remove_users,
      JSON.stringify(next.client_email_events),
      JSON.stringify(next.team_email_events),
    ]
  );

  for (const setting of PERMISSION_SETTINGS) {
    const before = setting.read(current);
    const after = setting.read(next);
    if (before === after) continue;
    await recordAuditEvent(q, {
      teamId: input.teamId,
      event: "Permission setting changed",
      actor: input.actor,
      targetType: "setting",
      targetLabel: `${setting.label}: ${after ? "On" : "Off"}`,
      metadata: { setting: setting.label, from: before, to: after },
    });
  }

  return next;
}

export interface SharedCounts {
  tasks: { shared: number; total: number };
  files: { shared: number; total: number };
  milestones: { shared: number; total: number };
}

/**
 * "Currently shared across portal projects": how much of each kind is Client Visible, counted over
 * portal-enabled projects only.
 */
export async function getSharedCounts(q: Queryable, teamId: string): Promise<SharedCounts> {
  const result = await q.query(
    `WITH portal_projects AS (
       SELECT project_id FROM project_client_settings WHERE team_id = $1 AND portal_enabled IS TRUE
     )
     SELECT
       (SELECT COUNT(*)::int FROM tasks t
         WHERE t.archived IS FALSE AND t.project_id IN (SELECT project_id FROM portal_projects)) AS tasks_total,
       (SELECT COUNT(*)::int FROM client_portal_task_settings cts
          JOIN tasks t ON t.id = cts.task_id
         WHERE cts.visibility = 'client' AND t.archived IS FALSE
           AND cts.project_id IN (SELECT project_id FROM portal_projects)) AS tasks_shared,
       (SELECT COUNT(*)::int FROM project_files pf
         WHERE pf.status = 'active' AND pf.project_id IN (SELECT project_id FROM portal_projects)) AS files_total,
       (SELECT COUNT(*)::int FROM project_files pf
         WHERE pf.status = 'active' AND pf.portal_visibility = 'client'
           AND pf.project_id IN (SELECT project_id FROM portal_projects)) AS files_shared,
       (SELECT COUNT(*)::int FROM client_portal_milestones m
         WHERE m.project_id IN (SELECT project_id FROM portal_projects)) AS milestones_total,
       (SELECT COUNT(*)::int FROM client_portal_milestones m
         WHERE m.visibility = 'client'
           AND m.project_id IN (SELECT project_id FROM portal_projects)) AS milestones_shared`,
    [teamId]
  );

  const row = result.rows[0] ?? {};
  return {
    tasks: { shared: row.tasks_shared ?? 0, total: row.tasks_total ?? 0 },
    files: { shared: row.files_shared ?? 0, total: row.files_total ?? 0 },
    milestones: { shared: row.milestones_shared ?? 0, total: row.milestones_total ?? 0 },
  };
}
