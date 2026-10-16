import { useCallback } from 'react';
import { useAuthService } from '@/hooks/useAuth';

/**
 * Who may edit or delete a time entry on the Time Entries page: the person who logged it, and
 * owners/admins for anyone in their team. Members and team leads can change only their own.
 *
 * Mirrors the server rule (TaskWorklogController.updateTimeEntry / deleteTimeEntry), which is the
 * authority — this only decides whether to show the Edit/Delete actions. The task drawer has its
 * own, stricter (author-only) rule and does not use this.
 */
export const useCanEditTimeEntry = (): ((entryUserId?: string | null) => boolean) => {
  const authService = useAuthService();
  const currentUserId = authService.getCurrentSession()?.id;
  const isOwnerOrAdmin = authService.isOwnerOrAdmin();

  return useCallback(
    (entryUserId?: string | null) =>
      isOwnerOrAdmin || (!!entryUserId && entryUserId === currentUserId),
    [isOwnerOrAdmin, currentUserId]
  );
};
