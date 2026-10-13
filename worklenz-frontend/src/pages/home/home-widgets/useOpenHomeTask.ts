import { useCallback } from 'react';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { setProjectId } from '@/features/project/project.slice';
import { fetchTask, setSelectedTaskId, setShowTaskDrawer } from '@/features/task-drawer/task-drawer.slice';

/** Returns a function that opens a task in the task drawer, the way a task row on Home does. */
export const useOpenHomeTask = () => {
  const dispatch = useAppDispatch();
  return useCallback(
    (taskId: string, projectId: string) => {
      dispatch(setProjectId(projectId || ''));
      dispatch(setSelectedTaskId(taskId));
      dispatch(setShowTaskDrawer(true));
      dispatch(fetchTask({ taskId, projectId }));
    },
    [dispatch]
  );
};
