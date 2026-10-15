import React, { Suspense, useCallback, useState } from 'react';
import { Spin } from '@/shared/antd-imports';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import {
  fetchTask,
  setSelectedTaskId,
  setShowTaskDrawer,
} from '@/features/task-drawer/task-drawer.slice';
import { setProjectId } from '@/features/project/project.slice';
import { fetchPhasesByProjectId } from '@/features/projects/singleProject/phase/phases.slice';

const TaskDrawer = React.lazy(() => import('@components/task-drawer/task-drawer'));

/**
 * Opens the task drawer for a task of any project (the same way the All Tasks report does). The
 * drawer itself is only loaded once a task is opened for the first time; render `drawer` once.
 */
export const useTimeLogsTaskDrawer = () => {
  const dispatch = useAppDispatch();
  const [isDrawerMounted, setIsDrawerMounted] = useState(false);

  const openTask = useCallback(
    (taskId: string, projectId: string) => {
      if (!taskId || !projectId) return;
      dispatch(setSelectedTaskId(taskId));
      dispatch(setProjectId(projectId));
      dispatch(fetchPhasesByProjectId(projectId));
      dispatch(fetchTask({ taskId, projectId }));
      dispatch(setShowTaskDrawer(true));
      setIsDrawerMounted(true);
    },
    [dispatch]
  );

  const drawer = isDrawerMounted ? (
    <Suspense fallback={<Spin size="small" />}>
      <TaskDrawer />
    </Suspense>
  ) : null;

  return { openTask, drawer };
};
