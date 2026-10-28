import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Alert,
  Button,
  Dropdown,
  Empty,
  Flex,
  Input,
  Spin,
  Tooltip,
  Typography,
  theme,
} from '@/shared/antd-imports';
import {
  FileTextOutlined,
  HolderOutlined,
  MoreOutlined,
  PlusOutlined,
  SearchOutlined,
  StarFilled,
  StarOutlined,
} from '@ant-design/icons';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  IProjectDocumentSearchResult,
  IProjectDocumentSummary,
  IReorderDocumentItem,
} from '@/types/project/project-documents.types';

import {
  buildDocumentTree,
  dragPlacement,
  flattenDocumentTree,
  pageDepth,
  planDocumentMove,
} from './docs-tree';

interface DocsSidebarProps {
  pages: IProjectDocumentSummary[];
  favoriteIds: Set<string>;
  favoritePending: Set<string>;
  favoriteLoading: boolean;
  favoriteError: boolean;
  onRetryFavorites: () => void;
  onToggleFavorite: (id: string) => void;
  activeId: string | null;
  loading: boolean;
  searchQuery: string;
  searchResults: IProjectDocumentSearchResult[] | null;
  searching: boolean;
  onSearch: (query: string) => void;
  onSelect: (id: string) => void;
  onCreate: (parentId: string | null) => void;
  onRename: (id: string, title: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onReorder: (items: IReorderDocumentItem[]) => void;
  /** Project docs can create pages. The team workspace hides those actions. */
  canCreate?: boolean;
  /** Split the tree into one drag context per project. */
  groupByProject?: boolean;
}

interface PageTreeProps {
  pages: IProjectDocumentSummary[];
  sensors: ReturnType<typeof useSensors>;
  activeId: string | null;
  favoriteIds: Set<string>;
  favoritePending: Set<string>;
  favoriteLoading: boolean;
  favoriteError: boolean;
  editingId: string | null;
  draftTitle: string;
  canCreate: boolean;
  onToggleFavorite: (id: string) => void;
  onDraftTitle: (value: string) => void;
  onSelect: (id: string) => void;
  onStartRename: (page: IProjectDocumentSummary) => void;
  onCommitRename: (page: IProjectDocumentSummary) => void;
  onCancelRename: () => void;
  onCreate: (parentId: string | null) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onReorder: (items: IReorderDocumentItem[]) => void;
}

const PageTree = ({
  pages,
  sensors,
  activeId,
  favoriteIds,
  favoritePending,
  favoriteLoading,
  favoriteError,
  editingId,
  draftTitle,
  canCreate,
  onToggleFavorite,
  onDraftTitle,
  onSelect,
  onStartRename,
  onCommitRename,
  onCancelRename,
  onCreate,
  onDuplicate,
  onDelete,
  onReorder,
}: PageTreeProps) => {
  const flatPages = useMemo(() => flattenDocumentTree(buildDocumentTree(pages)), [pages]);

  const handleDragEnd = (event: DragEndEvent) => {
    const overId = event.over?.id;
    if (!overId || overId === event.active.id) return;
    const placement = dragPlacement(
      flatPages.findIndex(page => page.id === event.active.id),
      flatPages.findIndex(page => page.id === overId),
      event.delta.x
    );
    const items = planDocumentMove(pages, String(event.active.id), String(overId), placement);
    if (items) onReorder(items);
  };

  if (flatPages.length === 0) return null;

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={flatPages.map(page => page.id)} strategy={verticalListSortingStrategy}>
        {flatPages.map(page => (
          <PageRow
            key={page.id}
            page={page}
            active={page.id === activeId}
            isFavorite={favoriteIds.has(page.id)}
            isFavoriteDisabled={favoriteLoading || favoriteError || favoritePending.has(page.id)}
            onToggleFavorite={() => onToggleFavorite(page.id)}
            editing={editingId === page.id}
            draftTitle={draftTitle}
            canNest={pageDepth(pages, page.id) < 5}
            canCreate={canCreate}
            onDraftTitle={onDraftTitle}
            onSelect={() => onSelect(page.id)}
            onStartRename={() => onStartRename(page)}
            onCommitRename={() => onCommitRename(page)}
            onCancelRename={onCancelRename}
            onCreate={() => onCreate(page.id)}
            onDuplicate={() => onDuplicate(page.id)}
            onDelete={() => onDelete(page.id)}
            onMove={(placement, overId) => {
              const items = planDocumentMove(pages, page.id, overId, placement);
              if (items) onReorder(items);
            }}
            siblings={flatPages.filter(item => item.parent_id === page.parent_id)}
          />
        ))}
      </SortableContext>
    </DndContext>
  );
};

const DocsSidebar = ({
  pages,
  favoriteIds,
  favoritePending,
  favoriteLoading,
  favoriteError,
  onRetryFavorites,
  onToggleFavorite,
  activeId,
  loading,
  searchQuery,
  searchResults,
  searching,
  onSearch,
  onSelect,
  onCreate,
  onRename,
  onDuplicate,
  onDelete,
  onReorder,
  canCreate = true,
  groupByProject = false,
}: DocsSidebarProps) => {
  const { t } = useTranslation('project-view-docs');
  const { token } = theme.useToken();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const projectGroups = useMemo(() => {
    const order: string[] = [];
    const byProject = new Map<string, IProjectDocumentSummary[]>();
    pages.forEach(page => {
      const list = byProject.get(page.project_id);
      if (list) {
        list.push(page);
      } else {
        order.push(page.project_id);
        byProject.set(page.project_id, [page]);
      }
    });
    return order.map(projectId => {
      const groupPages = byProject.get(projectId) || [];
      return {
        projectId,
        projectName: groupPages[0]?.project_name || projectId,
        projectColor: groupPages[0]?.project_color || null,
        pages: groupPages,
      };
    });
  }, [pages]);

  const commitRename = (page: IProjectDocumentSummary) => {
    const title = draftTitle.trim();
    setEditingId(null);
    if (!title || title === page.title) return;
    onRename(page.id, title);
  };

  return (
    <Flex
      vertical
      className="w-full shrink-0 border-b md:h-full md:w-72 md:border-b-0 md:border-r"
      style={{
        borderColor: token.colorBorderSecondary,
        background: token.colorBgContainer,
        ['--docs-border' as string]: token.colorBorderSecondary,
        ['--docs-hover' as string]: token.colorFillTertiary,
        ['--docs-selected' as string]: token.colorFillSecondary,
        ['--docs-link' as string]: token.colorPrimary,
      }}
    >
      <Flex
        align="center"
        justify="space-between"
        className="h-11 shrink-0 px-3"
        style={{ borderBottom: `1px solid ${token.colorBorderSecondary}` }}
      >
        <Typography.Text strong>{t('pages', { defaultValue: 'Pages' })}</Typography.Text>
        {canCreate ? (
          <Tooltip title={t('newPage', { defaultValue: 'New page' })}>
            <Button
              size="small"
              type="text"
              aria-label={t('newPage', { defaultValue: 'New page' })}
              icon={<PlusOutlined />}
              onClick={() => onCreate(null)}
            />
          </Tooltip>
        ) : null}
      </Flex>
      <div className="px-3 py-2">
        <Input
          allowClear
          size="small"
          value={searchQuery}
          prefix={<SearchOutlined />}
          placeholder={t('searchPlaceholder', { defaultValue: 'Search pages' })}
          aria-label={t('searchPlaceholder', { defaultValue: 'Search pages' })}
          onChange={event => onSearch(event.target.value)}
        />
      </div>
      <div className="docs-sidebar-navigation min-h-0 flex-1 overflow-auto px-2 pb-3">
        {!searchQuery.trim() && (
          <nav
            className="docs-favorites"
            aria-label={t('favorites', { defaultValue: 'Favorites' })}
          >
            <Typography.Text type="secondary" className="px-2 text-xs">
              {t('favorites', { defaultValue: 'Favorites' })}
            </Typography.Text>
            {favoriteLoading ? (
              <Flex justify="center" className="py-2">
                <Spin size="small" />
              </Flex>
            ) : favoriteError ? (
              <Alert
                type="error"
                showIcon
                message={t('favoritesLoadError', { defaultValue: "Couldn't load favorites" })}
                action={
                  <Button size="small" onClick={onRetryFavorites}>
                    {t('retry', { defaultValue: 'Retry' })}
                  </Button>
                }
              />
            ) : pages.filter(page => favoriteIds.has(page.id)).length ? (
              pages
                .filter(page => favoriteIds.has(page.id))
                .map(page => (
                  <button
                    type="button"
                    key={page.id}
                    onClick={() => onSelect(page.id)}
                    aria-current={activeId === page.id ? 'page' : undefined}
                    className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm"
                    style={{
                      color: token.colorText,
                      background: activeId === page.id ? token.colorFillSecondary : undefined,
                    }}
                  >
                    <StarFilled aria-hidden style={{ color: token.colorPrimary }} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{page.title}</span>
                      {groupByProject && page.project_name ? (
                        <span className="block truncate text-xs" style={{ color: token.colorTextSecondary }}>
                          {page.project_name}
                        </span>
                      ) : null}
                    </span>
                  </button>
                ))
            ) : (
              <p className="px-2 py-2 text-xs" style={{ color: token.colorTextSecondary }}>
                {t('favoritesEmpty', {
                  defaultValue: 'Star pages to keep them here. Only you see your favorites.',
                })}
              </p>
            )}
          </nav>
        )}
        <div role="tree" aria-label={t('pages', { defaultValue: 'Pages' })}>
          {loading ? (
            <Flex justify="center" className="py-8">
              <Spin />
            </Flex>
          ) : searchQuery.trim().length >= 2 ? (
            <SearchResults searching={searching} results={searchResults} onSelect={onSelect} />
          ) : pages.length === 0 ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={t('emptySidebar', { defaultValue: 'No pages yet' })}
            />
          ) : groupByProject ? (
            projectGroups.map(group => (
              <div key={group.projectId} role="group" aria-label={group.projectName} className="mb-2">
                <Flex align="center" gap={8} className="px-2 pb-1 pt-3">
                  <span
                    aria-hidden
                    className="inline-block h-2 w-2 shrink-0 rounded-full"
                    style={{ background: group.projectColor || token.colorPrimary }}
                  />
                  <Typography.Text type="secondary" className="truncate text-xs" strong>
                    {group.projectName}
                  </Typography.Text>
                </Flex>
                <PageTree
                  pages={group.pages}
                  sensors={sensors}
                  activeId={activeId}
                  favoriteIds={favoriteIds}
                  favoriteLoading={favoriteLoading}
                  favoriteError={favoriteError}
                  favoritePending={favoritePending}
                  editingId={editingId}
                  draftTitle={draftTitle}
                  canCreate={canCreate}
                  onToggleFavorite={onToggleFavorite}
                  onDraftTitle={setDraftTitle}
                  onSelect={onSelect}
                  onStartRename={page => {
                    setEditingId(page.id);
                    setDraftTitle(page.title);
                  }}
                  onCommitRename={commitRename}
                  onCancelRename={() => setEditingId(null)}
                  onCreate={onCreate}
                  onDuplicate={onDuplicate}
                  onDelete={onDelete}
                  onReorder={onReorder}
                />
              </div>
            ))
          ) : (
            <PageTree
              pages={pages}
              sensors={sensors}
              activeId={activeId}
              favoriteIds={favoriteIds}
              favoriteLoading={favoriteLoading}
              favoriteError={favoriteError}
              favoritePending={favoritePending}
              editingId={editingId}
              draftTitle={draftTitle}
              canCreate={canCreate}
              onToggleFavorite={onToggleFavorite}
              onDraftTitle={setDraftTitle}
              onSelect={onSelect}
              onStartRename={page => {
                setEditingId(page.id);
                setDraftTitle(page.title);
              }}
              onCommitRename={commitRename}
              onCancelRename={() => setEditingId(null)}
              onCreate={onCreate}
              onDuplicate={onDuplicate}
              onDelete={onDelete}
              onReorder={onReorder}
            />
          )}
        </div>
      </div>
    </Flex>
  );
};

interface SearchResultsProps {
  searching: boolean;
  results: IProjectDocumentSearchResult[] | null;
  onSelect: (id: string) => void;
}

const SearchResults = ({ searching, results, onSelect }: SearchResultsProps) => {
  const { t } = useTranslation('project-view-docs');
  const { token } = theme.useToken();
  if (searching) {
    return (
      <Flex justify="center" className="py-8">
        <Spin />
      </Flex>
    );
  }
  if (!results || results.length === 0) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={t('noMatches', { defaultValue: 'No matching pages' })}
      />
    );
  }
  return (
    <Flex vertical gap={4}>
      {results.map(result => (
        <button
          key={result.id}
          type="button"
          className="docs-search-hit w-full rounded px-2 py-1.5 text-left"
          style={{ color: token.colorText }}
          onClick={() => onSelect(result.id)}
        >
          <div className="truncate text-sm font-medium">{result.title}</div>
          {result.project_name ? (
            <div className="truncate text-xs" style={{ color: token.colorTextSecondary }}>
              {result.project_name}
            </div>
          ) : null}
          <div className="truncate text-xs" style={{ color: token.colorTextSecondary }}>
            {result.snippet}
          </div>
        </button>
      ))}
    </Flex>
  );
};

interface PageRowProps {
  page: ReturnType<typeof flattenDocumentTree>[number];
  active: boolean;
  isFavorite: boolean;
  isFavoriteDisabled: boolean;
  onToggleFavorite: () => void;
  editing: boolean;
  draftTitle: string;
  canNest: boolean;
  canCreate: boolean;
  siblings: Array<{ id: string }>;
  onDraftTitle: (value: string) => void;
  onSelect: () => void;
  onStartRename: () => void;
  onCommitRename: () => void;
  onCancelRename: () => void;
  onCreate: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onMove: (placement: 'before' | 'after', overId: string) => void;
}

const PageRow = ({
  page,
  active,
  isFavorite,
  isFavoriteDisabled,
  onToggleFavorite,
  editing,
  draftTitle,
  canNest,
  canCreate,
  siblings,
  onDraftTitle,
  onSelect,
  onStartRename,
  onCommitRename,
  onCancelRename,
  onCreate,
  onDuplicate,
  onDelete,
  onMove,
}: PageRowProps) => {
  const { t } = useTranslation('project-view-docs');
  const { token } = theme.useToken();
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: page.id });
  const siblingIndex = siblings.findIndex(item => item.id === page.id);
  const previous = siblingIndex > 0 ? siblings[siblingIndex - 1] : null;
  const next =
    siblingIndex >= 0 && siblingIndex < siblings.length - 1 ? siblings[siblingIndex + 1] : null;

  return (
    <div
      ref={setNodeRef}
      role="treeitem"
      aria-selected={active}
      aria-level={page.depth}
      className="docs-page-row mb-0.5 flex items-center gap-1 rounded"
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        paddingLeft: (page.depth - 1) * 14,
      }}
    >
      <Tooltip title={t('dragToReorder', { defaultValue: 'Drag to reorder. Drag right to nest.' })}>
        <button
          type="button"
          className="docs-page-affordance flex h-7 w-5 shrink-0 items-center justify-center"
          aria-label={t('dragToReorder', { defaultValue: 'Drag to reorder. Drag right to nest.' })}
          {...attributes}
          {...listeners}
        >
          <HolderOutlined style={{ color: token.colorTextSecondary, fontSize: 12 }} />
        </button>
      </Tooltip>
      {editing ? (
        <Input
          size="small"
          autoFocus
          value={draftTitle}
          aria-label={t('rename', { defaultValue: 'Rename' })}
          onChange={event => onDraftTitle(event.target.value)}
          onPressEnter={onCommitRename}
          onBlur={onCommitRename}
          onKeyDown={event => {
            if (event.key === 'Escape') onCancelRename();
          }}
        />
      ) : (
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-2 py-1.5 text-left text-sm"
          style={{ color: token.colorText }}
          onClick={onSelect}
        >
          <FileTextOutlined
            style={{ color: active ? token.colorPrimary : token.colorTextSecondary }}
          />
          <span className="truncate">{page.title}</span>
        </button>
      )}
      <Tooltip
        title={
          isFavorite
            ? t('removeFavorite', { defaultValue: 'Remove from favorites' })
            : t('addFavorite', { defaultValue: 'Add to favorites' })
        }
      >
        <Button
          size="small"
          type="text"
          className={isFavorite ? undefined : 'docs-page-affordance'}
          aria-label={
            isFavorite
              ? t('removeFavorite', { defaultValue: 'Remove from favorites' })
              : t('addFavorite', { defaultValue: 'Add to favorites' })
          }
          aria-pressed={isFavorite}
          disabled={isFavoriteDisabled}
          icon={isFavorite ? <StarFilled style={{ color: token.colorPrimary }} /> : <StarOutlined />}
          onClick={onToggleFavorite}
        />
      </Tooltip>
      <Dropdown
        trigger={['click']}
        menu={{
          items: [
            {
              key: 'favorite',
              disabled: isFavoriteDisabled,
              label: isFavorite
                ? t('removeFavorite', { defaultValue: 'Remove from favorites' })
                : t('addFavorite', { defaultValue: 'Add to favorites' }),
            },
            { key: 'rename', label: t('rename', { defaultValue: 'Rename' }) },
            ...(canCreate
              ? [
                  {
                    key: 'subpage',
                    label: t('newSubpage', { defaultValue: 'Add subpage' }),
                    disabled: !canNest,
                  },
                  { key: 'duplicate', label: t('duplicate', { defaultValue: 'Duplicate' }) },
                ]
              : []),
            {
              key: 'up',
              label: t('moveUp', { defaultValue: 'Move up' }),
              disabled: !previous,
            },
            {
              key: 'down',
              label: t('moveDown', { defaultValue: 'Move down' }),
              disabled: !next,
            },
            { type: 'divider' },
            { key: 'delete', danger: true, label: t('delete', { defaultValue: 'Delete' }) },
          ],
          onClick: ({ key, domEvent }) => {
            domEvent.stopPropagation();
            if (key === 'favorite') onToggleFavorite();
            if (key === 'rename') onStartRename();
            if (key === 'subpage') onCreate();
            if (key === 'duplicate') onDuplicate();
            if (key === 'up' && previous) onMove('before', previous.id);
            if (key === 'down' && next) onMove('after', next.id);
            if (key === 'delete') onDelete();
          },
        }}
      >
        <Tooltip title={t('pageActions', { defaultValue: 'Page actions' })}>
          <Button
            size="small"
            type="text"
            className="docs-page-affordance"
            aria-label={t('pageActions', { defaultValue: 'Page actions' })}
            icon={<MoreOutlined />}
          />
        </Tooltip>
      </Dropdown>
    </div>
  );
};

export default DocsSidebar;
