import type { PagedList, PagedParams, PortalSide } from './common';

export type AuditEventType =
  | 'access'
  | 'visibility'
  | 'file'
  | 'comment'
  | 'approval'
  | 'change_request';

/**
 * Events the log records. Client sign-in, internal comments, published project updates,
 * milestone completion and estimate changes are deliberately not logged.
 */
export type AuditEventKey =
  | 'Client invited'
  | 'Invitation resent'
  | 'Client email verified'
  | 'Client activated'
  | 'Client deactivated'
  | 'Client removed'
  | 'Client account deleted'
  | 'Role changed'
  | 'Permission setting changed'
  | 'Project access assigned'
  | 'Project access removed'
  | 'Project portal enabled'
  | 'Project portal disabled'
  | 'Project linked to client'
  | 'Entity made Client Visible'
  | 'Entity returned to Internal Only'
  | 'Client file uploaded'
  | 'Client file previewed'
  | 'Client file downloaded'
  | 'File version uploaded'
  | 'Milestone deleted'
  | 'Client comment created'
  | 'Approval drafted'
  | 'Approval requested'
  | 'Approval edited'
  | 'Approval deleted'
  | 'Approval cancelled'
  | 'Approval: approved'
  | 'Approval: changes requested'
  | 'Change request created'
  | 'Change request status changed'
  | 'Change request completed';

export interface AuditEvent {
  id: string;
  at: string;
  actor: string;
  side: PortalSide;
  type: AuditEventType;
  event: AuditEventKey;
  /** Never contains comment bodies or internal notes. */
  target: string;
  /** What the target is (approval, change_request, file, ...); null on older rows. */
  target_type: string | null;
  /** Null for workspace-level actions with no client context. */
  organization_id: string | null;
  organization_name: string | null;
}

export interface AuditParams extends PagedParams {
  /** Comma-separated list of event types. */
  type?: string;
  /** Comma-separated list of sides. */
  side?: string;
  organization_id?: string;
  /** ISO instant, inclusive. */
  date_from?: string;
  /** ISO instant, exclusive. */
  date_to?: string;
}

export type AuditList = PagedList<AuditEvent>;
