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
