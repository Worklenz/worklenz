import { useMemo } from 'react';

import { useAppSelector } from '@/hooks/useAppSelector';
import { ITaskStatus } from '@/types/tasks/taskStatus.types';
import { selectEffectiveStatusCategoryOrder } from '@/features/project/project.slice';
import { sortStatusesByCategory } from '@/utils/status-category-order';

/**
 * Statuses offered by the task drawer. Prefers the Redux statuses (ordered by
 * sort_order) when they belong to the same project as the open task.
 */
export const useTaskDrawerStatuses = (): ITaskStatus[] => {
  const storeStatuses = useAppSelector(state => state.taskStatusReducer.status);
  const drawerStatuses = useAppSelector(
    state => state.taskDrawerReducer.taskFormViewModel?.statuses
  );
  const categoryOrder = useAppSelector(selectEffectiveStatusCategoryOrder);

  return useMemo(() => {
    const statuses = drawerStatuses ?? [];
    if (!storeStatuses.length) return sortStatusesByCategory(statuses, categoryOrder);
    if (!statuses.length) return sortStatusesByCategory(storeStatuses, categoryOrder);

    const drawerIds = new Set(statuses.map(status => status.id));
    const storeMatchesDrawer =
      storeStatuses.length === statuses.length &&
      storeStatuses.every(status => drawerIds.has(status.id));

    return sortStatusesByCategory(storeMatchesDrawer ? storeStatuses : statuses, categoryOrder);
  }, [categoryOrder, drawerStatuses, storeStatuses]);
};
