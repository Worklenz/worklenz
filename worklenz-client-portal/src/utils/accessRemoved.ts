/** Fired when the server says this client user may no longer use the portal. */
export const ACCESS_REMOVED_EVENT = 'client-deactivated';

interface ErrorBodyShape {
  message?: unknown;
  body?: { code?: unknown } | null;
}

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
  if (shape.body && shape.body.code === 'ACCESS_REVOKED') return true;
  const message = typeof shape.message === 'string' ? shape.message.toLowerCase() : '';
  return (
    message.includes('removed') ||
    message.includes('deactivated') ||
    message.includes('portal access is disabled') ||
    message.includes('access has been disabled')
  );
};

/** Clears the stored session and tells the app to show the access-removed screen. */
export const signalAccessRemoved = (): void => {
  localStorage.removeItem('clientToken');
  localStorage.removeItem('clientTokenExpiry');
  window.dispatchEvent(new CustomEvent(ACCESS_REMOVED_EVENT));
};
