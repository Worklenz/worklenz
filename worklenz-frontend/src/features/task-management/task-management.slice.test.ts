import { describe, expect, it } from 'vitest';
import { resolveTaskProgress } from './task-progress';
import taskManagementReducer, {
  bulkUpdateTaskStatuses,
  convertTaskToSubtask,
  fetchSubTasks,
  setTaskLatestComment,
  updateTask,
} from './task-management.slice';

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
        comment: {
          id: 'comment-1',
          text: '<p>hello</p>',
          at: '2026-10-01T10:00:00.000Z',
          author: 'Ada',
        },
      })
    );

    expect(next.entities['task-1']).toMatchObject({
      latest_comment_id: 'comment-1',
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
      latest_comment_id: null,
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

describe('task status group updates', () => {
  const task = (id: string, status: string) => ({
    id,
    status,
    priority: 'low',
    created_at: '',
    updated_at: '',
  });

  const createState = () => {
    const base = taskManagementReducer(undefined, { type: '@@INIT' });
    return {
      ...base,
      grouping: 'status',
      entities: {
        'task-1': task('task-1', 'status-a'),
        'task-2': task('task-2', 'status-a'),
        'task-3': task('task-3', 'status-b'),
      },
      ids: ['task-1', 'task-2', 'task-3'],
      groups: [
        { id: 'status-a', title: 'Status A', taskIds: ['task-1', 'task-2'], type: 'status' },
        { id: 'status-b', title: 'Status B', taskIds: ['task-3'], type: 'status' },
      ],
    } as unknown as ReturnType<typeof taskManagementReducer>;
  };

  it('moves an updated task between status groups', () => {
    const next = taskManagementReducer(
      createState(),
      updateTask({ ...task('task-1', 'status-b') })
    );

    expect(next.groups.find(group => group.id === 'status-a')?.taskIds).toEqual(['task-2']);
    expect(next.groups.find(group => group.id === 'status-b')?.taskIds).toEqual([
      'task-1',
      'task-3',
    ]);
  });

  it('moves a bulk status update in one reducer action', () => {
    const next = taskManagementReducer(
      createState(),
      bulkUpdateTaskStatuses({
        taskIds: ['task-1', 'task-2'],
        statusId: 'status-b',
        updatedAt: '2026-01-01T00:00:00.000Z',
      })
    );

    expect(next.groups.find(group => group.id === 'status-a')?.taskIds).toEqual([]);
    expect(next.groups.find(group => group.id === 'status-b')?.taskIds).toEqual([
      'task-2',
      'task-1',
      'task-3',
    ]);
    expect(next.entities['task-1']).toMatchObject({
      status: 'status-b',
      updatedAt: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    });
  });

  it('keeps nested subtasks out of top-level groups for single and bulk status changes', () => {
    const state = createState();
    const subtask = { ...task('subtask', 'status-a'), parent_task_id: 'task-1' };
    state.entities.subtask = subtask as never;
    state.ids.push('subtask');
    const single = taskManagementReducer(state, updateTask({ ...subtask, status: 'status-b' }));
    expect(single.entities.subtask?.status).toBe('status-b');
    expect(single.groups.every(group => !group.taskIds.includes('subtask'))).toBe(true);
    const bulk = taskManagementReducer(state, bulkUpdateTaskStatuses({
      taskIds: ['task-1', 'subtask'], statusId: 'status-b', updatedAt: '2026-01-01',
    }));
    expect(bulk.entities.subtask?.status).toBe('status-b');
    expect(bulk.groups.find(group => group.id === 'status-b')?.taskIds).toEqual(['task-1', 'task-3']);
  });
});

describe('convertTaskToSubtask vs stale fetchSubTasks.fulfilled', () => {
  const baseTask = (id: string, overrides: Record<string, unknown> = {}) =>
    ({
      id,
      title: id,
      name: id,
      status: 'todo',
      priority: 'low',
      progress: 0,
      ...overrides,
    }) as never;

  it('replaces destination sub_tasks and drops an optimistic move when a pre-move GET fulfills', () => {
    const base = taskManagementReducer(undefined, { type: '@@INIT' });
    const seeded = {
      ...base,
      entities: {
        'parent-old': baseTask('parent-old', {
          sub_tasks: [baseTask('sub-a', { parent_task_id: 'parent-old', is_sub_task: true })],
          sub_tasks_count: 1,
          show_sub_tasks: true,
        }),
        'parent-new': baseTask('parent-new', {
          sub_tasks: [baseTask('other', { parent_task_id: 'parent-new', is_sub_task: true })],
          sub_tasks_count: 1,
          show_sub_tasks: true,
        }),
        'sub-a': baseTask('sub-a', { parent_task_id: 'parent-old', is_sub_task: true }),
        other: baseTask('other', { parent_task_id: 'parent-new', is_sub_task: true }),
      },
      ids: ['parent-old', 'parent-new', 'sub-a', 'other'],
    } as unknown as ReturnType<typeof taskManagementReducer>;

    const afterOptimistic = taskManagementReducer(
      seeded,
      convertTaskToSubtask({ taskId: 'sub-a', parentTaskId: 'parent-new' })
    );
    expect(afterOptimistic.entities['parent-new']?.sub_tasks?.map(s => s.id)).toContain('sub-a');

    // Stale destination GET (started before move committed) returns old children only.
    const afterStaleGet = taskManagementReducer(
      afterOptimistic,
      fetchSubTasks.fulfilled(
        {
          parentTaskId: 'parent-new',
          subtasks: [{ id: 'other', name: 'other', title: 'other' }],
        } as never,
        'req-1',
        { taskId: 'parent-new', projectId: 'proj' }
      )
    );

    expect(afterStaleGet.entities['parent-new']?.sub_tasks?.map(s => s.id)).toEqual(['other']);
    expect(afterStaleGet.entities['parent-new']?.sub_tasks?.map(s => s.id)).not.toContain('sub-a');
  });
});
