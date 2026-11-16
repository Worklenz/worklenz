import { createSelector } from '@reduxjs/toolkit';

import type { RootState } from '@/app/store';
import { selectEffectiveStatusCategoryOrder } from '@/features/project/project.slice';
import { sortStatusesByCategory } from '@/utils/status-category-order';

export const selectRawStatuses = (state: Pick<RootState, 'taskStatusReducer'>) =>
  state.taskStatusReducer.status;

/**
 * Project statuses ordered by the configured category order, then by their
 * existing sort_order position within each category. Use this for any status
 * dropdown / filter / menu so the sequence matches task-list grouping.
 */
export const selectOrderedStatuses = createSelector(
  [selectRawStatuses, selectEffectiveStatusCategoryOrder],
  (statuses, categoryOrder) => sortStatusesByCategory(statuses, categoryOrder)
);
