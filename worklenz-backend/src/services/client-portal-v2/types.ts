/** A pg-style `query`: the shared pool, or a client checked out for a transaction. */
export interface Queryable {
  query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount?: number | null }>;
}

/** Internal Only is the default for every task, file, milestone and discussion message. */
export type PortalVisibility = "internal" | "client";

export const isPortalVisibility = (value: unknown): value is PortalVisibility =>
  value === "internal" || value === "client";

export type PortalSide = "client" | "internal";

export type AuditEventType =
  | "access"
  | "visibility"
  | "file"
  | "comment"
  | "approval"
  | "change_request";

/**
 * Every event the audit log records, with the group the log filters by. Client sign-in, internal
 * comments, published project updates, milestone completion and estimate changes are deliberately
 * not logged (Audit Log spec); "Milestone deleted" is an addition the spec asks for.
 */
export const AUDIT_EVENTS = {
  "Client invited": "access",
  "Invite link created": "access",
  "Invitation resent": "access",
  "Client email verified": "access",
  "Client activated": "access",
  "Client deactivated": "access",
  "Client removed": "access",
  "Client account deleted": "access",
  "Client account restored": "access",
  "Account deletion requested": "access",
  "Client organization deactivated": "access",
  "Client organization reactivated": "access",
  "Client organization deleted": "access",
  "Client organization restored": "access",
  "Client organization purged": "access",
  "Role changed": "access",
  "Permission setting changed": "access",
  "Project access assigned": "access",
  "Project access removed": "access",
  "Project portal enabled": "access",
  "Project portal disabled": "access",
  "Project linked to client": "access",
  "Entity made Client Visible": "visibility",
  "Entity returned to Internal Only": "visibility",
  "Client file uploaded": "file",
  "Client file previewed": "file",
  "Client file downloaded": "file",
  "File version uploaded": "file",
  "Milestone deleted": "visibility",
  "Client comment created": "comment",
  "Approval drafted": "approval",
  "Approval requested": "approval",
  "Approval edited": "approval",
  "Approval deleted": "approval",
  "Approval cancelled": "approval",
  "Approval: approved": "approval",
  "Approval: changes requested": "approval",
  "Change request created": "change_request",
  "Change request status changed": "change_request",
  "Change request completed": "change_request",
} as const satisfies Record<string, AuditEventType>;

export type AuditEventKey = keyof typeof AUDIT_EVENTS;

export const AUDIT_EVENT_TYPES: readonly AuditEventType[] = [
  "access",
  "visibility",
  "file",
  "comment",
  "approval",
  "change_request",
];
