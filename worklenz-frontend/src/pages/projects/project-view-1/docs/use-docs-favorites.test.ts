import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { projectDocumentsApiService } from '@/api/projects/docs/project-documents.api.service';
import { useDocsFavorites } from './use-docs-favorites';

vi.mock('@/api/projects/docs/project-documents.api.service', () => ({
  projectDocumentsApiService: { favorites: vi.fn(), setFavorite: vi.fn() },
}));
beforeEach(() => {
  vi.mocked(projectDocumentsApiService.favorites)
    .mockReset()
    .mockResolvedValue({ done: true, body: ['saved'] });
  vi.mocked(projectDocumentsApiService.setFavorite).mockReset();
});
afterEach(cleanup);

it('optimistically toggles favorites, prevents duplicate requests, and rolls back failed writes', async () => {
  let rejectWrite: (error: Error) => void = () => undefined;
  vi.mocked(projectDocumentsApiService.setFavorite).mockImplementation(
    () =>
      new Promise((_resolve, reject) => {
        rejectWrite = reject;
      })
  );
  const { result } = renderHook(() => useDocsFavorites('project'));
  await waitFor(() => expect(result.current.loading).toBe(false));
  let update: Promise<boolean | undefined>;
  act(() => {
    update = result.current.toggle('saved');
  });
  expect(result.current.ids.has('saved')).toBe(false);
  expect(result.current.pending.has('saved')).toBe(true);
  await act(() => result.current.toggle('saved'));
  expect(projectDocumentsApiService.setFavorite).toHaveBeenCalledTimes(1);
  await act(async () => {
    rejectWrite(new Error('offline'));
    await update;
  });
  expect(result.current.ids.has('saved')).toBe(true);
  expect(result.current.pending.size).toBe(0);
  vi.mocked(projectDocumentsApiService.setFavorite).mockResolvedValue({
    done: true,
    body: { favorite: false },
  });
  await act(() => result.current.toggle('saved'));
  expect(result.current.ids.has('saved')).toBe(false);
});

it('shows a recoverable load error and prevents writes until favorites are loaded', async () => {
  vi.mocked(projectDocumentsApiService.favorites).mockRejectedValueOnce(new Error('offline'));
  const { result } = renderHook(() => useDocsFavorites('project'));
  await waitFor(() => expect(result.current.hasError).toBe(true));
  await act(() => result.current.toggle('page'));
  expect(projectDocumentsApiService.setFavorite).not.toHaveBeenCalled();
  act(() => result.current.retry());
  await waitFor(() => expect(result.current.ids.has('saved')).toBe(true));
  expect(result.current.hasError).toBe(false);
});

it('ignores an earlier project response after navigation', async () => {
  let resolveOld: (value: { done: boolean; body: string[] }) => void = () => undefined;
  vi.mocked(projectDocumentsApiService.favorites).mockImplementationOnce(
    () =>
      new Promise(resolve => {
        resolveOld = resolve;
      })
  );
  const { result, rerender } = renderHook(({ projectId }) => useDocsFavorites(projectId), {
    initialProps: { projectId: 'old' },
  });
  rerender({ projectId: 'new' });
  await waitFor(() => expect(result.current.loading).toBe(false));
  await act(async () => {
    resolveOld({ done: true, body: ['private-old-page'] });
  });
  expect([...result.current.ids]).toEqual(['saved']);
});
