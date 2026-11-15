import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  dispatch: vi.fn(),
  state: {
    projectReducer: { projectId: 'project-a' },
    priorityReducer: { priorities: ['priority'] },
    taskStatusReducer: { status: ['status'] },
    taskReducer: {
      labelsProjectId: 'project-a' as string | null,
      labelsLoadingProjectId: null as string | null,
      assigneesProjectId: 'project-a' as string | null,
      assigneesLoadingProjectId: null as string | null,
    },
    phaseReducer: {
      loadedProjectId: 'project-a' as string | null,
      loadingProjectId: null as string | null,
    },
  },
}));

vi.mock('@/hooks/useAppDispatch', () => ({ useAppDispatch: () => mocks.dispatch }));
vi.mock('@/hooks/useAppSelector', () => ({
  useAppSelector: (selector: (state: typeof mocks.state) => unknown) => selector(mocks.state),
}));
vi.mock('react-redux', () => ({ useStore: () => ({ getState: () => mocks.state }) }));
vi.mock('@/features/tasks/tasks.slice', () => ({
  fetchLabelsByProject: (projectId: string) => ({ type: 'labels', projectId }),
  fetchTaskAssignees: (projectId: string) => ({ type: 'assignees', projectId }),
}));
vi.mock('@/features/projects/singleProject/phase/phases.slice', () => ({
  fetchPhasesByProjectId: (projectId: string) => ({ type: 'phases', projectId }),
}));
vi.mock('@/features/taskAttributes/taskPrioritySlice', () => ({
  fetchPriorities: () => ({ type: 'priorities' }),
}));
vi.mock('@/features/taskAttributes/taskStatusSlice', () => ({
  fetchStatuses: () => ({ type: 'statuses' }),
}));
vi.mock('@/features/team-members/team-members.slice', () => ({
  getTeamMembers: () => ({ type: 'members' }),
}));

import { useFilterDataLoader } from './useFilterDataLoader';

describe('useFilterDataLoader', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mocks.dispatch.mockReset();
    mocks.state.taskReducer.labelsProjectId = 'project-a';
    mocks.state.taskReducer.assigneesProjectId = 'project-a';
    mocks.state.taskReducer.labelsLoadingProjectId = null;
    mocks.state.taskReducer.assigneesLoadingProjectId = null;
    mocks.state.phaseReducer.loadedProjectId = 'project-a';
    mocks.state.phaseReducer.loadingProjectId = null;
  });
  afterEach(() => vi.useRealTimers());

  it('reuses loaded data and still allows an explicit refresh', () => {
    const { result } = renderHook(() => useFilterDataLoader());
    act(() => vi.runAllTimers());
    expect(mocks.dispatch.mock.calls.map(([action]) => action.type)).toEqual(['members']);
    act(() => {
      void result.current.refreshFilterData();
    });
    expect(mocks.dispatch.mock.calls.map(([action]) => action.type)).toEqual([
      'members',
      'labels',
      'assignees',
      'statuses',
      'phases',
      'priorities',
      'members',
    ]);
  });

  it('retries missing data and joins an in-flight request', () => {
    mocks.state.taskReducer.labelsProjectId = null;
    mocks.state.taskReducer.assigneesProjectId = null;
    mocks.state.taskReducer.assigneesLoadingProjectId = 'project-a';
    mocks.state.phaseReducer.loadedProjectId = null;
    mocks.state.phaseReducer.loadingProjectId = 'project-b';
    renderHook(() => useFilterDataLoader());
    act(() => vi.runAllTimers());
    expect(mocks.dispatch.mock.calls.map(([action]) => action.type)).toEqual([
      'labels',
      'phases',
      'members',
    ]);
  });
});
