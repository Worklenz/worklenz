import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSprintPhaseRefresh } from './useSprintPhaseRefresh';

const mocks = vi.hoisted(() => ({ dispatch: vi.fn(), fetch: vi.fn(), error: vi.fn() }));
vi.mock('@/hooks/useAppDispatch', () => ({ useAppDispatch: () => mocks.dispatch }));
vi.mock('@/features/projects/singleProject/phase/phases.slice', () => ({ fetchPhasesByProjectId: mocks.fetch }));
vi.mock('@/utils/errorLogger', () => ({ default: { error: mocks.error } }));

const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.fetch.mockImplementation((projectId: string) => ({ projectId }));
  mocks.dispatch.mockImplementation(() => ({ unwrap: () => Promise.resolve() }));
});

describe('sprint refresh queue', () => {
  it('coalesces concurrent events and refreshes once more after the in-flight request', async () => {
    const pending = deferred();
    mocks.dispatch.mockReturnValueOnce({ unwrap: () => pending.promise });
    const { result } = renderHook(() => useSprintPhaseRefresh('project-a'));
    const first = result.current();
    await result.current();
    await result.current();
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
    pending.resolve();
    await first;
    expect(mocks.fetch.mock.calls).toEqual([['project-a'], ['project-a']]);
  });

  it('discards old queued refreshes when navigating to a different project', async () => {
    const pending = deferred();
    mocks.dispatch.mockReturnValueOnce({ unwrap: () => pending.promise });
    const { result, rerender } = renderHook(({ id }) => useSprintPhaseRefresh(id), { initialProps: { id: 'project-a' } });
    const first = result.current();
    await result.current();
    rerender({ id: 'project-b' });
    pending.resolve();
    await first;
    expect(mocks.fetch.mock.calls).toEqual([['project-a']]);
    await result.current();
    expect(mocks.fetch).toHaveBeenLastCalledWith('project-b');
  });

  it('refreshes the new project if an event arrives during an old project request', async () => {
    const pending = deferred();
    mocks.dispatch.mockReturnValueOnce({ unwrap: () => pending.promise });
    const { result, rerender } = renderHook(({ id }) => useSprintPhaseRefresh(id), { initialProps: { id: 'project-a' } });
    const first = result.current();
    rerender({ id: 'project-b' });
    await result.current();
    pending.resolve();
    await first;
    expect(mocks.fetch.mock.calls).toEqual([['project-a'], ['project-b']]);
  });

  it('cancels queued work when the component unmounts', async () => {
    const pending = deferred();
    mocks.dispatch.mockReturnValueOnce({ unwrap: () => pending.promise });
    const { result, unmount } = renderHook(() => useSprintPhaseRefresh('project-a'));
    const first = result.current();
    await result.current();
    unmount();
    pending.resolve();
    await act(async () => { await first; });
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
  });

  it('allows retrying after a failed refresh', async () => {
    mocks.dispatch.mockReturnValueOnce({ unwrap: () => Promise.reject(new Error('Network error')) });
    const { result } = renderHook(() => useSprintPhaseRefresh('project-a'));
    await result.current();
    await result.current();
    expect(mocks.error).toHaveBeenCalledOnce();
    expect(mocks.fetch).toHaveBeenCalledTimes(2);
  });
});
