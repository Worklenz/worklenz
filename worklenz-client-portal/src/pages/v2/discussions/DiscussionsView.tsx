import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Button,
  Dropdown,
  Empty,
  Flex,
  Input,
  Tooltip,
  Typography,
  ArrowLeftOutlined,
  AuditOutlined,
  CheckSquareOutlined,
  FileTextOutlined,
  FilterOutlined,
  FolderOutlined,
  MessageOutlined,
  PlusOutlined,
  SearchOutlined,
  SwapOutlined,
  theme,
} from '@/shared/antd-imports';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  useGetProjectsV2Query,
  useGetThreadsQuery,
  useMarkThreadReadMutation,
} from '@/store/api-v2';
import { useClientAccess } from '@/hooks/useClientAccess';
import { useResponsive } from '@/hooks/useResponsive';
import PillToggle from '@/components/PillToggle';
import {
  QueryState,
  TablePagination,
  UnavailableBanner,
  richTextToPlain,
  useDebouncedValue,
} from '@/components/v2';
import type { ClientProjectV2, ClientThreadMessageV2, ClientThreadV2, ThreadContextType } from '@/types/v2';
import { decodeHtmlEntities } from '@/utils/html-entities';
import { NewDiscussionModal } from './NewDiscussionModal';
import { ThreadComposer } from './ThreadComposer';
import { ThreadMessages } from './ThreadMessages';
import { ThreadAvatar } from './discussionUtils';

type InboxFilter = 'all' | 'unread';
type TypeFilter = ThreadContextType | 'all';

const THREAD_TYPES: ThreadContextType[] = ['project', 'task', 'file', 'approval', 'change_request'];
const PAGE_SIZE = 20;

const CONTEXT_ICONS: Record<ThreadContextType, React.ReactNode> = {
  project: <FolderOutlined />,
  task: <CheckSquareOutlined />,
  file: <FileTextOutlined />,
  approval: <AuditOutlined />,
  change_request: <SwapOutlined />,
};

interface DiscussionsViewProps {
  /** With a project this is that project's tab; without one it is the whole inbox. */
  project?: ClientProjectV2;
  /** Open the New discussion dialog straight away (the "Start discussion" row action). */
  autoOpenNew?: boolean;
}

/**
 * The discussion inbox: every thread on one side, the open conversation on the other. On a phone the
 * conversation replaces the list. Threads are about a project, task, file or approval. Opening a thread
 * marks it read for this person.
 */
export const DiscussionsView: React.FC<DiscussionsViewProps> = ({ project, autoOpenNew = false }) => {
  const { t } = useTranslation();
  const { token } = theme.useToken();
  const navigate = useNavigate();
  const { isMobile } = useResponsive();
  const { can } = useClientAccess();
  const [searchParams, setSearchParams] = useSearchParams();
  const wanted = searchParams.get('thread');

  const [filter, setFilter] = useState<InboxFilter>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [showNew, setShowNew] = useState(autoOpenNew && can.comment);
  const debouncedSearch = useDebouncedValue(search);

  const { data: projects } = useGetProjectsV2Query(undefined, { skip: Boolean(project) });
  const query = useGetThreadsQuery(project ? { projectId: project.id } : undefined);
  const [markRead] = useMarkThreadReadMutation();

  const all = useMemo(() => query.data ?? [], [query.data]);
  const filtered = useMemo(() => {
    const needle = debouncedSearch.trim().toLowerCase();
    return all.filter(thread => {
      if (filter === 'unread' && !thread.unread) return false;
      if (typeFilter !== 'all' && thread.context.type !== typeFilter) return false;
      if (!needle) return true;
      return (
        (thread.ref_no ?? '').toLowerCase().includes(needle) ||
        decodeHtmlEntities(thread.project_name).toLowerCase().includes(needle) ||
        decodeHtmlEntities(thread.context.label).toLowerCase().includes(needle) ||
        thread.messages.some(item => richTextToPlain(item.text).toLowerCase().includes(needle))
      );
    });
  }, [all, filter, typeFilter, debouncedSearch]);

  useEffect(() => {
    setPage(1);
  }, [filter, typeFilter, debouncedSearch]);

  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);

  // On a wide screen the first thread opens by default; on a phone the list is the landing view.
  const selected: ClientThreadV2 | undefined =
    all.find(thread => thread.id === wanted) ?? (!isMobile && !wanted ? filtered[0] : undefined);
  const missing = Boolean(wanted) && query.isSuccess && !all.some(thread => thread.id === wanted);

  // A reply or edit belongs to the thread it was started in.
  const [replyTo, setReplyTo] = useState<ClientThreadMessageV2 | null>(null);
  const [editing, setEditing] = useState<ClientThreadMessageV2 | null>(null);
  useEffect(() => {
    setReplyTo(null);
    setEditing(null);
  }, [selected?.id]);
  const clearContext = () => {
    setReplyTo(null);
    setEditing(null);
  };

  // Read-on-open: once per thread, so a refetch can't loop.
  const marked = useRef<string | null>(null);
  useEffect(() => {
    if (selected?.unread && marked.current !== selected.id) {
      marked.current = selected.id;
      void markRead(selected.id);
    }
  }, [selected?.id, selected?.unread, markRead]);

  const select = (id: string | null) => {
    const next = new URLSearchParams(searchParams);
    if (id) next.set('thread', id);
    else next.delete('thread');
    setSearchParams(next, { replace: true });
  };

  const showList = !isMobile || !selected;
  const showThread = !isMobile || Boolean(selected);
  const isFiltering = debouncedSearch.trim() !== '' || filter === 'unread' || typeFilter !== 'all';

  const uploadBlockedFor = (projectId: string): string | null => {
    if (!can.upload) return t('locked.upload', { defaultValue: "Client Viewers can't upload files." });
    const target = project ?? projects?.find(item => item.id === projectId);
    // Not knowing the project's setting must not look like "allowed": the upload would only fail later.
    if (!target) {
      return projects
        ? t('discussions.uploadsOff', { defaultValue: 'Uploads are turned off for this project.' })
        : t('discussions.uploadsChecking', { defaultValue: 'Checking whether this project allows uploads…' });
    }
    if (!target.allow_uploads) return t('discussions.uploadsOff', { defaultValue: 'Uploads are turned off for this project.' });
    return null;
  };

  const renderItem = (thread: ClientThreadV2) => {
    const isActive = thread.id === selected?.id;
    const last = thread.messages[thread.messages.length - 1];
    const preview =
      (last ? richTextToPlain(last.text) : '') ||
      (last && (last.attachments ?? []).length > 0
        ? t('discussions.attachmentsPreview', { count: last.attachments?.length ?? 0, defaultValue: '{{count}} attachment(s)' })
        : t('discussions.noMessages', { defaultValue: 'No messages yet' }));
    return (
      <button
        key={thread.id}
        type="button"
        onClick={() => select(thread.id)}
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
          background: isActive ? 'var(--portal-brand-tint)' : 'transparent',
          color: token.colorText,
          cursor: 'pointer',
        }}
      >
        <span
          role={thread.unread ? 'img' : undefined}
          aria-label={thread.unread ? t('discussions.unread', { defaultValue: 'Unread' }) : undefined}
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            marginTop: 11,
            flexShrink: 0,
            background: thread.unread ? token.colorError : 'transparent',
          }}
        />
        <ThreadAvatar name={decodeHtmlEntities(thread.project_name)} />
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontWeight: thread.unread ? 700 : 600, fontSize: 13, overflowWrap: 'anywhere' }}>
            {decodeHtmlEntities(thread.context.label)}
          </span>
          <span style={{ display: 'block', fontSize: 11.5, color: token.colorTextSecondary }}>
            {thread.ref_no ? `${thread.ref_no} · ` : ''}
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
            {preview}
          </span>
        </span>
      </button>
    );
  };

  const emptyText = isFiltering
    ? t('discussions.emptyFiltered', { defaultValue: 'No discussions match.' })
    : project
      ? t('discussions.noneInProject', { defaultValue: 'No discussions in this project yet' })
      : t('discussions.none', { defaultValue: 'No discussions yet' });

  return (
    <QueryState {...query} refetch={query.refetch}>
      {missing && <UnavailableBanner what="discussion" />}
      <div
        style={{
          display: 'flex',
          height: project ? 560 : 'calc(100vh - 230px)',
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
              width: isMobile ? '100%' : 340,
              flexShrink: 0,
              display: 'flex',
              flexDirection: 'column',
              borderInlineEnd: isMobile ? 'none' : `1px solid ${token.colorBorderSecondary}`,
              minHeight: 0,
            }}
          >
            <Flex gap={8} style={{ padding: 12 }}>
              <Input
                allowClear
                prefix={<SearchOutlined />}
                value={search}
                onChange={event => setSearch(event.target.value)}
                placeholder={t('discussions.search', { defaultValue: 'Search by ID, project or message' })}
                aria-label={t('discussions.search', { defaultValue: 'Search by ID, project or message' })}
              />
              {can.comment && (
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => setShowNew(true)}
                  aria-label={t('discussions.newTitle', { defaultValue: 'New discussion' })}
                />
              )}
            </Flex>
            <Flex align="center" gap={8} style={{ padding: '0 12px 10px' }}>
              <PillToggle<InboxFilter>
                value={filter}
                onChange={setFilter}
                ariaLabel={t('discussions.filter', { defaultValue: 'Filter discussions' })}
                style={{ height: token.controlHeightSM }}
                options={[
                  { value: 'all', label: t('discussions.all', { defaultValue: 'All' }) },
                  { value: 'unread', label: t('discussions.unread', { defaultValue: 'Unread' }) },
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
                    { key: 'all', label: t('discussions.allTypes', { defaultValue: 'All types' }) },
                    ...THREAD_TYPES.map(type => ({
                      key: type,
                      label: t(`discussions.type.${type}`, {
                        defaultValue: {
                          project: 'Project',
                          task: 'Task',
                          file: 'File',
                          approval: 'Approval',
                          change_request: 'Change request',
                        }[type],
                      }),
                    })),
                  ],
                }}
              >
                <Button
                  size="small"
                  type={typeFilter === 'all' ? 'text' : 'primary'}
                  icon={<FilterOutlined />}
                  style={{ height: token.controlHeightSM, marginInlineStart: 'auto' }}
                  aria-label={t('discussions.typeFilter', { defaultValue: 'Filter by type' })}
                />
              </Dropdown>
            </Flex>
            <div
              role="list"
              style={{ flex: 1, minHeight: 0, overflowY: 'auto', borderTop: `1px solid ${token.colorBorderSecondary}` }}
            >
              {pageRows.length === 0 ? (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  style={{ padding: '24px 12px' }}
                  description={
                    <>
                      {emptyText}
                      {!isFiltering && can.comment && (
                        <div>{t('discussions.startOne', { defaultValue: 'Start one with the + button.' })}</div>
                      )}
                    </>
                  }
                />
              ) : (
                pageRows.map(thread => (
                  <div key={thread.id} role="listitem">
                    {renderItem(thread)}
                  </div>
                ))
              )}
            </div>
            {filtered.length > pageSize && (
              <TablePagination
                page={page}
                pageSize={pageSize}
                total={filtered.length}
                onPageChange={(nextPage, nextSize) => {
                  setPage(nextPage);
                  setPageSize(nextSize);
                }}
              />
            )}
          </div>
        )}

        {showThread && (
          <div style={{ flex: 1, minWidth: 0, minHeight: 0 }}>
            {selected ? (
              <Flex vertical style={{ height: '100%', minHeight: 0 }}>
                <Flex
                  align="center"
                  gap={10}
                  wrap="wrap"
                  style={{ padding: '12px 16px', borderBottom: `1px solid ${token.colorBorderSecondary}` }}
                >
                  {isMobile && (
                    <Button
                      size="small"
                      type="text"
                      icon={<ArrowLeftOutlined />}
                      onClick={() => select(null)}
                      aria-label={t('discussions.back', { defaultValue: 'Back to discussions' })}
                    />
                  )}
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span aria-hidden>{CONTEXT_ICONS[selected.context.type]}</span>
                      <span style={{ overflowWrap: 'anywhere' }}>{decodeHtmlEntities(selected.context.label)}</span>
                    </div>
                    <Flex align="center" gap={4} wrap="wrap" style={{ fontSize: 11, color: token.colorTextTertiary, marginTop: 2 }}>
                      {selected.ref_no && (
                        <>
                          <Typography.Text
                            type="secondary"
                            style={{ fontSize: 11 }}
                            copyable={{
                              text: selected.ref_no,
                              tooltips: [
                                t('discussions.copyRef', { defaultValue: 'Copy discussion ID' }),
                                t('discussions.copiedRef', { defaultValue: 'Copied' }),
                              ],
                            }}
                          >
                            {selected.ref_no}
                          </Typography.Text>
                          <span aria-hidden>·</span>
                        </>
                      )}
                      {project ? (
                        <span>{decodeHtmlEntities(selected.project_name)}</span>
                      ) : (
                        <Tooltip title={t('discussions.openProject', { defaultValue: 'Open this project' })}>
                          <Button
                            type="link"
                            size="small"
                            onClick={() => navigate(`/projects/${selected.project_id}/discussions?thread=${selected.id}`)}
                            style={{ padding: 0, height: 'auto', fontSize: 11 }}
                          >
                            {decodeHtmlEntities(selected.project_name)}
                          </Button>
                        </Tooltip>
                      )}
                    </Flex>
                  </div>
                </Flex>

                <ThreadMessages
                  messages={selected.messages}
                  canComment={can.comment}
                  canModify={can.comment && selected.context.type !== 'change_request'}
                  onReply={message => {
                    setEditing(null);
                    setReplyTo(message);
                  }}
                  onEdit={message => {
                    setReplyTo(null);
                    setEditing(message);
                  }}
                  onDeleted={messageId => {
                    if (replyTo?.id === messageId) setReplyTo(null);
                    if (editing?.id === messageId) setEditing(null);
                  }}
                />

                <ThreadComposer
                  key={selected.id}
                  threadId={selected.id}
                  projectId={selected.project_id}
                  canComment={can.comment}
                  replyTo={replyTo}
                  editing={editing}
                  onClearContext={clearContext}
                  attachBlockedReason={
                    selected.context.type === 'change_request'
                      ? t('discussions.attachChangeRequest', { defaultValue: "Files can't be attached to a change request reply." })
                      : uploadBlockedFor(selected.project_id)
                  }
                />
              </Flex>
            ) : (
              <Flex align="center" justify="center" style={{ height: '100%' }}>
                <Empty
                  image={<MessageOutlined style={{ fontSize: 40, color: token.colorTextQuaternary }} />}
                  description={
                    can.comment
                      ? t('discussions.pick', { defaultValue: 'Select a discussion, or start a new one.' })
                      : t('discussions.pickReadOnly', { defaultValue: 'Select a discussion to read it.' })
                  }
                />
              </Flex>
            )}
          </div>
        )}
      </div>

      <NewDiscussionModal
        open={showNew}
        project={project}
        uploadBlockedReason={can.upload ? null : t('locked.upload', { defaultValue: "Client Viewers can't upload files." })}
        onClose={() => setShowNew(false)}
        onCreated={id => {
          setFilter('all');
          setTypeFilter('all');
          setSearch('');
          select(id);
        }}
      />
    </QueryState>
  );
};
