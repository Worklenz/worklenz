import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EyeInvisibleOutlined, LockOutlined, FilterOutlined, MessageOutlined, PlusOutlined, SearchOutlined } from '@ant-design/icons';
import { Alert, Button, Dropdown, Empty, Flex, Input, Tooltip, theme } from '@/shared/antd-imports';
import PillToggle from '@/pages/home/PillToggle';
import TablePagination from '@/components/TablePagination';
import { useDebouncedMediaQuery } from '@/hooks/useDebouncedMediaQuery';
import { clientPortalApi } from '@/api/client-portal/client-portal-api';
import { useGetThreadsQuery } from '@/api/client-portal/portal-workflow-api';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { PortalAvatar, StatusTag, useDebouncedValue, usePortalPaging } from '@/components/client-portal/v2';
import type { Thread, ThreadContextType } from '@/types/client-portal/v2';
import { NewDiscussionModal } from './NewDiscussionModal';
import { ThreadView } from './ThreadView';
import { PortalLoader } from '@/components/client-portal/v2';
import { decodeHtmlEntities } from '@/utils/html-entities';

interface DiscussionsPanelProps {
  /** Limits the inbox to one project (the project's Discussions tab). */
  projectId?: string;
  /** Inside a page section rather than the whole page: a fixed height instead of filling the viewport. */
  embedded?: boolean;
  /** A thread to open straight away, from a notification or a "Needs attention" row. */
  initialThreadId?: string;
}

type InboxFilter = 'all' | 'unread';
type TypeFilter = ThreadContextType | 'all';

const THREAD_TYPES: ThreadContextType[] = ['project', 'task', 'file', 'approval', 'change_request'];

const NARROW_QUERY = '(max-width: 767px)';

/**
 * The discussion inbox: every thread on one side, the open conversation on the other. On a phone the
 * conversation replaces the list. Threads are about a project, task, file or approval, and internal
 * comments sit inside them marked as such.
 */
export const DiscussionsPanel = ({ projectId, embedded = false, initialThreadId }: DiscussionsPanelProps) => {
  const { t } = useTranslation('client-portal-v2-discussions');
  const { token } = theme.useToken();
  const dispatch = useAppDispatch();
  const isNarrow = useDebouncedMediaQuery(NARROW_QUERY);
  const paging = usePortalPaging(20);

  const [filter, setFilter] = useState<InboxFilter>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [search, setSearch] = useState('');
  const [activeId, setActiveId] = useState<string | null>(initialThreadId ?? null);
  const [showNew, setShowNew] = useState(false);
  const debouncedSearch = useDebouncedValue(search);

  useEffect(() => {
    if (initialThreadId) setActiveId(initialThreadId);
  }, [initialThreadId]);

  useEffect(() => {
    paging.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, typeFilter, debouncedSearch, projectId]);

  const query = useGetThreadsQuery({
    page: paging.page,
    limit: paging.limit,
    search: debouncedSearch.trim() || undefined,
    project_id: projectId,
    unread: filter === 'unread' ? true : undefined,
    context_type: typeFilter === 'all' ? undefined : typeFilter,
  });
  const list = query.data?.body;
  const threads = list?.items ?? [];

  // On a wide screen the first thread opens by default; on a phone the list is the landing view.
  const selectedId = activeId ?? (!isNarrow && !initialThreadId ? (threads[0]?.id ?? null) : null);
  const selected = threads.find(thread => thread.id === selectedId);

  // Opening a thread marks it read on the server; refresh the list and the sidebar badge to match.
  useEffect(() => {
    if (selected?.unread) {
      dispatch(clientPortalApi.util.invalidateTags(['PortalCounts', 'Threads']));
    }
  }, [dispatch, selected?.id, selected?.unread]);

  const showList = !isNarrow || selectedId === null;
  const showThread = !isNarrow || selectedId !== null;
  const height = embedded ? 560 : 'calc(100vh - 230px)';

  const renderItem = (thread: Thread) => {
    const isActive = thread.id === selectedId;
    const lastIsInternal = thread.last_message.visibility === 'internal';
    return (
      <button
        key={thread.id}
        type="button"
        onClick={() => setActiveId(thread.id)}
        aria-current={isActive ? 'true' : undefined}
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 10,
          width: '100%',
          textAlign: 'left',
          padding: '10px 14px',
          border: 'none',
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
          background: isActive ? token.colorPrimaryBg : 'transparent',
          color: token.colorText,
          cursor: 'pointer',
        }}
      >
        <span
          aria-label={thread.unread ? t('list.unread', { defaultValue: 'Unread' }) : undefined}
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            marginTop: 11,
            flexShrink: 0,
            background: thread.unread ? token.colorError : 'transparent',
          }}
        />
        <PortalAvatar name={decodeHtmlEntities(thread.organization_name)} />
        <span style={{ flex: 1, minWidth: 0 }}>
          <Flex align="center" gap={6} wrap="wrap">
            <span style={{ fontWeight: thread.unread ? 700 : 600, fontSize: 13, overflowWrap: 'anywhere' }}>
              {decodeHtmlEntities(thread.context.label)}
            </span>
            {thread.hidden_from_client && (
              <Tooltip title={t('list.hiddenHint', { defaultValue: 'The linked item is Internal Only, so the client cannot see this thread.' })}>
                <span>
                  <StatusTag tone="red" icon={<EyeInvisibleOutlined />}>
                    {t('list.hidden', { defaultValue: 'Hidden' })}
                  </StatusTag>
                </span>
              </Tooltip>
            )}
          </Flex>
          <span style={{ display: 'block', fontSize: 11.5, color: token.colorTextSecondary }}>
            {thread.ref_no} · {decodeHtmlEntities(thread.organization_name)} ·{' '}
            {decodeHtmlEntities(thread.project_name)}
          </span>
          <span
            style={{
              display: 'block',
              fontSize: 12,
              color: token.colorTextTertiary,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {lastIsInternal && <LockOutlined aria-label={t('list.internalPreview', { defaultValue: 'Internal comment' })} />}{' '}
            {thread.last_message.text ||
              (thread.last_message.attachment_count > 0
                ? t('list.attachmentsPreview', {
                    count: thread.last_message.attachment_count,
                    defaultValue: '{{count}} attachment(s)',
                  })
                : '')}
          </span>
        </span>
      </button>
    );
  };

  const renderList = () => {
    if (query.isLoading) return <PortalLoader />;
    if (query.isError) {
      return (
        <Alert
          type="error"
          showIcon
          style={{ margin: 12 }}
          message={t('list.loadFailed', { defaultValue: 'The discussions could not be loaded.' })}
          action={
            <Button size="small" onClick={() => query.refetch()}>
              {t('retry', { defaultValue: 'Retry' })}
            </Button>
          }
        />
      );
    }
    if (threads.length === 0) {
      return (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          style={{ padding: '24px 12px' }}
          description={
            debouncedSearch.trim() || filter === 'unread' || typeFilter !== 'all'
              ? t('list.emptyFiltered', { defaultValue: 'No discussions match.' })
              : t('list.empty', { defaultValue: 'No discussions yet. Start one with the + button.' })
          }
        />
      );
    }
    return threads.map(renderItem);
  };

  return (
    <div
      style={{
        display: 'flex',
        height,
        minHeight: 360,
        border: `1px solid ${token.colorBorderSecondary}`,
        borderRadius: 8,
        background: token.colorBgContainer,
        overflow: 'hidden',
      }}
    >
      {showList && (
        <div
          style={{
            width: isNarrow ? '100%' : 340,
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            borderRight: isNarrow ? 'none' : `1px solid ${token.colorBorderSecondary}`,
            minHeight: 0,
          }}
        >
          <Flex gap={8} style={{ padding: 12 }}>
            <Input
              allowClear
              prefix={<SearchOutlined />}
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder={t('list.search', { defaultValue: 'Search by ID, project or message' })}
              aria-label={t('list.search', { defaultValue: 'Search by ID, project or message' })}
            />
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setShowNew(true)}
              aria-label={t('list.new', { defaultValue: 'New discussion' })}
            />
          </Flex>
          <Flex align="center" gap={8} style={{ padding: '0 12px 10px' }}>
            <PillToggle<InboxFilter>
              value={filter}
              onChange={setFilter}
              ariaLabel={t('list.filter', { defaultValue: 'Filter discussions' })}
              style={{ height: token.controlHeightSM }}
              options={[
                { value: 'all', label: t('list.all', { defaultValue: 'All' }) },
                { value: 'unread', label: t('list.unreadFilter', { defaultValue: 'Unread' }) },
              ]}
            />
            <Dropdown
              trigger={['click']}
              placement="bottomRight"
              menu={{
                selectable: true,
                selectedKeys: [typeFilter],
                onClick: ({ key }) => setTypeFilter(key as TypeFilter),
                items: [
                  { key: 'all', label: t('list.allTypes', { defaultValue: 'All types' }) },
                  ...THREAD_TYPES.map(type => ({
                    key: type,
                    label: t(`list.type.${type}`, {
                      defaultValue: type.charAt(0).toUpperCase() + type.slice(1),
                    }),
                  })),
                ],
              }}
            >
              <Button
                size="small"
                type={typeFilter === 'all' ? 'text' : 'primary'}
                icon={<FilterOutlined />}
                style={{ height: token.controlHeightSM, marginLeft: 'auto' }}
                aria-label={t('list.typeFilter', { defaultValue: 'Filter by type' })}
              />
            </Dropdown>
          </Flex>
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', borderTop: `1px solid ${token.colorBorderSecondary}` }}>
            {renderList()}
          </div>
          {list && list.total > list.limit && (
            <TablePagination
              page={paging.page}
              pageSize={paging.limit}
              total={list.total}
              onPageChange={(page, pageSize) => paging.setPage(page, pageSize)}
              rowsPerPageLabel={t('rowsPerPage', { defaultValue: 'Rows per page:' })}
              insetStart={12}
              insetEnd={12}
            />
          )}
        </div>
      )}

      {showThread && (
        <div style={{ flex: 1, minWidth: 0, minHeight: 0 }}>
          {selectedId ? (
            <ThreadView
              key={selectedId}
              threadId={selectedId}
              onBack={isNarrow ? () => setActiveId(null) : undefined}
            />
          ) : (
            <Flex align="center" justify="center" style={{ height: '100%' }}>
              <Empty
                image={<MessageOutlined style={{ fontSize: 40, color: token.colorTextQuaternary }} />}
                description={t('thread.pick', { defaultValue: 'Select a discussion, or start a new one.' })}
              />
            </Flex>
          )}
        </div>
      )}

      {showNew && (
        <NewDiscussionModal
          projectId={projectId}
          onClose={() => setShowNew(false)}
          onCreated={thread => setActiveId(thread.id)}
        />
      )}
    </div>
  );
};
