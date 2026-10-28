/** Fired when the server says this client user may no longer use the portal. */
export const ACCESS_REMOVED_EVENT = 'client-deactivated';

/**
 * Why access ended, as the server tells it. The words are deliberately coarse: no company, team or person
 * is ever named, so the screen cannot be used to find out who is a client.
 *
 *   organization_unavailable  the organization was deactivated or deleted, or its portal access is off
 *   account_deleted           the person deleted their own account
 *   access_disabled           the project team deactivated them
 *   access_removed            they are no longer a user of this organization
 */
export type AccessRemovedReason =
  | 'organization_unavailable'
  | 'account_deleted'
  | 'access_disabled'
  | 'access_removed';

const ACCESS_REMOVED_REASONS: readonly string[] = [
  'organization_unavailable',
  'account_deleted',
  'access_disabled',
  'access_removed',
];

export const isAccessRemovedReason = (value: unknown): value is AccessRemovedReason =>
  typeof value === 'string' && ACCESS_REMOVED_REASONS.includes(value);

export interface AccessRemovedEventDetail {
  reason: AccessRemovedReason | null;
}

interface ErrorBodyShape {
  message?: unknown;
  body?: { code?: unknown; reason?: unknown } | null;
}

/** True when the server answered with the machine-readable ACCESS_REVOKED code. */
export const isAccessRevokedBody = (data: unknown): boolean =>
  ((data ?? {}) as ErrorBodyShape).body?.code === 'ACCESS_REVOKED';

/** The coarse reason the server gave, or null when it gave none (an older server, or a plain 401). */
export const getAccessRemovedReason = (data: unknown): AccessRemovedReason | null => {
  const reason = ((data ?? {}) as ErrorBodyShape).body?.reason;
  return isAccessRemovedReason(reason) ? reason : null;
};

/**
 * True when a failed response means "your access has been removed", not "that item is not available".
 * - 401: the login no longer exists or the token is invalid.
 * - 403 with code ACCESS_REVOKED (v2 `requireClientSubject`), or the older deactivated / disabled messages.
 * A 404 is deliberately NOT here: a hidden or removed item is a per-page "unavailable" state.
 */
export const isAccessRemovedResponse = (status: number | string | undefined, data: unknown): boolean => {
  if (status === 401) return true;
  if (status !== 403) return false;
  const shape = (data ?? {}) as ErrorBodyShape;
  if (isAccessRevokedBody(data)) return true;
  const message = typeof shape.message === 'string' ? shape.message.toLowerCase() : '';
  return (
    message.includes('removed') ||
    message.includes('deactivated') ||
    message.includes('portal access is disabled') ||
    message.includes('access has been disabled')
  );
};

/** Where the access-removed screen lives; the reason picks its wording. */
export const ACCESS_REMOVED_PATH = '/access-removed';

export const accessRemovedPath = (reason: AccessRemovedReason | null): string =>
  reason ? `${ACCESS_REMOVED_PATH}?reason=${reason}` : ACCESS_REMOVED_PATH;

/** Clears the stored session and tells the app to show the access-removed screen. */
export const signalAccessRemoved = (reason: AccessRemovedReason | null = null): void => {
  localStorage.removeItem('clientToken');
  localStorage.removeItem('clientTokenExpiry');
  window.dispatchEvent(
    new CustomEvent<AccessRemovedEventDetail>(ACCESS_REMOVED_EVENT, { detail: { reason } })
  );
};
