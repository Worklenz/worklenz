import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { ConfigProvider, theme } from 'antd';
import { afterEach, describe, expect, it, vi } from 'vitest';
import DocsSidebar from './docs-sidebar';
import { IProjectDocumentSummary } from '@/types/project/project-documents.types';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, options: { defaultValue: string }) => options.defaultValue,
  }),
}));
afterEach(cleanup);
const pages: IProjectDocumentSummary[] = [
  {
    id: 'parent',
    parent_id: null,
    project_id: 'project',
    title: 'Design',
    position: 0,
    updated_at: '',
    updated_by_name: null,
  },
  {
    id: 'child',
    parent_id: 'parent',
    project_id: 'project',
    title: 'Research',
    position: 0,
    updated_at: '',
    updated_by_name: null,
  },
];
const props = () => ({
  pages,
  activeId: 'child',
  loading: false,
  searchQuery: '',
  searchResults: null,
  searching: false,
  favoriteIds: new Set(['child']),
  favoritePending: new Set<string>(),
  favoriteLoading: false,
  favoriteError: false,
  onRetryFavorites: vi.fn(),
  onToggleFavorite: vi.fn(),
  onSearch: vi.fn(),
  onSelect: vi.fn(),
  onCreate: vi.fn(),
  onRename: vi.fn(),
  onDuplicate: vi.fn(),
  onDelete: vi.fn(),
  onReorder: vi.fn(),
});

describe.each([false, true])('page navigation with dark theme = %s', dark => {
  it('keeps nested pages in the tree and opens a favorite from its separate navigation', async () => {
    const callbacks = props();
    render(
      <ConfigProvider theme={{ algorithm: dark ? theme.darkAlgorithm : theme.defaultAlgorithm }}>
        <DocsSidebar {...callbacks} />
      </ConfigProvider>
    );
    const favorite = within(screen.getByRole('navigation', { name: 'Favorites' })).getByRole(
      'button',
      { name: 'Research' }
    );
    expect(favorite).toHaveAttribute('aria-current', 'page');
    fireEvent.click(favorite);
    expect(callbacks.onSelect).toHaveBeenCalledWith('child');
    const childRow = screen.getAllByRole('treeitem')[1];
    expect(childRow).toHaveAttribute('aria-level', '2');
    fireEvent.click(within(childRow).getByRole('button', { name: 'Page actions' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Remove from favorites' }));
    expect(callbacks.onToggleFavorite).toHaveBeenCalledWith('child');
  });

  it('offers retry after a favorites load failure while pages remain available', () => {
    const callbacks = { ...props(), favoriteError: true };
    render(
      <ConfigProvider theme={{ algorithm: dark ? theme.darkAlgorithm : theme.defaultAlgorithm }}>
        <DocsSidebar {...callbacks} />
      </ConfigProvider>
    );
    expect(screen.getByText("Couldn't load favorites")).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(callbacks.onRetryFavorites).toHaveBeenCalledOnce();
    expect(screen.getAllByRole('treeitem')).toHaveLength(2);
  });
});

describe('create actions', () => {
  it('keeps new page, subpage, and duplicate on the project sidebar', async () => {
    render(
      <ConfigProvider theme={{ algorithm: theme.defaultAlgorithm }}>
        <DocsSidebar {...props()} />
      </ConfigProvider>
    );
    expect(screen.getByRole('button', { name: 'New page' })).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: 'Page actions' })[0]);
    expect(await screen.findByRole('menuitem', { name: 'Add subpage' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Duplicate' })).toBeInTheDocument();
  });

  it('hides new page, subpage, and duplicate when creating is disabled', async () => {
    render(
      <ConfigProvider theme={{ algorithm: theme.defaultAlgorithm }}>
        <DocsSidebar {...props()} canCreate={false} />
      </ConfigProvider>
    );
    expect(screen.queryByRole('button', { name: 'New page' })).not.toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: 'Page actions' })[0]);
    expect(await screen.findByRole('menuitem', { name: 'Rename' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Add subpage' })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Duplicate' })).not.toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Delete' })).toBeInTheDocument();
  });

  it('groups pages under their projects so each tree stays in its own project', () => {
    const grouped = [
      ...pages.map(page => ({ ...page, project_name: 'Alpha', project_color: '#1890ff' })),
      {
        id: 'other',
        parent_id: null,
        project_id: 'other-project',
        title: 'Notes',
        position: 0,
        updated_at: '',
        updated_by_name: null,
        project_name: 'Beta',
        project_color: '#52c41a',
      },
    ];
    render(
      <ConfigProvider theme={{ algorithm: theme.defaultAlgorithm }}>
        <DocsSidebar {...props()} pages={grouped} groupByProject canCreate={false} />
      </ConfigProvider>
    );
    expect(screen.getByRole('group', { name: 'Alpha' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Beta' })).toBeInTheDocument();
    expect(within(screen.getByRole('group', { name: 'Beta' })).getByText('Notes')).toBeInTheDocument();
  });
});
