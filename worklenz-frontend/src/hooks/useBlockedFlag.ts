import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { message } from '@/shared/antd-imports';

import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useOptimisticTaskUpdate } from '@/hooks/useOptimisticTaskUpdate';
import { issueFlagsApiService } from '@/api/issue-flags/issue-flags.api.service';
import { updateEnhancedKanbanTaskBlocked } from '@/features/enhanced-kanban/enhanced-kanban.slice';

/** Flags or clears the "blocked" marker on an issue. */
export const useBlockedFlag = (projectId?: string | null) => {
  const { t } = useTranslation('task-list-table');
  const dispatch = useAppDispatch();
  const updateTaskOptimistically = useOptimisticTaskUpdate();

  const setBlocked = useCallback(
    async (taskId: string, isBlocked: boolean): Promise<boolean> => {
      if (!projectId) return false;
      const isSaved = await updateTaskOptimistically(taskId, 'is_blocked', isBlocked, () =>
        issueFlagsApiService.setBlocked(projectId, taskId, isBlocked)
      );
      if (!isSaved) {
        message.error(
          t('blockedSaveError', { defaultValue: 'Could not update the blocked flag. Please try again.' })
        );
        return false;
      }
      dispatch(updateEnhancedKanbanTaskBlocked({ taskId, isBlocked }));
      return true;
    },
    [dispatch, projectId, t, updateTaskOptimistically]
  );

  return { setBlocked };
};
