import { describe, expect, it } from 'vitest';
import taskReducer, {
  fetchLabelsByProject,
  fetchTaskAssignees,
  resetTaskListData,
  setTaskListProjectId,
  saveFiltersToLocalStorage,
  restoreFilters,
  restoreStatusFilters,
  persistFilters,
  getFiltersFromLocalStorage,
} from '@/features/tasks/tasks.slice';
import phaseReducer, {
  fetchPhasesByProjectId,
} from '@/features/projects/singleProject/phase/phases.slice';

describe('project filter data loading', () => {
  it('keeps empty filters intact when their entities arrive after restoration', () => {
    saveFiltersToLocalStorage(
      {
        priorities: [],
        phases: [],
        members: [],
        statuses: [],
        labels: [],
        search: '',
        archived: false,
      },
      'fast-project'
    );
    let state = taskReducer(undefined, setTaskListProjectId('fast-project'));
    state = taskReducer(state, fetchLabelsByProject.pending('late-labels', 'fast-project'));
    state = taskReducer(state, fetchTaskAssignees.pending('late-members', 'fast-project'));
    state = taskReducer(state, restoreFilters());
    state = taskReducer(state, restoreStatusFilters([]));
    state = taskReducer(
      state,
      fetchLabelsByProject.fulfilled(
        [{ id: 'label', name: 'Label' }],
        'late-labels',
        'fast-project'
      )
    );
    state = taskReducer(
      state,
      fetchTaskAssignees.fulfilled(
        [{ id: 'member', name: 'Member', selected: false }],
        'late-members',
        'fast-project'
      )
    );
    expect(state.labels.every(label => !label.selected)).toBe(true);
    expect(state.taskAssignees.every(member => !member.selected)).toBe(true);
    state = taskReducer(state, persistFilters());
    expect(getFiltersFromLocalStorage('fast-project')).toMatchObject({ labels: [], members: [] });
  });
  it('records successful empty results and ignores responses from an older project', () => {
    let state = taskReducer(undefined, { type: 'init' });
    state = taskReducer(state, fetchLabelsByProject.pending('labels-a', 'a'));
    state = taskReducer(state, fetchLabelsByProject.pending('labels-b', 'b'));
    state = taskReducer(state, fetchLabelsByProject.fulfilled([], 'labels-a', 'a'));
    expect(state.labelsProjectId).toBeNull();
    state = taskReducer(state, fetchLabelsByProject.fulfilled([], 'labels-b', 'b'));
    expect(state.labelsProjectId).toBe('b');
    expect(state.labelsLoadingProjectId).toBeNull();

    state = taskReducer(state, fetchTaskAssignees.pending('members-a', 'a'));
    state = taskReducer(state, fetchTaskAssignees.rejected(new Error('offline'), 'members-a', 'a'));
    expect(state.assigneesProjectId).toBeNull();
    expect(state.assigneesLoadingProjectId).toBeNull();
    state = taskReducer(state, fetchTaskAssignees.pending('members-b', 'b'));
    state = taskReducer(state, fetchTaskAssignees.fulfilled([], 'members-b', 'b'));
    expect(state.assigneesProjectId).toBe('b');
    state = taskReducer(state, resetTaskListData());
    expect(state.labelsProjectId).toBeNull();
    expect(state.assigneesProjectId).toBeNull();
  });

  it('tracks phase requests by project and discards superseded results', () => {
    let state = phaseReducer(undefined, { type: 'init' });
    state = phaseReducer(state, fetchPhasesByProjectId.pending('phase-a', 'a'));
    state = phaseReducer(state, fetchPhasesByProjectId.pending('phase-b', 'b'));
    state = phaseReducer(
      state,
      fetchPhasesByProjectId.fulfilled({ done: true, body: [] }, 'phase-a', 'a')
    );
    expect(state.loadedProjectId).toBeNull();
    state = phaseReducer(
      state,
      fetchPhasesByProjectId.fulfilled({ done: true, body: [] }, 'phase-b', 'b')
    );
    expect(state.loadedProjectId).toBe('b');
    state = phaseReducer(state, fetchPhasesByProjectId.pending('phase-a2', 'a'));
    expect(state.loadedProjectId).toBeNull();
    state = phaseReducer(
      state,
      fetchPhasesByProjectId.rejected(new Error('offline'), 'phase-a2', 'a')
    );
    expect(state.loadingProjectId).toBeNull();
    expect(state.loadedProjectId).toBeNull();
  });
});
