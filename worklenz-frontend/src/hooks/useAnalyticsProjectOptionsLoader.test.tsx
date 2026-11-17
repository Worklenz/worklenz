import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useAnalyticsProjectOptionsLoader } from './useAnalyticsProjectOptionsLoader';

describe('useAnalyticsProjectOptionsLoader', () => {
  it('ignores older project responses after teams or report scope change', async () => {
    const pending = new Map<string, (projects: string[]) => void>();
    let selected = ['new-project'];
    let options: string[] = [];
    const load = vi.fn(async (teams: string[], isCurrent: () => boolean) => {
      const projects = await new Promise<string[]>(resolve => pending.set(teams[0], resolve));
      if (!isCurrent()) return;
      options = projects;
      selected = selected.filter(id => projects.includes(id));
    });
    const hook = renderHook(({ teams, scope }) => useAnalyticsProjectOptionsLoader(teams, scope, load), {
      initialProps: { teams: ['old-team'], scope: 'first-report' },
    });
    hook.rerender({ teams: ['new-team'], scope: 'second-report' });
    await act(async () => pending.get('new-team')?.(['new-project']));
    await act(async () => pending.get('old-team')?.(['old-project']));
    expect(options).toEqual(['new-project']);
    expect(selected).toEqual(['new-project']);
  });

  it('invalidates a request when only report scope changes or the component unmounts', async () => {
    const pending: Array<() => void> = [];
    const applied = vi.fn();
    const load = async (_teams: string[], isCurrent: () => boolean) => {
      await new Promise<void>(resolve => pending.push(resolve));
      if (isCurrent()) applied();
    };
    const teams = ['team'];
    const hook = renderHook(({ scope }) => useAnalyticsProjectOptionsLoader(teams, scope, load), {
      initialProps: { scope: 'first' },
    });
    hook.rerender({ scope: 'second' });
    await act(async () => pending[0]());
    expect(applied).not.toHaveBeenCalled();
    hook.unmount();
    await act(async () => pending[1]());
    expect(applied).not.toHaveBeenCalled();
  });
});

it('preserves selected projects when a team returns an incomplete response', async () => {
  const { areAnalyticsProjectResponsesComplete } = await import('./useAnalyticsProjectOptionsLoader');
  let selected = ['project-a', 'project-b'];
  const responses = [{ done: true, body: [{ id: 'project-a' }] }, { done: false, body: null }];
  if (areAnalyticsProjectResponsesComplete(responses)) {
    const ids = responses.flatMap(response => Array.isArray(response.body) ? response.body.map(project => project.id) : []);
    selected = selected.filter(id => ids.includes(id));
  }
  expect(selected).toEqual(['project-a', 'project-b']);
  expect(areAnalyticsProjectResponsesComplete([{ done: true, body: [] }])).toBe(true);
  expect(areAnalyticsProjectResponsesComplete([{ done: true, body: null }])).toBe(false);
});
