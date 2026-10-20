/** Events that can email a client. In-app notifications are always on and cannot be switched off. */
export type ClientNotificationEvent =
  | 'approval_request'
  | 'comment_or_reply'
  | 'file_shared'
  | 'milestone_change'
  | 'project_update'
  | 'change_request_update'
  | 'access_changes';

export type TeamNotificationEvent =
  | 'client_comment'
  | 'approval_decision'
  | 'change_request'
  | 'client_file_upload';

/**
 * Portal Settings v2. Company Details and Branding are unchanged and still use the existing
 * `IClientPortalSettings`; only the rebuilt sections are modelled here. There is no sign-in
 * configuration: clients always sign in with a one-time code emailed to an address that was added.
 */
export interface PortalSettingsV2 {
  /** Sharing & Visibility: the only section toggle left. */
  show_invoices: boolean;
  allow_client_uploads_default: boolean;
  /** Client Roles. */
  admins_can_invite_users: boolean;
  admins_can_remove_users: boolean;
  client_email_events: Record<ClientNotificationEvent, boolean>;
  team_email_events: Record<TeamNotificationEvent, boolean>;
}

/** "Currently shared across portal projects", counted over portal-enabled projects only. */
export interface SharedCounts {
  tasks: { shared: number; total: number };
  files: { shared: number; total: number };
  milestones: { shared: number; total: number };
}

export interface PortalSettingsV2Response {
  settings: PortalSettingsV2;
  shared: SharedCounts;
}
