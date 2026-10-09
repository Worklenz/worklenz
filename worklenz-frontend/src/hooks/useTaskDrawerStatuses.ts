import { useMemo } from 'react';

import { useAppSelector } from '@/hooks/useAppSelector';
import { ITaskStatus } from '@/types/tasks/taskStatus.types';

/**
 * Statuses offered by the task drawer. Prefers the Redux statuses (ordered by
 * sort_order) when they belong to the same project as the open task.
 */
export const useTaskDrawerStatuses = (): ITaskStatus[] => {
  const storeStatuses = useAppSelector(state => state.taskStatusReducer.status);
  const drawerStatuses = useAppSelector(
    state => state.taskDrawerReducer.taskFormViewModel?.statuses
  );

  return useMemo(() => {
    const statuses = drawerStatuses ?? [];
    if (!storeStatuses.length) return statuses;
    if (!statuses.length) return storeStatuses;

    const drawerIds = new Set(statuses.map(status => status.id));
    const storeMatchesDrawer =
      storeStatuses.length === statuses.length &&
      storeStatuses.every(status => drawerIds.has(status.id));

    return storeMatchesDrawer ? storeStatuses : statuses;
  }, [drawerStatuses, storeStatuses]);
};
