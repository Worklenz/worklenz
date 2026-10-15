import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { buildFlowArgs } from '../report-shell';
import { useCumulativeFlowFilters } from './use-cumulative-flow-filters';

const DATE_RANGE = { from: '2026-10-09', to: '2026-10-15' };
const SELECTION = { selectedProjects: [], selectedAssignees: [], includeSubtasks: false, includeArchived: false };

describe('buildFlowArgs', () => {
  it('reads one selected project in project scope, a band per status', () => {
    const args = buildFlowArgs({ ...SELECTION, selectedProjects: ['p1'] }, DATE_RANGE);
    expect(args.config).toMatchObject({ progressScope: 'project', projectId: 'p1' });
    expect(args.projectIds).toBeUndefined();
  });

  it('uses team scope for no or several projects and limits it to the picked ones', () => {
    expect(buildFlowArgs(SELECTION, DATE_RANGE).config).toMatchObject({ progressScope: 'team', projectId: undefined });
    const args = buildFlowArgs({ ...SELECTION, selectedProjects: ['p1', 'p2'] }, DATE_RANGE);
    expect(args.config).toMatchObject({ progressScope: 'team', projectId: undefined });
    expect(args.projectIds).toEqual(['p1', 'p2']);
  });
});

describe('useCumulativeFlowFilters', () => {
  it('builds the query args from the picked projects and assignees', () => {
    const { result } = renderHook(() => useCumulativeFlowFilters(DATE_RANGE));
    expect(result.current.flowArgs.config).toMatchObject({ progressScope: 'team' });

    act(() => result.current.updateFilters({ selectedProjects: ['p1'], selectedAssignees: ['m1'] }));
    expect(result.current.flowArgs.config).toMatchObject({ progressScope: 'project', projectId: 'p1' });
    expect(result.current.flowArgs.assigneeIds).toEqual(['m1']);
  });

  it('clears every selection on reset', () => {
    const { result } = renderHook(() => useCumulativeFlowFilters(DATE_RANGE));
    act(() =>
      result.current.updateFilters({
        selectedProjects: ['p1'],
        selectedStages: ['s1'],
        selectedAssignees: ['m1'],
        includeSubtasks: true,
        includeArchived: true,
      })
    );
    act(() => result.current.resetFilters());
    expect(result.current.filters).toEqual({
      selectedProjects: [],
      selectedStages: [],
      selectedAssignees: [],
      includeSubtasks: false,
      includeArchived: false,
    });
  });
});
