import { act, renderHook } from '@testing-library/react';
import { expect, it } from 'vitest';
import { useScopedAnalyticsSeriesData } from './useScopedAnalyticsSeriesData';

it('hides the previous report while the new report is loading', () => {
  const hook = renderHook(({ scope, filters }) => useScopedAnalyticsSeriesData<{ projects: string[] }>(scope, JSON.stringify([scope, filters])), {
    initialProps: { scope: 'report-a', filters: 'team-a' },
  });
  act(() => hook.result.current.setData({ projects: ['project-a'] }));
  expect(hook.result.current.data?.projects).toEqual(['project-a']);
  hook.rerender({ scope: 'report-b', filters: 'team-b' });
  expect(hook.result.current.data).toBeNull();
  expect(hook.result.current.matchingData).toBeNull();
  act(() => hook.result.current.setData({ projects: ['project-b'] }));
  expect(hook.result.current.data?.projects).toEqual(['project-b']);
});

it('does not expose previous-team data for fallback project seeding', () => {
  const hook = renderHook(({ filters }) => useScopedAnalyticsSeriesData<{ projects: string[] }>('report', filters), {
    initialProps: { filters: 'team-a' },
  });
  act(() => hook.result.current.setData({ projects: ['project-a'] }));
  hook.rerender({ filters: 'team-b' });
  expect(hook.result.current.matchingData).toBeNull();
  act(() => hook.result.current.setData({ projects: ['project-b'] }));
  expect(hook.result.current.matchingData?.projects).toEqual(['project-b']);
});
