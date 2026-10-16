import { act, renderHook } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { projectDocumentsApiService } from '@/api/projects/docs/project-documents.api.service';
import { useDocsAutosave } from './use-docs-autosave';

vi.mock('@/api/projects/docs/project-documents.api.service', () => ({
  projectDocumentsApiService: { update: vi.fn() },
}));

const update = vi.mocked(projectDocumentsApiService.update);
const content = (text: string) =>
  ({ version: 1, sections: [{ id: 'p1', type: 'paragraph', content: [{ type: 'text', text }] }] }) as never;
const saved = (updatedAt: string, text: string) =>
  ({ status: 'saved', document: { id: 'doc', title: 'Title', content: content(text), updated_at: updatedAt } }) as never;

beforeEach(() => update.mockReset());

it('never sends two saves of the same page with the same timestamp', async () => {
  const { result } = renderHook(() => useDocsAutosave(vi.fn(), vi.fn()));
  act(() => result.current.markClean({ id: 'doc', title: 'Title', content: content('a'), updated_at: 'U0' } as never));

  let releaseFirst!: () => void;
  update.mockImplementationOnce(() => new Promise(resolve => { releaseFirst = () => resolve(saved('U1', 'b')); }));
  update.mockResolvedValueOnce(saved('U2', 'c'));

  act(() => result.current.schedule('doc', 'Title', content('b')));
  let first!: Promise<unknown>;
  act(() => { first = result.current.flush(); });
  act(() => result.current.schedule('doc', 'Title', content('c')));
  let second!: Promise<unknown>;
  act(() => { second = result.current.flush(); });

  expect(update).toHaveBeenCalledTimes(1);
  await act(async () => { releaseFirst(); await first; await second; });

  expect(update).toHaveBeenCalledTimes(2);
  expect(update.mock.calls.map(call => call[1].expected_updated_at)).toEqual(['U0', 'U1']);
  expect(result.current.saveState).toBe('saved');
});
