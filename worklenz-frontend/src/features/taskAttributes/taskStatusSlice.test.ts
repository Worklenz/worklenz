import { describe, expect, it } from 'vitest';
import taskStatusReducer, { fetchStatuses } from './taskStatusSlice';

describe('taskStatusSlice fetchStatuses', () => {
  it('replaces the shared project status catalog with the latest server payload', () => {
    const previousState = {
      status: [],
      statusCategories: [],
      loading: false,
      error: null,
      initialized: false,
    };

    const nextState = taskStatusReducer(
      previousState,
      fetchStatuses.fulfilled(
        [
          {
            id: 'status-1',
            name: 'Backlog',
            color_code: '#1890ff',
            color_code_dark: '#1d4ed8',
            category_id: 'todo',
          },
        ],
        'requestId',
        'project-1'
      )
    );

    expect(nextState.status).toHaveLength(1);
    expect(nextState.status[0].name).toBe('Backlog');
    expect(nextState.initialized).toBe(true);
  });
});
