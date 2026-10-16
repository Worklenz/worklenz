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
import { FileTextOutlined, HolderOutlined, MoreOutlined, PlusOutlined, SearchOutlined } from '@ant-design/icons';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  IProjectDocumentSearchResult,
  IProjectDocumentSummary,
  IReorderDocumentItem,
} from '@/types/project/project-documents.types';

import { buildDocumentTree, flattenDocumentTree, pageDepth, planDocumentMove } from './docs-tree';

interface DocsSidebarProps {
  pages: IProjectDocumentSummary[];
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
}

const DocsSidebar = ({
  pages,
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
}: DocsSidebarProps) => {
  const { t } = useTranslation('project-view-docs');
  const { token } = theme.useToken();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const flatPages = useMemo(() => flattenDocumentTree(buildDocumentTree(pages)), [pages]);

  const handleDragEnd = (event: DragEndEvent) => {
    const overId = event.over?.id;
    if (!overId || overId === event.active.id) return;
    const placement = event.delta.x > 28 ? 'inside' : 'after';
    const items = planDocumentMove(pages, String(event.active.id), String(overId), placement);
    if (items) onReorder(items);
  };

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
        <Tooltip title={t('newPage', { defaultValue: 'New page' })}>
          <Button
            size="small"
            type="text"
            aria-label={t('newPage', { defaultValue: 'New page' })}
            icon={<PlusOutlined />}
            onClick={() => onCreate(null)}
          />
        </Tooltip>
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
      <div className="min-h-0 flex-1 overflow-auto px-2 pb-3" role="tree" aria-label={t('pages', { defaultValue: 'Pages' })}>
        {loading ? (
          <Flex justify="center" className="py-8">
            <Spin />
          </Flex>
        ) : searchQuery.trim().length >= 2 ? (
          <SearchResults
            searching={searching}
            results={searchResults}
            onSelect={onSelect}
          />
        ) : flatPages.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={t('emptySidebar', { defaultValue: 'No pages yet' })}
          />
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={flatPages.map(page => page.id)} strategy={verticalListSortingStrategy}>
              {flatPages.map(page => (
                <PageRow
                  key={page.id}
                  page={page}
                  active={page.id === activeId}
                  editing={editingId === page.id}
                  draftTitle={draftTitle}
                  canNest={pageDepth(pages, page.id) < 5}
                  onDraftTitle={setDraftTitle}
                  onSelect={() => onSelect(page.id)}
                  onStartRename={() => {
                    setEditingId(page.id);
                    setDraftTitle(page.title);
                  }}
                  onCommitRename={() => commitRename(page)}
                  onCancelRename={() => setEditingId(null)}
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
        )}
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
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('noMatches', { defaultValue: 'No matching pages' })} />;
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
  editing: boolean;
  draftTitle: string;
  canNest: boolean;
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
  editing,
  draftTitle,
  canNest,
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
  const next = siblingIndex >= 0 && siblingIndex < siblings.length - 1 ? siblings[siblingIndex + 1] : null;

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
          <FileTextOutlined style={{ color: active ? token.colorPrimary : token.colorTextSecondary }} />
          <span className="truncate">{page.title}</span>
        </button>
      )}
      <Dropdown
        trigger={['click']}
        menu={{
          items: [
            { key: 'rename', label: t('rename', { defaultValue: 'Rename' }) },
            {
              key: 'subpage',
              label: t('newSubpage', { defaultValue: 'Add subpage' }),
              disabled: !canNest,
            },
            { key: 'duplicate', label: t('duplicate', { defaultValue: 'Duplicate' }) },
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
