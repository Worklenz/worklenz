import { useCallback } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { useAnalyticsProjectOptionsLoader } from './useAnalyticsProjectOptionsLoader';
import { usePersistedAnalyticsFilters } from './usePersistedAnalyticsFilters';
import { useScopedAnalyticsProjectSeed } from './useScopedAnalyticsProjectSeed';

vi.mock('@/utils/session-helper', () => ({
  getUserSession: () => ({ id: 'user-1', team_id: 'team-1' }),
}));

beforeEach(() => sessionStorage.clear());

it('seeds the same team independently when switching custom reports', async () => {
  const teams = ['team-1'];
  const hook = renderHook(({ id }) => {
    const filters = usePersistedAnalyticsFilters({ reportKind: 'budget', customTemplateId: id });
    const seeded = useScopedAnalyticsProjectSeed(id);
    const load = useCallback(async (teamIds: string[], isCurrent: () => boolean) => {
      const projects = await Promise.resolve(['recent-project']);
      if (!isCurrent()) return;
      filters.setAutomaticProjectIds(prev => {
        if (prev.length) { seeded.current = teamIds[0]; return prev; }
        if (seeded.current === teamIds[0]) return prev;
        seeded.current = teamIds[0];
        return projects;
      });
    }, [seeded, filters.setAutomaticProjectIds]);
    useAnalyticsProjectOptionsLoader(teams, id, load);
    return filters;
  }, { initialProps: { id: 'first' } });
  await waitFor(() => expect(hook.result.current.selectedProjectIds).toEqual(['recent-project']));
  hook.rerender({ id: 'second' });
  await waitFor(() => expect(hook.result.current.selectedProjectIds).toEqual(['recent-project']));
  act(() => hook.result.current.setSelectedProjectIds([]));
  hook.rerender({ id: 'first' });
  await waitFor(() => expect(hook.result.current.selectedProjectIds).toEqual(['recent-project']));
  hook.rerender({ id: 'second' });
  await waitFor(() => expect(hook.result.current.selectedProjectIds).toEqual([]));
});
