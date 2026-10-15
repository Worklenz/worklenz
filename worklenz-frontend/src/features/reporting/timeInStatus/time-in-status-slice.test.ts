import { describe, expect, it } from 'vitest';
import reducer, {
  resetFilters,
  resetTimeInStatus,
  setIncludeArchived,
  setIndex,
  setPageSize,
  setSearchQuery,
  setSelectedProjects,
  setSort,
  setViewMode,
  toggleColumn,
} from './time-in-status-slice';

const initial = reducer(undefined, { type: 'init' });

describe('time-in-status slice', () => {
  it('goes back to page 1 when a filter, search or sort changes', () => {
    let state = reducer(initial, setIndex(4));
    state = reducer(state, setSearchQuery('login'));
    expect(state.index).toBe(1);

    state = reducer(reducer(state, setIndex(3)), setSelectedProjects(['p1']));
    expect(state.index).toBe(1);

    state = reducer(reducer(state, setIndex(3)), setIncludeArchived(true));
    expect(state.index).toBe(1);

    state = reducer(reducer(state, setIndex(3)), setSort({ field: 'name', order: 'asc' }));
    expect(state).toMatchObject({ index: 1, field: 'name', order: 'asc' });

    state = reducer(reducer(state, setIndex(3)), setPageSize(50));
    expect(state).toMatchObject({ index: 1, pageSize: 50 });
  });

  it('falls back to the longest time in status when the sort is cleared', () => {
    const sorted = reducer(initial, setSort({ field: 'name', order: 'asc' }));
    expect(reducer(sorted, setSort(null))).toMatchObject({ field: 'hours_in_status', order: 'desc' });
  });

  it('clears filters but keeps the view, sort and column choices', () => {
    let state = reducer(initial, setViewMode('grouped'));
    state = reducer(state, toggleColumn('project'));
    state = reducer(state, setSelectedProjects(['p1']));
    state = reducer(state, setIncludeArchived(true));
    state = reducer(state, resetFilters());
    expect(state.selectedProjects).toEqual([]);
    expect(state.includeArchived).toBe(false);
    expect(state.viewMode).toBe('grouped');
    expect(state.columns.project).toBe(false);
  });

  it('never hides the task name column', () => {
    expect(reducer(initial, toggleColumn('name')).columns.name).toBe(true);
  });

  it('keeps saved columns when the page is left', () => {
    const state = reducer(reducer(initial, toggleColumn('assignees')), resetTimeInStatus());
    expect(state.columns.assignees).toBe(false);
    expect(state.viewMode).toBe('table');
  });
});
