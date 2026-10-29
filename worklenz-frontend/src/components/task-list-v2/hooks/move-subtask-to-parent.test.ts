import { beforeEach, describe, expect, it, vi } from 'vitest';
import { moveSubtaskToParent } from './move-subtask-to-parent';

vi.mock('@/features/task-management/task-management.slice', () => ({
  convertTaskToSubtask: (payload: unknown) => ({ type: 'convertTaskToSubtask', payload }),
  fetchSubTasks: (payload: unknown) => ({ type: 'fetchSubTasks', payload }),
  fetchTasksV3: (payload: unknown) => ({ type: 'fetchTasksV3', payload }),
}));

vi.mock('@/utils/errorLogger', () => ({
  default: { error: vi.fn(), warning: vi.fn() },
}));

vi.mock('@/shared/antd-imports', () => ({
  message: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('@/api/tasks/tasks.api.service', () => ({
  tasksApiService: { moveSubtask: vi.fn() },
}));

import { message } from '@/shared/antd-imports';

describe('moveSubtaskToParent', () => {
  const projectId = 'project-1';
  const subtaskId = 'sub-a';
  const oldParentId = 'parent-old';
  const newParentId = 'parent-new';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('awaits the move before refreshing destination so a deferred GET cannot wipe the optimistic attach', async () => {
    const order: string[] = [];
    let resolveMove!: (value: { done: boolean }) => void;
    const movePromise = new Promise<{ done: boolean }>(resolve => {
      resolveMove = resolve;
    });

    const dispatch = vi.fn((action: { type: string }) => {
      order.push(action.type);
      return Promise.resolve(action);
    });

    const pending = moveSubtaskToParent({
      subtaskId,
      newParentId,
      projectId,
      oldParentId,
      dispatch: dispatch as never,
      moveSubtaskApi: async () => {
        order.push('moveSubtask');
        return movePromise as never;
      },
    });

    // Optimistic convert ran; destination GET must not start while move is still pending.
    await Promise.resolve();
    expect(order).toEqual(['convertTaskToSubtask', 'moveSubtask']);
    expect(order).not.toContain('fetchSubTasks');

    resolveMove({ done: true });
    await pending;

    expect(order).toEqual([
      'convertTaskToSubtask',
      'moveSubtask',
      'fetchSubTasks',
      'fetchSubTasks',
    ]);
    expect(dispatch).toHaveBeenCalledWith({
      type: 'fetchSubTasks',
      payload: { taskId: newParentId, projectId },
    });
    expect(dispatch).toHaveBeenCalledWith({
      type: 'fetchSubTasks',
      payload: { taskId: oldParentId, projectId },
    });
    expect(message.success).toHaveBeenCalled();
  });

  it('restores both parent lists via fetchTasksV3 when the move fails', async () => {
    const dispatch = vi.fn((action: { type: string }) => Promise.resolve(action));

    const ok = await moveSubtaskToParent({
      subtaskId,
      newParentId,
      projectId,
      oldParentId,
      dispatch: dispatch as never,
      moveSubtaskApi: async () => ({ done: false, message: 'cycle' }) as never,
    });

    expect(ok).toBe(false);
    expect(dispatch).toHaveBeenCalledWith({ type: 'fetchTasksV3', payload: projectId });
    expect(dispatch).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: 'fetchSubTasks' })
    );
    expect(message.error).toHaveBeenCalled();
  });

  it('restores both parent lists when the move throws', async () => {
    const dispatch = vi.fn((action: { type: string }) => Promise.resolve(action));

    const ok = await moveSubtaskToParent({
      subtaskId,
      newParentId,
      projectId,
      oldParentId,
      dispatch: dispatch as never,
      moveSubtaskApi: async () => {
        throw new Error('network');
      },
    });

    expect(ok).toBe(false);
    expect(dispatch).toHaveBeenCalledWith({ type: 'fetchTasksV3', payload: projectId });
    expect(message.error).toHaveBeenCalled();
  });
});
