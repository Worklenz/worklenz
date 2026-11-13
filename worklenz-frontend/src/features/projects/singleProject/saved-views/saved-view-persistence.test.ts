import { beforeEach, describe, expect, it } from 'vitest';
import taskReducer, {
  persistFilters,
  setPriorities,
  setSavedViewActive,
  setTaskListProjectId,
} from '@/features/tasks/tasks.slice';

const STORAGE_KEY = 'worklenz.tasklist.filters.project-a';

const stateWithFilters = () => {
  let state = taskReducer(undefined, { type: '@@init' });
  state = taskReducer(state, setTaskListProjectId('project-a'));
  return taskReducer(state, setPriorities(['high']));
};

describe('List tab filter persistence while a saved view is open', () => {
  beforeEach(() => localStorage.clear());

  it('persists filters normally', () => {
    taskReducer(stateWithFilters(), persistFilters());
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}').priorities).toEqual(['high']);
  });

  it("does not overwrite the List tab's filters with a saved view's filters", () => {
    const state = taskReducer(stateWithFilters(), setSavedViewActive(true));
    taskReducer(state, persistFilters());
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});
