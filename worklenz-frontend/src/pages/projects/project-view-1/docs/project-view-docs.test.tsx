import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { projectDocumentsApiService } from '@/api/projects/docs/project-documents.api.service';
import { EMPTY_MENTIONS, IProjectDocument } from '@/types/project/project-documents.types';
import ProjectViewDocs from './project-view-docs';
import { Modal } from '@/shared/antd-imports';

const mocks = vi.hoisted(() => ({ setSearchParams: vi.fn(), dispatch: vi.fn() }));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, options: { defaultValue: string }) => options.defaultValue,
  }),
}));
vi.mock('react-router-dom', () => ({
  useParams: () => ({ projectId: 'project' }),
  useSearchParams: () => [new URLSearchParams('doc=first'), mocks.setSearchParams],
}));
vi.mock('@/hooks/useAppDispatch', () => ({ useAppDispatch: () => mocks.dispatch }));
vi.mock('@/hooks/useAppSelector', () => ({ useAppSelector: () => 0 }));
vi.mock('@/socket/socketContext', () => ({ useSocket: () => ({ socket: null }) }));
vi.mock('./use-docs-favorites', () => ({
  useDocsFavorites: () => ({
    ids: new Set(),
    pending: new Set(),
    loading: false,
    hasError: false,
    retry: vi.fn(),
    toggle: vi.fn(),
  }),
}));
vi.mock('@/api/projects/docs/project-documents.api.service', () => ({
  projectDocumentsApiService: {
    list: vi.fn(),
    getById: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
    duplicate: vi.fn(),
    remove: vi.fn(),
  },
}));
vi.mock('./docs-sidebar', () => ({
  default: ({
    onSelect,
    onCreate,
    onDuplicate,
    onDelete,
  }: {
    onSelect: (id: string) => void;
    onCreate: (id: null) => void;
    onDuplicate: (id: string) => void;
    onDelete: (id: string) => void;
  }) => (
    <>
      <button onClick={() => onSelect('second')}>Open another page</button>
      <button onClick={() => onCreate(null)}>Create page</button>
      <button onClick={() => onDuplicate('second')}>Duplicate page</button>
      <button onClick={() => onDelete('first')}>Delete page</button>
    </>
  ),
}));
vi.mock('./DocsEditor', () => ({
  default: ({
    title,
    saveState,
    onTitleChange,
    onSelectPage,
  }: {
    title: string;
    saveState: string;
    onTitleChange: (value: string) => void;
    onSelectPage: (id: string) => void;
  }) => (
    <>
      <input
        aria-label="Page title"
        value={title}
        onChange={event => onTitleChange(event.target.value)}
      />
      <span>{saveState}</span>
      <button onClick={() => onSelectPage('second')}>Open ancestor</button>
    </>
  ),
}));

const first: IProjectDocument = {
  id: 'first',
  project_id: 'project',
  parent_id: null,
  title: 'First page',
  position: 0,
  updated_at: '2026-10-16T00:00:00Z',
  updated_by_name: null,
  created_at: '',
  created_by: null,
  updated_by: null,
  content: { version: 1, sections: [] },
  mentions: EMPTY_MENTIONS,
};
const second = { ...first, id: 'second', title: 'Second page' };
beforeEach(() => {
  vi.mocked(projectDocumentsApiService.list).mockResolvedValue({
    done: true,
    body: [first, second],
  });
  vi.mocked(projectDocumentsApiService.getById).mockImplementation(async id => ({
    done: true,
    body: id === 'first' ? first : second,
  }));
  vi.mocked(projectDocumentsApiService.update).mockReset();
  vi.mocked(projectDocumentsApiService.create).mockReset();
  vi.mocked(projectDocumentsApiService.duplicate).mockReset();
  vi.mocked(projectDocumentsApiService.remove).mockReset();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it.each(['Open another page', 'Open ancestor', 'Create page', 'Duplicate page'])(
  'retains the current draft when saving fails before %s',
  async action => {
    vi.mocked(projectDocumentsApiService.update).mockRejectedValue(new Error('offline'));
    render(<ProjectViewDocs />);
    await screen.findByDisplayValue('First page');
    vi.mocked(projectDocumentsApiService.getById).mockClear();
    fireEvent.change(screen.getByLabelText('Page title'), { target: { value: 'Unsaved draft' } });
    fireEvent.click(screen.getByRole('button', { name: action }));
    await screen.findByText('error');
    expect(screen.getByLabelText('Page title')).toHaveValue('Unsaved draft');
    expect(projectDocumentsApiService.getById).not.toHaveBeenCalled();
    expect(projectDocumentsApiService.create).not.toHaveBeenCalled();
    expect(projectDocumentsApiService.duplicate).not.toHaveBeenCalled();
  }
);

it('saves the current draft before opening an ancestor', async () => {
  vi.mocked(projectDocumentsApiService.update).mockResolvedValue({
    status: 'ok',
    document: { ...first, title: 'Saved draft' },
  });
  render(<ProjectViewDocs />);
  await screen.findByDisplayValue('First page');
  fireEvent.change(screen.getByLabelText('Page title'), { target: { value: 'Saved draft' } });
  fireEvent.click(screen.getByRole('button', { name: 'Open ancestor' }));
  await waitFor(() => expect(screen.getByLabelText('Page title')).toHaveValue('Second page'));
  expect(projectDocumentsApiService.update).toHaveBeenCalledWith(
    'first',
    expect.objectContaining({ title: 'Saved draft' })
  );
});

it('keeps a conflicted draft open when following a breadcrumb', async () => {
  vi.mocked(projectDocumentsApiService.update).mockResolvedValue({
    status: 'conflict',
    document: { ...first, title: 'Someone else’s version' },
  });
  render(<ProjectViewDocs />);
  await screen.findByDisplayValue('First page');
  vi.mocked(projectDocumentsApiService.getById).mockClear();
  fireEvent.change(screen.getByLabelText('Page title'), { target: { value: 'My draft' } });
  fireEvent.click(screen.getByRole('button', { name: 'Open ancestor' }));
  await screen.findByText('conflict');
  expect(screen.getByLabelText('Page title')).toHaveValue('My draft');
  expect(projectDocumentsApiService.getById).not.toHaveBeenCalled();
});

it('cancels the discarded draft after confirmed deletion and opens the remaining page', async () => {
  vi.spyOn(Modal, 'confirm').mockImplementation(options => {
    void options.onOk?.(vi.fn());
    return { destroy: vi.fn(), update: vi.fn() };
  });
  vi.mocked(projectDocumentsApiService.remove).mockResolvedValue({
    done: true,
    body: { id: 'first', deleted_ids: ['first'] },
  });
  render(<ProjectViewDocs />);
  await screen.findByDisplayValue('First page');
  fireEvent.change(screen.getByLabelText('Page title'), { target: { value: 'Discarded draft' } });
  fireEvent.click(screen.getByRole('button', { name: 'Delete page' }));
  await screen.findByDisplayValue('Second page');
  expect(projectDocumentsApiService.update).not.toHaveBeenCalled();
});
