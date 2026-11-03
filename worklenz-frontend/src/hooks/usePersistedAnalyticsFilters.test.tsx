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
