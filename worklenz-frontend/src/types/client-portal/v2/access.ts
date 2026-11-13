import type { PagedList, PagedParams } from './common';

/** One role per client user, applied to every project the user is assigned to. */
export type ClientRole = 'admin' | 'member' | 'viewer';

export const CLIENT_ROLES: readonly ClientRole[] = ['admin', 'member', 'viewer'];

export type ClientCapability =
  | 'view'
  | 'comment'
  | 'upload'
  | 'submit_change_request'
  | 'approve'
  | 'manage_users';

export interface ClientRoleDefinition {
  role: ClientRole;
  label: string;
  description: string;
  can: Record<ClientCapability, boolean>;
}

/**
 * "Invite expired" is a flag on an Invited user, not a separate status. `deleted` is a person who deleted
 * their own account: they cannot sign in, but the profile stays here until the 30-day window ends.
 */
export type ClientUserStatus = 'invited' | 'active' | 'deactivated' | 'deleted';

export type OrganizationPortalAccess = 'active' | 'invited' | 'deactivated' | 'none';

export interface ClientUserProjectRef {
  id: string;
  name: string;
}

export interface ClientUser {
  id: string;
  organization_id: string;
  organization_name: string;
  name: string;
  email: string;
  phone: string | null;
  job_title: string | null;
  role: ClientRole;
  status: ClientUserStatus;
  /** When the person deleted their own account; set only when `status` is `deleted`. */
  account_deleted_at: string | null;
  /** Until when the account can be restored; null once the 30-day window has ended. */
  restorable_until: string | null;
  /** Invited more than 7 days ago and not activated. */
  invite_expired: boolean;
  /** Added without sending the invitation ("Invite not sent yet"). */
  invite_not_sent: boolean;
  /** The client used the recovery request on the expired-invite screen. */
  new_link_requested: boolean;
  /** True once the person has entered a one-time code sent to this address (their first sign-in). */
  email_verified: boolean;
  invited_at: string | null;
  last_access_at: string | null;
  projects: ClientUserProjectRef[];
}

export interface OutstandingAmount {
  currency: string;
  amount: number;
}

export interface ClientOrganization {
  id: string;
  name: string;
  initials: string;
  color: string;
  /** `clients.status`; staff deactivate an organization by setting it to `inactive`. */
  status: 'active' | 'inactive' | 'pending' | string;
  /** Set only for a deleted organization (the Deleted view). */
  deleted_at: string | null;
  /** When a deleted organization stops being restorable and is purged. */
  purge_on: string | null;
  /** Client user the invitation link is created for; null when the organization has no portal admin. */
  primary_contact_id?: string | null;
  primary_contact_name: string | null;
  primary_contact_email: string | null;
  phone: string | null;
  /** Money owed per currency, largest first. Currencies are never added together. */
  outstanding: OutstandingAmount[];
  portal_access: OrganizationPortalAccess;
  active_users: number;
  invited_users: number;
  deactivated_users: number;
  total_users: number;
  portal_projects: number;
  awaiting_client: number;
  awaiting_approvals: number;
  awaiting_change_requests: number;
}

export interface ClientOrganizationStats {
  organizations: number;
  /** Deleted organizations still inside the 30-day restore window. */
  deleted_organizations: number;
  active_users: number;
  invited_users: number;
  expired_invites: number;
  awaiting_client_action: number;
}

export interface ClientOrganizationsParams extends PagedParams {
  /** One access state, or several joined with commas. */
  access?: OrganizationPortalAccess | string;
  /** true lists the deleted organizations that can still be restored, instead of the live ones. */
  deleted?: boolean;
}

export interface ClientDeletePreviewInvoice {
  invoice_no: string;
  currency: string;
  outstanding: number;
}

/** What the Delete client dialog shows before anything happens. */
export interface ClientDeletePreview {
  organization_id: string;
  name: string;
  status: string;
  active_users: number;
  invited_users: number;
  total_users: number;
  portal_projects: number;
  /** Unpaid invoices. Any of these blocks the delete. */
  open_invoices: ClientDeletePreviewInvoice[];
  /** Approvals still waiting for a decision; deleting needs an explicit confirmation. */
  pending_approvals: Array<{ ref_no: string; title: string }>;
  /** Change requests that are not completed, rejected or cancelled; deleting needs an explicit confirmation. */
  open_change_requests: Array<{ title: string }>;
  retention_days: number;
}

export interface DeleteOrganizationResult {
  organization_id: string;
  deleted_at: string;
  purge_on: string;
}

export interface DeleteOrganizationRequest {
  organizationId: string;
  confirmPendingApprovals?: boolean;
  confirmOpenChangeRequests?: boolean;
}

export interface ClientUsersParams extends PagedParams {
  organization_id?: string;
  /** One role, or several joined with commas. */
  role?: ClientRole | string;
  /** `invite_expired` is a filter value even though it is a flag, not a status. One value, or several joined with commas. */
  status?: ClientUserStatus | 'invite_expired' | string;
}

export type ClientUsersList = PagedList<ClientUser>;

export interface UpdateClientUserRequest {
  name?: string;
  email?: string;
  phone?: string | null;
  job_title?: string | null;
  role?: ClientRole;
  /** Send true after the "last Client Admin" warning was confirmed. */
  confirm_last_admin?: boolean;
  /** Send true after the "only approver" warning was confirmed (demoting the only approver of an approval). */
  confirm_pending_approvals?: boolean;
}

export interface AddClientRequest {
  method: 'new_organization' | 'existing_organization';
  organization_id?: string;
  organization_name?: string;
  first_name: string;
  last_name?: string;
  email: string;
  phone?: string;
  job_title?: string;
  /** Ignored for a new organization: its first user is always a Client Admin. */
  role?: ClientRole;
  project_ids: string[];
  send_invitation: boolean;
}

export interface InviteOutcome {
  requested: boolean;
  email_sent: boolean;
  /** Set when the email could not be sent, so the operator can still share the link. */
  link: string | null;
  expires_at: string | null;
  error: string | null;
}

export interface AddClientResult {
  organization: ClientOrganization;
  user: ClientUser;
  portals_switched_on: number;
  projects_linked: number;
  invite: InviteOutcome;
}

export type ClientOrganizationsList = PagedList<ClientOrganization> & {
  stats: ClientOrganizationStats;
};

/** Items that need staff attention in a client's workspace Overview. */
export type NeedsAttentionKind =
  | 'invite_expired'
  | 'approval_awaiting'
  | 'change_request_review'
  | 'unread_message';

export interface NeedsAttentionItem {
  kind: NeedsAttentionKind;
  /** The user, approval, request or discussion this row is about. */
  label: string;
  /** The approver, requester or project, depending on the kind. */
  detail: string | null;
  /** Set on an expired invitation when the client used the recovery request ("asked for a new link"). */
  flag: 'asked_new_link' | null;
  /** Where the row opens. Resolved by the client router, never a raw URL. */
  target: { type: 'user' | 'approval' | 'change_request' | 'thread'; id: string };
}

export interface ClientWorkspaceOverview {
  organization: ClientOrganization;
  stats: { portal_projects: number; awaiting_client_action: number; open_change_requests: number };
  needs_attention: NeedsAttentionItem[];
}
