import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { projectDocumentsApiService } from '@/api/projects/docs/project-documents.api.service';
import { teamDocumentsApiService } from '@/api/projects/docs/team-documents.api.service';
import { message, Modal } from '@/shared/antd-imports';
import { EMPTY_MENTIONS, IProjectDocument } from '@/types/project/project-documents.types';

import TeamDocsPage from './team-docs-page';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, options: { defaultValue: string }) => options.defaultValue,
  }),
}));
vi.mock('react-router-dom', () => ({
  useSearchParams: () => [new URLSearchParams('doc=first'), vi.fn()],
}));
vi.mock('@/hooks/useAppDispatch', () => ({ useAppDispatch: () => vi.fn() }));
vi.mock('@/hooks/useAppSelector', () => ({ useAppSelector: () => 0 }));
vi.mock('@/socket/socketContext', () => ({ useSocket: () => ({ socket: null }) }));
vi.mock('@/components/task-drawer/task-drawer', () => ({ default: () => null }));
vi.mock('@/pages/projects/project-view-1/docs/use-docs-favorites', () => ({
  useDocsFavorites: () => ({
    ids: new Set<string>(),
    pending: new Set<string>(),
    loading: false,
    hasError: false,
    retry: vi.fn(),
    toggle: vi.fn(),
  }),
}));
vi.mock('@/api/projects/docs/project-documents.api.service', () => ({
  projectDocumentsApiService: {
    getById: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  },
}));
vi.mock('@/api/projects/docs/team-documents.api.service', () => ({
  teamDocumentsApiService: {
    list: vi.fn(),
    search: vi.fn(),
    favorites: vi.fn(),
  },
}));
vi.mock('@/pages/projects/project-view-1/docs/docs-sidebar', () => ({
  default: ({
    onSelect,
    onDelete,
  }: {
    onSelect: (id: string) => void;
    onDelete: (id: string) => void;
  }) => (
    <>
      <button onClick={() => onSelect('page-b')}>Open page B</button>
      <button onClick={() => onSelect('page-c')}>Open page C</button>
      <button onClick={() => onDelete('first')}>Delete page</button>
    </>
  ),
}));
vi.mock('@/pages/projects/project-view-1/docs/DocsEditor', () => ({
  default: ({
    title,
    onTitleChange,
  }: {
    title: string;
    onTitleChange: (value: string) => void;
  }) => (
    <input
      aria-label="Page title"
      value={title}
      onChange={event => onTitleChange(event.target.value)}
    />
  ),
}));

const page = (id: string, title: string): IProjectDocument => ({
  id,
  project_id: 'project',
  parent_id: null,
  title,
  position: 0,
  updated_at: '2026-10-16T00:00:00Z',
  updated_by_name: null,
  created_at: '',
  created_by: null,
  updated_by: null,
  content: { version: 1, sections: [] },
  mentions: EMPTY_MENTIONS,
});

const first = page('first', 'First page');
const pageB = page('page-b', 'Page B');
const pageC = page('page-c', 'Page C');
const documents: Record<string, IProjectDocument> = {
  first,
  'page-b': pageB,
  'page-c': pageC,
};

const summary = (document: IProjectDocument) => ({
  id: document.id,
  project_id: document.project_id,
  parent_id: document.parent_id,
  title: document.title,
  position: document.position,
  updated_at: document.updated_at,
  updated_by_name: document.updated_by_name,
  project_name: 'Alpha',
  project_color: null,
});

const waitForAutosave = async () => {
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 900));
  });
};

beforeEach(() => {
  vi.mocked(teamDocumentsApiService.list).mockResolvedValue({
    done: true,
    body: [summary(first), summary(pageB), summary(pageC)],
  });
  vi.mocked(projectDocumentsApiService.update).mockResolvedValue({
    status: 'ok',
    document: { ...pageC, title: 'C draft', updated_at: '2026-10-21T00:00:01Z' },
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

it('keeps a newer draft when an older document response arrives later', async () => {
  let resolvePageB: (value: { done: boolean; body: IProjectDocument }) => void = () => undefined;
  vi.mocked(projectDocumentsApiService.getById).mockImplementation(id => {
    if (id === 'page-b') {
      return new Promise(resolve => {
        resolvePageB = resolve;
      });
    }
    return Promise.resolve({ done: true, body: documents[id] });
  });

  render(<TeamDocsPage />);
  await screen.findByDisplayValue('First page');

  fireEvent.click(screen.getByRole('button', { name: 'Open page B' }));
  await waitFor(() => expect(projectDocumentsApiService.getById).toHaveBeenCalledWith('page-b'));
  fireEvent.click(screen.getByRole('button', { name: 'Open page C' }));
  await screen.findByDisplayValue('Page C');
  fireEvent.change(screen.getByLabelText('Page title'), { target: { value: 'C draft' } });

  resolvePageB({ done: true, body: pageB });
  await act(async () => {
    await Promise.resolve();
  });

  expect(screen.getByLabelText('Page title')).toHaveValue('C draft');
  await waitForAutosave();
  expect(projectDocumentsApiService.update).toHaveBeenCalledWith(
    'page-c',
    expect.objectContaining({ title: 'C draft' })
  );
});

it('ignores the initial document fetch when a newer page was selected', async () => {
  let resolveFirst: (value: { done: boolean; body: IProjectDocument }) => void = () => undefined;
  vi.mocked(projectDocumentsApiService.getById).mockImplementation(id => {
    if (id === 'first') {
      return new Promise(resolve => {
        resolveFirst = resolve;
      });
    }
    return Promise.resolve({ done: true, body: documents[id] });
  });

  render(<TeamDocsPage />);
  await waitFor(() => expect(projectDocumentsApiService.getById).toHaveBeenCalledWith('first'));

  fireEvent.click(screen.getByRole('button', { name: 'Open page C' }));
  await screen.findByDisplayValue('Page C');
  fireEvent.change(screen.getByLabelText('Page title'), { target: { value: 'C draft' } });

  resolveFirst({ done: true, body: first });
  await act(async () => {
    await Promise.resolve();
  });

  expect(screen.getByLabelText('Page title')).toHaveValue('C draft');
  await waitForAutosave();
  expect(projectDocumentsApiService.update).toHaveBeenCalledWith(
    'page-c',
    expect.objectContaining({ title: 'C draft' })
  );
  expect(projectDocumentsApiService.update).not.toHaveBeenCalledWith(
    'first',
    expect.anything()
  );
});

it('shows a list error when the latest list fails after another page was selected', async () => {
  let resolveList: (value: { done: boolean; body: [] }) => void = () => undefined;
  vi.mocked(teamDocumentsApiService.list).mockImplementation(
    () =>
      new Promise(resolve => {
        resolveList = resolve;
      })
  );
  vi.mocked(projectDocumentsApiService.getById).mockImplementation(async id => ({
    done: true,
    body: documents[id],
  }));

  render(<TeamDocsPage />);
  fireEvent.click(screen.getByRole('button', { name: 'Open page C' }));
  await screen.findByDisplayValue('Page C');

  resolveList({ done: false, body: [] });
  expect(await screen.findByText("Couldn't load pages")).toBeInTheDocument();
});

it.each([
  ['returns no page', { done: false, body: null }],
  ['is rejected', new Error('offline')],
] as const)('shows an error when deleting a page %s', async (_label, failure) => {
  vi.mocked(projectDocumentsApiService.getById).mockResolvedValue({ done: true, body: first });
  if (failure instanceof Error) {
    vi.mocked(projectDocumentsApiService.remove).mockRejectedValue(failure);
  } else {
    vi.mocked(projectDocumentsApiService.remove).mockResolvedValue(failure);
  }
  const error = vi.spyOn(message, 'error').mockImplementation(() => ({}) as never);
  vi.spyOn(Modal, 'confirm').mockImplementation(options => {
    void options.onOk?.(vi.fn());
    return { destroy: vi.fn(), update: vi.fn() };
  });

  render(<TeamDocsPage />);
  await screen.findByDisplayValue('First page');
  fireEvent.click(screen.getByRole('button', { name: 'Delete page' }));

  await waitFor(() => expect(error).toHaveBeenCalled());
  expect(screen.getByLabelText('Page title')).toHaveValue('First page');
});
