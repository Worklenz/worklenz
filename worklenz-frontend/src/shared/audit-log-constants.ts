/**
 * Audit Log event taxonomy — Audit log spec, task 1.4.
 *
 * Single source of truth for the 4 event categories and their concrete event types used by
 * Admin Center > Security > Audit Log. The `id` values here are the literal strings persisted
 * in `audit_events.category` / `audit_events.event_type` on the backend
 * (see worklenz-backend/database/pg-migrations/1791193625587_create-audit-events-table.js) —
 * treat them as a public contract: add new entries freely, never rename or remove an existing
 * `id` once it may have been written to a row.
 *
 * `worklenz-backend` and `worklenz-frontend` are separate deployable apps with no shared
 * package between them, so this module is a deliberate duplicate (not an import) of
 * `worklenz-backend/src/shared/audit-log-constants.ts`. Keep the `id`/`category`/`i18nKey`
 * values identical in both copies when this file changes. `color` here maps directly to the
 * category chip/badge colors in the approved mockup (worklenz-audit-log-prototype.html).
 *
 * Scope note (spike #32, task 0.8): "SSO configuration changed" and "API token
 * created/revoked" are deliberately NOT included below, even though the design mockup shows
 * them as sample rows. A direct backend code audit found neither an enterprise SSO/SAML
 * integration nor a user-facing API token feature anywhere in Worklenz today — Google/Apple
 * sign-in are consumer OAuth, not customer-configurable SSO. Rendering a filter/chip for an
 * event type nothing can ever emit would be misleading; add these once (if) those features
 * ship.
 *
 * Use `AUDIT_LOG_I18N_NAMESPACE` with `useTranslation()` the same way other Admin Center pages
 * do (see pages/admin-center/sidebar/sidebar.tsx: `useTranslation('admin-center/sidebar')` +
 * flat keys), e.g. `t(AUDIT_EVENT_CATEGORY.ACCESS.i18nKey, { defaultValue: AUDIT_EVENT_CATEGORY.ACCESS.defaultLabel })`.
 */

export const AUDIT_LOG_I18N_NAMESPACE = 'admin-center/audit-log';

export const AUDIT_EVENT_CATEGORY = {
  ACCESS: {
    id: 'access',
    i18nKey: 'categoryAccess',
    defaultLabel: 'Access & Authentication',
    color: 'blue',
  },
  USER: {
    id: 'user',
    i18nKey: 'categoryUser',
    defaultLabel: 'User & Role Management',
    color: 'green',
  },
  PERMISSION: {
    id: 'permission',
    i18nKey: 'categoryPermission',
    defaultLabel: 'Permission & Settings Changes',
    color: 'amber',
  },
  LIFECYCLE: {
    id: 'lifecycle',
    i18nKey: 'categoryLifecycle',
    defaultLabel: 'Project & Workspace Lifecycle',
    color: 'red',
  },
} as const;

export type AuditEventCategoryId =
  (typeof AUDIT_EVENT_CATEGORY)[keyof typeof AUDIT_EVENT_CATEGORY]['id'];

interface AuditEventTypeDefinition {
  id: string;
  category: AuditEventCategoryId;
  i18nKey: string;
  defaultLabel: string;
}

const defineEventType = <T extends AuditEventTypeDefinition>(def: T): T => def;

export const AUDIT_EVENT_TYPE = {
  // --- Access & Authentication -----------------------------------------------------------
  LOGIN_SUCCESS: defineEventType({
    id: 'login_success',
    category: AUDIT_EVENT_CATEGORY.ACCESS.id,
    i18nKey: 'eventLoginSuccess',
    defaultLabel: 'Login succeeded',
  }),
  LOGIN_FAILED: defineEventType({
    id: 'login_failed',
    category: AUDIT_EVENT_CATEGORY.ACCESS.id,
    i18nKey: 'eventLoginFailed',
    defaultLabel: 'Login failed',
  }),
  LOGOUT: defineEventType({
    id: 'logout',
    category: AUDIT_EVENT_CATEGORY.ACCESS.id,
    i18nKey: 'eventLogout',
    defaultLabel: 'Logged out',
  }),
  PASSWORD_CHANGED: defineEventType({
    id: 'password_changed',
    category: AUDIT_EVENT_CATEGORY.ACCESS.id,
    i18nKey: 'eventPasswordChanged',
    defaultLabel: 'Password changed',
  }),
  PASSWORD_RESET_REQUESTED: defineEventType({
    id: 'password_reset_requested',
    category: AUDIT_EVENT_CATEGORY.ACCESS.id,
    i18nKey: 'eventPasswordResetRequested',
    defaultLabel: 'Password reset requested',
  }),
  PASSWORD_RESET_COMPLETED: defineEventType({
    id: 'password_reset_completed',
    category: AUDIT_EVENT_CATEGORY.ACCESS.id,
    i18nKey: 'eventPasswordResetCompleted',
    defaultLabel: 'Password reset completed',
  }),

  // --- User & Role Management -------------------------------------------------------------
  MEMBER_INVITED: defineEventType({
    id: 'member_invited',
    category: AUDIT_EVENT_CATEGORY.USER.id,
    i18nKey: 'eventMemberInvited',
    defaultLabel: 'Member invited',
  }),
  MEMBER_REMOVED: defineEventType({
    id: 'member_removed',
    category: AUDIT_EVENT_CATEGORY.USER.id,
    i18nKey: 'eventMemberRemoved',
    defaultLabel: 'Member removed',
  }),
  ROLE_CHANGED: defineEventType({
    id: 'role_changed',
    category: AUDIT_EVENT_CATEGORY.USER.id,
    i18nKey: 'eventRoleChanged',
    defaultLabel: 'Role changed',
  }),
  OWNERSHIP_TRANSFERRED: defineEventType({
    id: 'ownership_transferred',
    category: AUDIT_EVENT_CATEGORY.USER.id,
    i18nKey: 'eventOwnershipTransferred',
    defaultLabel: 'Ownership transferred',
  }),
  MEMBER_UPDATED: defineEventType({
    id: 'member_updated',
    category: AUDIT_EVENT_CATEGORY.USER.id,
    i18nKey: 'eventMemberUpdated',
    defaultLabel: 'Member details changed',
  }),
  MEMBER_ACTIVATED: defineEventType({
    id: 'member_activated',
    category: AUDIT_EVENT_CATEGORY.USER.id,
    i18nKey: 'eventMemberActivated',
    defaultLabel: 'Member activated',
  }),
  MEMBER_DEACTIVATED: defineEventType({
    id: 'member_deactivated',
    category: AUDIT_EVENT_CATEGORY.USER.id,
    i18nKey: 'eventMemberDeactivated',
    defaultLabel: 'Member deactivated',
  }),
  INVITATION_RESENT: defineEventType({
    id: 'invitation_resent',
    category: AUDIT_EVENT_CATEGORY.USER.id,
    i18nKey: 'eventInvitationResent',
    defaultLabel: 'Invitation resent',
  }),
  INVITATION_LINK_CREATED: defineEventType({
    id: 'invitation_link_created',
    category: AUDIT_EVENT_CATEGORY.USER.id,
    i18nKey: 'eventInvitationLinkCreated',
    defaultLabel: 'Invitation link created',
  }),
  INVITATION_LINK_REVOKED: defineEventType({
    id: 'invitation_link_revoked',
    category: AUDIT_EVENT_CATEGORY.USER.id,
    i18nKey: 'eventInvitationLinkRevoked',
    defaultLabel: 'Invitation link revoked',
  }),
  MEMBER_JOINED: defineEventType({
    id: 'member_joined',
    category: AUDIT_EVENT_CATEGORY.USER.id,
    i18nKey: 'eventMemberJoined',
    defaultLabel: 'Member joined',
  }),
  PROJECT_MEMBER_ADDED: defineEventType({
    id: 'project_member_added',
    category: AUDIT_EVENT_CATEGORY.USER.id,
    i18nKey: 'eventProjectMemberAdded',
    defaultLabel: 'Added to project',
  }),
  PROJECT_MEMBER_REMOVED: defineEventType({
    id: 'project_member_removed',
    category: AUDIT_EVENT_CATEGORY.USER.id,
    i18nKey: 'eventProjectMemberRemoved',
    defaultLabel: 'Removed from project',
  }),

  // --- Permission & Settings Changes -------------------------------------------------------
  PROJECT_PRIVACY_CHANGED: defineEventType({
    id: 'project_privacy_changed',
    category: AUDIT_EVENT_CATEGORY.PERMISSION.id,
    i18nKey: 'eventProjectPrivacyChanged',
    defaultLabel: 'Project privacy changed',
  }),
  WORKSPACE_SETTING_CHANGED: defineEventType({
    id: 'workspace_setting_changed',
    category: AUDIT_EVENT_CATEGORY.PERMISSION.id,
    i18nKey: 'eventWorkspaceSettingChanged',
    defaultLabel: 'Workspace setting changed',
  }),
  RETENTION_WINDOW_CHANGED: defineEventType({
    id: 'retention_window_changed',
    category: AUDIT_EVENT_CATEGORY.PERMISSION.id,
    i18nKey: 'eventRetentionWindowChanged',
    defaultLabel: 'Audit log retention changed',
  }),
  PROJECT_SETTING_CHANGED: defineEventType({
    id: 'project_setting_changed',
    category: AUDIT_EVENT_CATEGORY.PERMISSION.id,
    i18nKey: 'eventProjectSettingChanged',
    defaultLabel: 'Project setting changed',
  }),
  MEMBER_PERMISSION_CHANGED: defineEventType({
    id: 'member_permission_changed',
    category: AUDIT_EVENT_CATEGORY.PERMISSION.id,
    i18nKey: 'eventMemberPermissionChanged',
    defaultLabel: 'Member permission changed',
  }),

  // --- Project & Workspace Lifecycle -------------------------------------------------------
  PROJECT_CREATED: defineEventType({
    id: 'project_created',
    category: AUDIT_EVENT_CATEGORY.LIFECYCLE.id,
    i18nKey: 'eventProjectCreated',
    defaultLabel: 'Project created',
  }),
  PROJECT_ARCHIVED: defineEventType({
    id: 'project_archived',
    category: AUDIT_EVENT_CATEGORY.LIFECYCLE.id,
    i18nKey: 'eventProjectArchived',
    defaultLabel: 'Project archived',
  }),
  PROJECT_DELETED: defineEventType({
    id: 'project_deleted',
    category: AUDIT_EVENT_CATEGORY.LIFECYCLE.id,
    i18nKey: 'eventProjectDeleted',
    defaultLabel: 'Project deleted',
  }),
  PROJECT_RESTORED: defineEventType({
    id: 'project_restored',
    category: AUDIT_EVENT_CATEGORY.LIFECYCLE.id,
    i18nKey: 'eventProjectRestored',
    defaultLabel: 'Project restored',
  }),
  WORKSPACE_RENAMED: defineEventType({
    id: 'workspace_renamed',
    category: AUDIT_EVENT_CATEGORY.LIFECYCLE.id,
    i18nKey: 'eventWorkspaceRenamed',
    defaultLabel: 'Workspace renamed',
  }),
  WORKSPACE_DELETED: defineEventType({
    id: 'workspace_deleted',
    category: AUDIT_EVENT_CATEGORY.LIFECYCLE.id,
    i18nKey: 'eventWorkspaceDeleted',
    defaultLabel: 'Workspace deleted',
  }),
} as const;

export type AuditEventTypeId =
  (typeof AUDIT_EVENT_TYPE)[keyof typeof AUDIT_EVENT_TYPE]['id'];

const EVENT_TYPE_BY_ID: Record<string, AuditEventTypeDefinition> = Object.values(
  AUDIT_EVENT_TYPE
).reduce((acc, def) => ({ ...acc, [def.id]: def }), {});

const CATEGORY_BY_ID: Record<
  string,
  (typeof AUDIT_EVENT_CATEGORY)[keyof typeof AUDIT_EVENT_CATEGORY]
> = Object.values(AUDIT_EVENT_CATEGORY).reduce((acc, def) => ({ ...acc, [def.id]: def }), {});

/** True if `value` is a known, loggable audit event type id. */
export const isValidAuditEventType = (value: string): value is AuditEventTypeId =>
  value in EVENT_TYPE_BY_ID;

/** True if `value` is one of the 4 known audit event category ids. */
export const isValidAuditEventCategory = (value: string): value is AuditEventCategoryId =>
  value in CATEGORY_BY_ID;

/** Looks up the category id a given event type belongs to; throws on an unknown event type. */
export const getCategoryForEventType = (eventType: AuditEventTypeId): AuditEventCategoryId => {
  const def = EVENT_TYPE_BY_ID[eventType];
  if (!def) {
    throw new Error(`Unknown audit event type: ${eventType}`);
  }
  return def.category;
};

/** All 4 categories as an array, in display order — convenient for rendering filter chips. */
export const AUDIT_EVENT_CATEGORY_LIST = Object.values(AUDIT_EVENT_CATEGORY);

/** All known event types as an array — convenient for building a multi-select filter. */
export const AUDIT_EVENT_TYPE_LIST = Object.values(AUDIT_EVENT_TYPE);
