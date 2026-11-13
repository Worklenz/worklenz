import { useMemo } from 'react';
import { useAuthService } from '@/hooks/useAuth';
import { useAppSelector } from '@/hooks/useAppSelector';
import { ROLE_NAMES } from '@/types/roles/role.types';
import { getSessionRoleName } from '@/utils/role-permissions.utils';
import { isSessionGuest } from '@/utils/guest-session';

/**
 * Whether the current user may change project fields from the reports pages.
 * Owner/Admin and Team Lead can edit; Members and Guests are read-only if they
 * reach a report surface (main Reports is Owner/Admin only).
 */
export const useCanEditReports = (): boolean => {
  const authService = useAuthService();
  // Subscribing to the auth user re-reads the session after login or team switch
  const authUser = useAppSelector(state => state.auth.user);

  return useMemo(() => {
    if (authService.isOwnerOrAdmin()) return true;

    const session = authService.getCurrentSession();
    if (isSessionGuest(session)) return false;

    return getSessionRoleName(session) === ROLE_NAMES.TEAM_LEAD;
  }, [authService, authUser]);
};
