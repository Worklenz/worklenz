import { describe, expect, it } from 'vitest';
import type { RootState } from '@/app/store';
import { selectShouldFetchInitialTaskList } from './task-management.selectors';

const makeState = (overrides: Partial<RootState['taskManagement']> = {}) =>
  ({
    taskManagement: {
      loadedProjectId: null,
      loading: false,
      loadingColumns: false,
      error: null,
      ...overrides,
    },
  }) as RootState;

describe('initial task request ownership', () => {
  it('reuses the project initializer request and waits for pending column metadata', () => {
    expect(selectShouldFetchInitialTaskList(makeState({ loading: true }), 'project')).toBe(false);
    expect(selectShouldFetchInitialTaskList(makeState({ loadingColumns: true }), 'project')).toBe(
      false
    );
    expect(
      selectShouldFetchInitialTaskList(makeState({ loadedProjectId: 'project' }), 'project')
    ).toBe(false);
  });

  it('allows standalone list initialization but leaves errors visible for an explicit retry', () => {
    expect(selectShouldFetchInitialTaskList(makeState(), 'project')).toBe(true);
    expect(
      selectShouldFetchInitialTaskList(makeState({ loadedProjectId: 'other' }), 'project')
    ).toBe(true);
    expect(
      selectShouldFetchInitialTaskList(makeState({ error: 'Request failed' }), 'project')
    ).toBe(false);
    expect(selectShouldFetchInitialTaskList(makeState())).toBe(false);
  });
});
