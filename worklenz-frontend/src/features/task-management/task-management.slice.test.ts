import { describe, expect, it } from 'vitest';
import { resolveTaskProgress } from './task-progress';
import taskManagementReducer, { setTaskLatestComment } from './task-management.slice';

describe('resolveTaskProgress', () => {
  it('preserves the backend ratio instead of recalculating from completed subtasks', () => {
    const task = {
      progress_value: 66.67,
      complete_ratio: 66.67,
      sub_tasks: [
        { progress_value: 100 },
        { progress_value: 100 },
      ],
    };

    expect(resolveTaskProgress(task)).toBeCloseTo(66.67, 2);
  });

  it('falls back to progress_value when complete_ratio is missing', () => {
    const task = {
      progress_value: 75,
      sub_tasks: [{ progress_value: 100 }, { progress_value: 50 }],
    };

    expect(resolveTaskProgress(task)).toBe(75);
  });

  it('uses the persisted progress value when the ratio fields disagree', () => {
    expect(resolveTaskProgress({ progress_value: 75, complete_ratio: 100, progress: 100 })).toBe(75);
  });
});

describe('setTaskLatestComment', () => {
  const createStateWithTask = () => {
    const base = taskManagementReducer(undefined, { type: '@@INIT' });
    return {
      ...base,
      entities: {
        ...base.entities,
        'task-1': { id: 'task-1', latest_comment: null, latest_comment_at: null, latest_comment_author: null },
      },
    } as unknown as ReturnType<typeof taskManagementReducer>;
  };

  it('writes the latest comment fields so the Latest Comment column can render them', () => {
    const next = taskManagementReducer(
      createStateWithTask(),
      setTaskLatestComment({
        taskId: 'task-1',
        comment: { text: '<p>hello</p>', at: '2026-10-01T10:00:00.000Z', author: 'Ada' },
      })
    );

    expect(next.entities['task-1']).toMatchObject({
      latest_comment: '<p>hello</p>',
      latest_comment_at: '2026-10-01T10:00:00.000Z',
      latest_comment_author: 'Ada',
    });
  });

  it('clears the fields when the task has no comments left', () => {
    const next = taskManagementReducer(
      createStateWithTask(),
      setTaskLatestComment({
        taskId: 'task-1',
        comment: { text: '<p>hello</p>', at: '2026-10-01T10:00:00.000Z', author: 'Ada' },
      })
    );
    const cleared = taskManagementReducer(next, setTaskLatestComment({ taskId: 'task-1', comment: null }));

    expect(cleared.entities['task-1']).toMatchObject({
      latest_comment: null,
      latest_comment_at: null,
      latest_comment_author: null,
    });
  });

  it('ignores tasks that are not in the store', () => {
    const state = createStateWithTask();
    const next = taskManagementReducer(
      state,
      setTaskLatestComment({ taskId: 'missing', comment: { text: 'x' } })
    );

    expect(next.entities['missing']).toBeUndefined();
  });
});
