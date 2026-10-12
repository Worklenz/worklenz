import { useCallback } from 'react';
import { useStore } from 'react-redux';

import type { RootState } from '@/app/store';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { updateTask } from '@/features/task-management/task-management.slice';
import { Task } from '@/types/task-management.types';
import { IServerResponse } from '@/types/common.types';

/**
 * Applies a field change to the task list immediately, persists it with `save`,
 * and restores the previous value when saving fails. Resolves to whether it saved.
 */
export const useOptimisticTaskUpdate = () => {
  const dispatch = useAppDispatch();
  const reduxStore = useStore<RootState>();

  return useCallback(
    async <K extends keyof Task>(
      taskId: string,
      field: K,
      value: Task[K],
      save: () => Promise<IServerResponse<unknown>>
    ): Promise<boolean> => {
      const listTask = reduxStore.getState().taskManagement.entities[taskId];
      const previousValue = listTask?.[field];
      if (listTask) dispatch(updateTask({ ...listTask, [field]: value }));

      try {
        const response = await save();
        if (!response.done) throw new Error(response.message);
        return true;
      } catch {
        const latestTask = reduxStore.getState().taskManagement.entities[taskId];
        if (latestTask) dispatch(updateTask({ ...latestTask, [field]: previousValue }));
        return false;
      }
    },
    [dispatch, reduxStore]
  );
};
