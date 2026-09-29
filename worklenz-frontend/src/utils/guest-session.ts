/**
 * Team-scoped guest check for authenticated session users.
 * Owners/admins are never treated as guests.
 */
export const isSessionGuest = (user?: {
  is_guest?: boolean;
  owner?: boolean;
  is_admin?: boolean;
} | null): boolean => {
  if (!user || user.owner || user.is_admin) {
    return false;
  }

  return user.is_guest === true;
};

/** Default post-auth landing path for guests vs full members. */
export const getDefaultAuthenticatedPath = (user?: {
  is_guest?: boolean;
  owner?: boolean;
  is_admin?: boolean;
} | null): string => {
  return isSessionGuest(user) ? '/worklenz/projects' : '/worklenz/home';
};
