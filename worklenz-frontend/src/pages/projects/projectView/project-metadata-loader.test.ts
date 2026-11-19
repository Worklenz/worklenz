import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppDispatch } from '@/app/store';
const mocks = vi.hoisted(() => ({ getFilters: vi.fn() }));

vi.mock('@/features/project/project.slice', () => ({ getProject: () => ({ type: 'project' }) }));
vi.mock('@/features/taskAttributes/taskStatusSlice', () => ({
  fetchStatuses: () => ({ type: 'statuses' }),
  fetchStatusesCategories: () => ({ type: 'categories' }),
}));
vi.mock('@/features/taskAttributes/taskLabelSlice', () => ({
  fetchLabels: () => ({ type: 'global-labels' }),
}));
vi.mock('@/features/tasks/tasks.slice', () => ({
  getFiltersFromLocalStorage: mocks.getFilters,
  fetchTaskAssignees: () => ({ type: 'assignees' }),
  fetchLabelsByProject: () => ({ type: 'labels' }),
}));
vi.mock('@/features/task-management/task-management.slice', () => ({
  fetchTaskListColumns: () => ({ type: 'columns' }),
  fetchTasksV3: (projectId: string) => ({ type: 'tasks', projectId }),
}));
vi.mock('@/features/projects/singleProject/phase/phases.slice', () => ({
  fetchPhasesByProjectId: () => ({ type: 'phases' }),
}));
import { loadProjectMetadata, startInitialTaskListLoad } from './project-metadata-loader';

beforeEach(() => mocks.getFilters.mockReturnValue({ members: ['member'], labels: ['label'] }));

describe('project metadata startup', () => {
  it('makes the list shell ready while its task request is still pending', async () => {
    let finishRequest: () => void = () => {};
    const pending = new Promise<void>(resolve => {
      finishRequest = resolve;
    });
    const dispatch = vi.fn(() => pending);
    const shellReady = vi.fn(() =>
      expect(dispatch).toHaveBeenCalledExactlyOnceWith({ type: 'tasks', projectId: 'project' })
    );
    const loading = startInitialTaskListLoad(dispatch as unknown as AppDispatch, {
      projectId: 'project',
      tab: 'tasks-list',
      hasTaskDeepLink: false,
      onShellReady: shellReady,
    });
    expect(shellReady).toHaveBeenCalledOnce();
    expect(loading).toBe(pending);
    finishRequest();
    await loading;
    expect(dispatch).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['backlog', false],
    ['saved-view:custom', false],
    ['tasks-list', true],
  ] as const)('keeps the existing startup order for %s (task link: %s)', (tab, hasTaskDeepLink) => {
    const dispatch = vi.fn(() => Promise.resolve());
    const shellReady = vi.fn();
    startInitialTaskListLoad(dispatch as unknown as AppDispatch, {
      projectId: 'project',
      tab,
      hasTaskDeepLink,
      onShellReady: shellReady,
    });
    expect(dispatch).toHaveBeenCalledOnce();
    expect(shellReady).not.toHaveBeenCalled();
  });
  it.each([null, { members: [], labels: [] }])(
    'does not wait for empty member/label selections: %s',
    async filters => {
      mocks.getFilters.mockReturnValue(filters);
      const pending = new Map<string, () => void>();
      const dispatch = vi.fn(
        (action: { type: string }) =>
          new Promise<void>(resolve => pending.set(action.type, resolve))
      );
      const loading = loadProjectMetadata(dispatch as unknown as AppDispatch, 'project', true);
      for (const key of ['project', 'statuses', 'columns']) pending.get(key)?.();
      await loading;
      expect(mocks.getFilters).toHaveBeenCalledWith('project');
      for (const key of ['assignees', 'labels']) {
        expect(dispatch.mock.calls.filter(([action]) => action.type === key)).toHaveLength(1);
      }
    }
  );

  it.each([
    [{ members: ['member'], labels: [] }, 'assignees'],
    [{ members: [], labels: ['label'] }, 'labels'],
  ] as const)('waits only for the selected filter entities: %s', async (filters, required) => {
    mocks.getFilters.mockReturnValue(filters);
    const pending = new Map<string, () => void>();
    const dispatch = vi.fn(
      (action: { type: string }) => new Promise<void>(resolve => pending.set(action.type, resolve))
    );
    let completed = false;
    const loading = loadProjectMetadata(dispatch as unknown as AppDispatch, 'project', true).then(
      () => {
        completed = true;
      }
    );
    for (const key of ['project', 'statuses', 'columns']) pending.get(key)?.();
    await Promise.resolve();
    expect(completed).toBe(false);
    pending.get(required)?.();
    await loading;
    expect(completed).toBe(true);
  });
  it('retains the phase dependency for backlog sprint filters', async () => {
    const pending = new Map<string, () => void>();
    const dispatch = vi.fn(
      (action: { type: string }) => new Promise<void>(resolve => pending.set(action.type, resolve))
    );
    let completed = false;
    const loading = loadProjectMetadata(
      dispatch as unknown as AppDispatch,
      'project',
      true,
      true
    ).then(() => {
      completed = true;
    });
    for (const key of ['project', 'statuses', 'columns', 'assignees', 'labels'])
      pending.get(key)?.();
    await Promise.resolve();
    expect(completed).toBe(false);
    pending.get('phases')?.();
    await loading;
    expect(completed).toBe(true);
    expect(dispatch.mock.calls.filter(([action]) => action.type === 'phases')).toHaveLength(1);
  });
  it('does not wait for decorative lookups but retains column and saved-filter dependencies', async () => {
    const pending = new Map<string, () => void>();
    const dispatch = vi.fn(
      (action: { type: string }) => new Promise<void>(resolve => pending.set(action.type, resolve))
    );
    let completed = false;
    const loading = loadProjectMetadata(dispatch as unknown as AppDispatch, 'project', true).then(
      result => {
        completed = true;
        return result;
      }
    );
    expect([...pending.keys()]).toEqual([
      'project',
      'statuses',
      'columns',
      'assignees',
      'labels',
      'global-labels',
      'phases',
      'categories',
    ]);
    for (const key of ['project', 'statuses', 'assignees', 'labels']) pending.get(key)?.();
    await Promise.resolve();
    expect(completed).toBe(false);
    pending.get('columns')?.();
    await loading;
    expect(completed).toBe(true);
    expect(dispatch).toHaveBeenCalledTimes(8);
  });
});
