import { describe, expect, it } from 'vitest';

import { selectOrderedStatuses } from './taskStatus.selectors';
import type { RootState } from '@/app/store';

describe('selectOrderedStatuses', () => {
  it('orders statuses by project category order while preserving within-category order', () => {
    const state = {
      taskStatusReducer: {
        status: [
          { id: 'todo-1', name: 'To Do', category_id: 'todo' },
          { id: 'doing-1', name: 'Doing', category_id: 'doing' },
          { id: 'done-1', name: 'Done', category_id: 'done' },
          { id: 'review-1', name: 'In Review', category_id: 'doing' },
        ],
      },
      projectReducer: {
        projectId: 'project-1',
        project: { id: 'project-1', status_category_order: ['doing', 'todo', 'done'] },
        statusCategoryOrder: ['doing', 'todo', 'done'],
      },
    } as unknown as RootState;

    expect(selectOrderedStatuses(state).map(status => status.id)).toEqual([
      'doing-1',
      'review-1',
      'todo-1',
      'done-1',
    ]);
  });
});
