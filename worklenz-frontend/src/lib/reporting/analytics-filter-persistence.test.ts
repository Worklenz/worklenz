import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getAnalyticsFilterStorageKey,
  readAnalyticsFilterSession,
  resolveAnalyticsFilterReportKey,
  writeAnalyticsFilterSession,
} from './analytics-filter-persistence';
import { DEFAULT_ANALYTICS_FILTER_FIELDS } from '@/hooks/usePersistedAnalyticsFilters';

vi.mock('@/utils/session-helper', () => ({
  getUserSession: () => ({ id: 'user-1', team_id: 'team-1' }),
}));

describe('analytics-filter-persistence', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('scopes storage keys by workspace and report', () => {
    expect(getAnalyticsFilterStorageKey('velocity', 'team-1', 'user-1')).toBe(
      'worklenz.analyticsReportFilters:team-1:user-1:velocity'
    );
    expect(resolveAnalyticsFilterReportKey('velocity', 'tpl-9')).toBe(
      'velocity:custom:tpl-9'
    );
  });

  it('round-trips applied filters for the session', () => {
    writeAnalyticsFilterSession('velocity', {
      ...DEFAULT_ANALYTICS_FILTER_FIELDS,
      selectedProjectIds: ['p1', 'p2'],
      selectedMemberIds: ['m1'],
      datePreset: 'last_90_days',
    });

    const { state, wasRestored } = readAnalyticsFilterSession(
      'velocity',
      DEFAULT_ANALYTICS_FILTER_FIELDS
    );

    expect(wasRestored).toBe(true);
    expect(state.selectedProjectIds).toEqual(['p1', 'p2']);
    expect(state.selectedMemberIds).toEqual(['m1']);
    expect(state.datePreset).toBe('last_90_days');
  });

  it('returns defaults when nothing is stored', () => {
    const { state, wasRestored } = readAnalyticsFilterSession(
      'utilization',
      DEFAULT_ANALYTICS_FILTER_FIELDS
    );
    expect(wasRestored).toBe(false);
    expect(state).toEqual(DEFAULT_ANALYTICS_FILTER_FIELDS);
  });
  it('ignores non-string IDs in stored filters', () => {
    sessionStorage.setItem(getAnalyticsFilterStorageKey('velocity', 'team-1', 'user-1'),
      JSON.stringify({ selectedProjectIds: [null, {}, 42, '', 'valid'] }));
    expect(readAnalyticsFilterSession('velocity', DEFAULT_ANALYTICS_FILTER_FIELDS).state.selectedProjectIds).toEqual(['valid']);
  });

});
