import { useMemo, type Key } from 'react';
import { useAuthService } from '@/hooks/useAuth';
import { useAppSelector } from '@/hooks/useAppSelector';

/**
 * Planner, Clients and Finance are opened to other roles through the
 * "View planner" / "View clients" / "View finance" permissions, but only
 * Owners and Admins may change anything there (the backend enforces the same).
 */
export const useIsAdminSurfaceReadOnly = (): boolean => {
  const authService = useAuthService();
  // Subscribing to the auth user re-reads the session after login or team switch
  const authUser = useAppSelector(state => state.auth.user);

  return useMemo(() => !authService.isOwnerOrAdmin(), [authService, authUser]);
};

const ROW_ACTION_COLUMN_KEYS = ['actions', 'actionBtns'];

export const withoutRowActionColumns = <TColumn extends { key?: Key }>(
  columns: TColumn[] | undefined
): TColumn[] | undefined =>
  columns?.filter(column => !ROW_ACTION_COLUMN_KEYS.includes(String(column.key)));
