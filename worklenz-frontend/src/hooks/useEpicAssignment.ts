import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { message } from '@/shared/antd-imports';

import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useOptimisticTaskUpdate } from '@/hooks/useOptimisticTaskUpdate';
import { projectEpicsApiService } from '@/api/project-epics/project-epics.api.service';
import { fetchProjectEpics } from '@/features/projects/singleProject/epics/epics.slice';

/** Moves an issue into (or out of) an Epic and refreshes Epic progress. */
export const useEpicAssignment = (projectId?: string | null) => {
  const { t } = useTranslation('task-list-table');
  const dispatch = useAppDispatch();
  const updateTaskOptimistically = useOptimisticTaskUpdate();

  const assignEpic = useCallback(
    async (taskId: string, epicId: string | null): Promise<boolean> => {
      if (!projectId) return false;
      const isSaved = await updateTaskOptimistically(taskId, 'epic_id', epicId, () =>
        projectEpicsApiService.assignTask(projectId, taskId, epicId)
      );
      if (!isSaved) {
        message.error(
          t('epicAssignError', { defaultValue: 'Could not change the Epic. Please try again.' })
        );
        return false;
      }
      void dispatch(fetchProjectEpics(projectId));
      return true;
    },
    [dispatch, projectId, t, updateTaskOptimistically]
  );

  return { assignEpic };
};
