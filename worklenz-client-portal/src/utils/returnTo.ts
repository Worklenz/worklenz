const KEY = 'clientPortalReturnTo';

// Paths that must never be a post-sign-in destination.
const BLOCKED = /^\/(auth|login|invite|access-removed|forgot-password|organization-invite)(\/|\?|$)/;

/** Only same-origin app paths are accepted, so a crafted value can't redirect off-site. */
export const isSafeReturnPath = (path: string | null | undefined): path is string =>
  typeof path === 'string' && path.startsWith('/') && !path.startsWith('//') && !path.includes('\\') && !BLOCKED.test(path);

/** Remember where the person was going, so sign-in lands them there (survives the emailed-link `/invite` step). */
export const saveReturnTo = (path: string): void => {
  if (!isSafeReturnPath(path)) return;
  try {
    sessionStorage.setItem(KEY, path);
  } catch {
    // sessionStorage unavailable: sign-in falls back to the dashboard
  }
};

export const peekReturnTo = (): string | null => {
  try {
    const value = sessionStorage.getItem(KEY);
    return isSafeReturnPath(value) ? value : null;
  } catch {
    return null;
  }
};

export const clearReturnTo = (): void => {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // ignore
  }
};
