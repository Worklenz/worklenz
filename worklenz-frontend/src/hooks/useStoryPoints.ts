import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { message } from '@/shared/antd-imports';

import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useOptimisticTaskUpdate } from '@/hooks/useOptimisticTaskUpdate';
import { storyPointsApiService } from '@/api/story-points/story-points.api.service';
import { fetchProjectEpics } from '@/features/projects/singleProject/epics/epics.slice';
import { updateEnhancedKanbanTaskStoryPoints } from '@/features/enhanced-kanban/enhanced-kanban.slice';

/**
 * Story point scale of the current project and a setter that keeps the task list,
 * sprint metrics and Epic progress in sync. Rolls back the list on failure.
 */
export const useStoryPoints = (projectId?: string | null) => {
  const { t } = useTranslation('task-list-table');
  const dispatch = useAppDispatch();
  const updateTaskOptimistically = useOptimisticTaskUpdate();
  const scale = useAppSelector(state => state.projectReducer.project?.story_point_scale);

  const setTaskPoints = useCallback(
    async (taskId: string, storyPoints: number | null): Promise<boolean> => {
      if (!projectId) return false;
      const isSaved = await updateTaskOptimistically(taskId, 'story_points', storyPoints, () =>
        storyPointsApiService.setTaskPoints(projectId, taskId, storyPoints)
      );
      if (!isSaved) {
        message.error(
          t('storyPointsSaveError', { defaultValue: 'Could not save story points. Please try again.' })
        );
        return false;
      }
      dispatch(updateEnhancedKanbanTaskStoryPoints({ taskId, storyPoints }));
      void dispatch(fetchProjectEpics(projectId));
      return true;
    },
    [dispatch, projectId, t, updateTaskOptimistically]
  );

  return { scale, setTaskPoints };
};
