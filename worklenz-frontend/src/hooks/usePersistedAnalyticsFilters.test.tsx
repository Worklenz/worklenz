import React from 'react';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  hasMeaningfulAnalyticsFilters,
  usePersistedAnalyticsFilters,
} from './usePersistedAnalyticsFilters';

vi.mock('@/utils/session-helper', () => ({
  getUserSession: () => ({ id: 'user-1', team_id: 'team-1' }),
}));

describe('usePersistedAnalyticsFilters', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('restores previously applied project filters after remount', () => {
    const { result, unmount } = renderHook(() =>
      usePersistedAnalyticsFilters({ reportKind: 'velocity' })
    );

    act(() => {
      result.current.setSelectedProjectIds(['proj-a', 'proj-b']);
      result.current.setDatePreset('last_7_days');
    });

    unmount();

    const { result: restored } = renderHook(() =>
      usePersistedAnalyticsFilters({ reportKind: 'velocity' })
    );

    expect(restored.current.wasRestored).toBe(true);
    expect(restored.current.selectedProjectIds).toEqual(['proj-a', 'proj-b']);
    expect(restored.current.datePreset).toBe('last_7_days');
  });

  it('keeps filters isolated per report kind', () => {
    const velocity = renderHook(() =>
      usePersistedAnalyticsFilters({ reportKind: 'velocity' })
    );
    act(() => {
      velocity.result.current.setSelectedProjectIds(['only-velocity']);
    });
    velocity.unmount();

    const { result: utilization } = renderHook(() =>
      usePersistedAnalyticsFilters({ reportKind: 'utilization' })
    );
    expect(utilization.current.selectedProjectIds).toEqual([]);
    expect(utilization.current.wasRestored).toBe(false);
  });
});

describe('hasMeaningfulAnalyticsFilters', () => {
  it('detects non-default project selections', () => {
    expect(
      hasMeaningfulAnalyticsFilters({
        selectedProjectIds: ['p1'],
      })
    ).toBe(true);
    expect(hasMeaningfulAnalyticsFilters({})).toBe(false);
  });
});

it('restores the correct filters when the custom report changes without remounting', () => {
  const hook = renderHook(({ id }) => usePersistedAnalyticsFilters({ reportKind: 'velocity', customTemplateId: id }), { initialProps: { id: 'one' } });
  act(() => hook.result.current.setSelectedProjectIds(['one-project']));
  hook.rerender({ id: 'two' });
  expect(hook.result.current.selectedProjectIds).toEqual([]);
  act(() => hook.result.current.setSelectedProjectIds(['two-project']));
  hook.rerender({ id: 'one' });
  expect(hook.result.current.selectedProjectIds).toEqual(['one-project']);
  hook.rerender({ id: 'two' });
  expect(hook.result.current.selectedProjectIds).toEqual(['two-project']);
});

it('does not treat the seeded session team as a user selection', () => {
  expect(hasMeaningfulAnalyticsFilters({ selectedTeamIds: ['team-1'] })).toBe(false);
  expect(hasMeaningfulAnalyticsFilters({ selectedTeamIds: ['team-2'] })).toBe(true);
});

it('does not persist automatic team and project defaults until a filter is explicitly applied', () => {
  sessionStorage.clear();
  const first = renderHook(() => usePersistedAnalyticsFilters({ reportKind: 'budget' }));
  act(() => {
    first.result.current.setAutomaticTeamIds(['team-1']);
    first.result.current.setAutomaticProjectIds(['seeded-project']);
  });
  first.unmount();
  const second = renderHook(() => usePersistedAnalyticsFilters({ reportKind: 'budget' }));
  expect(second.result.current.wasRestored).toBe(false);
  act(() => second.result.current.setSelectedProjectIds(['user-project']));
  second.unmount();
  const third = renderHook(() => usePersistedAnalyticsFilters({ reportKind: 'budget' }));
  expect(third.result.current.selectedProjectIds).toEqual(['user-project']);
});

it('keeps setters bound to the active custom report after its identity changes', () => {
  sessionStorage.clear();
  const hook = renderHook(({ id }) => usePersistedAnalyticsFilters({ reportKind: 'velocity', customTemplateId: id }), { initialProps: { id: 'one' } });
  const originalSetter = hook.result.current.setSelectedProjectIds;
  hook.rerender({ id: 'two' });
  act(() => originalSetter(['two-project']));
  expect(hook.result.current.selectedProjectIds).toEqual(['two-project']);
  hook.rerender({ id: 'one' });
  expect(hook.result.current.selectedProjectIds).toEqual([]);
  hook.rerender({ id: 'two' });
  expect(hook.result.current.selectedProjectIds).toEqual(['two-project']);
});


it('recognizes legacy meaningful filters and explicit empty selections', () => {
  sessionStorage.clear();
  const key = 'worklenz.analyticsReportFilters:team-1:user-1:velocity:custom:tpl';
  sessionStorage.setItem(key, JSON.stringify({ selectedProjectIds: ['project'] }));
  const legacy = renderHook(() => usePersistedAnalyticsFilters({ reportKind: 'velocity', customTemplateId: 'tpl' }));
  expect(legacy.result.current.hasRestoredFilters).toBe(true);
  act(() => legacy.result.current.setSelectedProjectIds([]));
  legacy.unmount();
  const reopened = renderHook(() => usePersistedAnalyticsFilters({ reportKind: 'velocity', customTemplateId: 'tpl' }));
  expect(reopened.result.current.hasRestoredFilters).toBe(true);
  expect(reopened.result.current.selectedProjectIds).toEqual([]);
});
