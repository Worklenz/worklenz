import { useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import DOMPurify from 'dompurify';
import {
  AuditOutlined,
  CheckSquareOutlined,
  FileTextOutlined,
  FilterOutlined,
  FolderOutlined,
  LockOutlined,
  MessageOutlined,
  PaperClipOutlined,
  SearchOutlined,
  SwapOutlined,
} from '@ant-design/icons';
import { Avatar, Button, Dropdown, Empty, Flex, Input, Segmented, Tag, Typography, theme } from '@/shared/antd-imports';
import { formatPortalDateTime } from '@/components/client-portal/v2';
import type { ClientThreadView, ThreadContextType } from '@/types/client-portal/v2';
import { PageHeader, useContainerWidth } from './PreviewShared';
import { decodeHtmlEntities } from '@/utils/html-entities';

type InboxFilter = 'all' | 'unread';
type TypeFilter = ThreadContextType | 'all';

const THREAD_TYPES: ThreadContextType[] = ['project', 'task', 'file', 'approval', 'change_request'];
const STACK_BELOW_WIDTH = 640;
const INBOX_HEIGHT = 460;

const CONTEXT_ICONS: Record<ThreadContextType, ReactNode> = {
  project: <FolderOutlined />,
  task: <CheckSquareOutlined />,
  file: <FileTextOutlined />,
  approval: <AuditOutlined />,
  change_request: <SwapOutlined />,
};

// Same letter palette the portal uses for its discussion avatars.
const AVATAR_COLORS: Record<string, string> = {
  A: '#154c9b', B: '#3b7ad4', C: '#70a6f3', D: '#7781ca', E: '#9877ca', F: '#c178c9', G: '#ee87c5',
  H: '#ca7881', I: '#75c9c0', J: '#75c997', K: '#80ca79', L: '#aacb78', M: '#cbbc78', N: '#cb9878',
  O: '#bb774c', P: '#905b39', Q: '#903737', R: '#bf4949', S: '#f37070', T: '#ff9c3c', U: '#fbc84c',
  V: '#cbc8a1', W: '#a9a9a9', X: '#767676', Y: '#cb9878', Z: '#903737',
};

const ThreadAvatar = ({ name, size = 28 }: { name: string; size?: number }) => {
  const letter = name.trim().charAt(0).toUpperCase();
  return (
    <Avatar size={size} aria-hidden style={{ backgroundColor: AVATAR_COLORS[letter] ?? '#9e9e9e', flexShrink: 0, fontSize: size / 2 }}>
      {letter || '?'}
    </Avatar>
  );
};

const toPlain = (html: string): string =>
  new DOMParser().parseFromString(DOMPurify.sanitize(html), 'text/html').body.textContent?.trim() ?? '';

interface PreviewDiscussionsProps {
  threads: ClientThreadView[];
  canComment: boolean;
}

/** The discussion inbox, read-only: threads on one side, the open conversation on the other. */
export const PreviewDiscussions = ({ threads, canComment }: PreviewDiscussionsProps) => {
  const { t, i18n } = useTranslation('client-portal-v2-preview');
  const { token } = theme.useToken();
  const { ref, width } = useContainerWidth<HTMLDivElement>();
  const [filter, setFilter] = useState<InboxFilter>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const isStacked = width > 0 && width < STACK_BELOW_WIDTH;

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return threads.filter(thread => {
      if (filter === 'unread' && !thread.unread) return false;
      if (typeFilter !== 'all' && thread.context.type !== typeFilter) return false;
      if (!needle) return true;
      return (
        (thread.ref_no ?? '').toLowerCase().includes(needle) ||
        thread.project_name.toLowerCase().includes(needle) ||
        thread.context.label.toLowerCase().includes(needle) ||
        thread.messages.some(message => toPlain(message.text).toLowerCase().includes(needle))
      );
    });
  }, [threads, filter, typeFilter, search]);

  // On a wide frame the first thread opens by default; on a narrow one the list is the landing view.
  const selected = threads.find(thread => thread.id === selectedId) ?? (!isStacked && !selectedId ? filtered[0] : undefined);
  const isFiltering = search.trim() !== '' || filter === 'unread' || typeFilter !== 'all';

  const typeLabel = (type: ThreadContextType) =>
    ({
      project: t('discussions.type.project', { defaultValue: 'Project' }),
      task: t('discussions.type.task', { defaultValue: 'Task' }),
      file: t('discussions.type.file', { defaultValue: 'File' }),
      approval: t('discussions.type.approval', { defaultValue: 'Approval' }),
      change_request: t('discussions.type.changeRequest', { defaultValue: 'Change request' }),
    })[type];

  const renderItem = (thread: ClientThreadView) => {
    const isActive = thread.id === selected?.id;
    const last = thread.messages[thread.messages.length - 1];
    const preview =
      (last ? toPlain(last.text) : '') ||
      (last && last.attachments.length > 0
        ? t('discussions.attachmentsPreview', { count: last.attachments.length, defaultValue: '{{count}} attachment(s)' })
        : t('discussions.noMessages', { defaultValue: 'No messages yet' }));
    return (
      <button
        key={thread.id}
        type="button"
        onClick={() => setSelectedId(thread.id)}
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
          role={thread.unread ? 'img' : undefined}
          aria-label={thread.unread ? t('discussions.unread', { defaultValue: 'Unread' }) : undefined}
          style={{ width: 8, height: 8, borderRadius: '50%', marginTop: 11, flexShrink: 0, background: thread.unread ? token.colorError : 'transparent' }}
        />
        <ThreadAvatar name={decodeHtmlEntities(thread.project_name)} />
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontWeight: thread.unread ? 700 : 600, fontSize: 13, overflowWrap: 'anywhere' }}>
            {thread.context.label}
          </span>
          <span style={{ display: 'block', fontSize: 11.5, color: token.colorTextSecondary }}>
            {thread.ref_no ? `${thread.ref_no} · ` : ''}
            {decodeHtmlEntities(thread.project_name)}
          </span>
          <span style={{ display: 'block', fontSize: 12, color: token.colorTextTertiary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {preview}
          </span>
        </span>
      </button>
    );
  };

  const showList = !isStacked || !selected;
  const showThread = !isStacked || Boolean(selected);

  return (
    <div ref={ref}>
      <PageHeader
        title={t('discussions.title', { defaultValue: 'Discussions' })}
        subtitle={t('discussions.subtitle', { defaultValue: 'Conversations with your team about your projects.' })}
      />
      <div
        style={{
          display: 'flex',
          height: INBOX_HEIGHT,
          border: `1px solid ${token.colorBorderSecondary}`,
          borderRadius: 8,
          background: token.colorBgContainer,
          overflow: 'hidden',
        }}
      >
        {showList && (
          <div
            style={{
              width: isStacked ? '100%' : 300,
              flexShrink: 0,
              display: 'flex',
              flexDirection: 'column',
              borderInlineEnd: isStacked ? 'none' : `1px solid ${token.colorBorderSecondary}`,
              minHeight: 0,
            }}
          >
            <div style={{ padding: 12 }}>
              <Input
                allowClear
                prefix={<SearchOutlined />}
                value={search}
                onChange={event => setSearch(event.target.value)}
                placeholder={t('discussions.search', { defaultValue: 'Search by ID, project or message' })}
                aria-label={t('discussions.search', { defaultValue: 'Search by ID, project or message' })}
              />
            </div>
            <Flex align="center" gap={8} style={{ padding: '0 12px 10px' }}>
              <Segmented<InboxFilter>
                size="small"
                value={filter}
                onChange={setFilter}
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
                    ...THREAD_TYPES.map(type => ({ key: type, label: typeLabel(type) })),
                  ],
                }}
              >
                <Button
                  size="small"
                  type={typeFilter === 'all' ? 'text' : 'primary'}
                  icon={<FilterOutlined />}
                  style={{ marginInlineStart: 'auto' }}
                  aria-label={t('discussions.typeFilter', { defaultValue: 'Filter by type' })}
                />
              </Dropdown>
            </Flex>
            <div role="list" style={{ flex: 1, minHeight: 0, overflowY: 'auto', borderTop: `1px solid ${token.colorBorderSecondary}` }}>
              {filtered.length === 0 ? (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  style={{ padding: '24px 12px' }}
                  description={
                    isFiltering
                      ? t('discussions.emptyFiltered', { defaultValue: 'No discussions match.' })
                      : t('discussions.none', { defaultValue: 'No discussions yet' })
                  }
                />
              ) : (
                filtered.map(thread => (
                  <div key={thread.id} role="listitem">
                    {renderItem(thread)}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {showThread && (
          <div style={{ flex: 1, minWidth: 0, minHeight: 0 }}>
            {selected ? (
              <ThreadPane thread={selected} language={i18n.language} canComment={canComment} onBack={isStacked ? () => setSelectedId(null) : undefined} />
            ) : (
              <Flex align="center" justify="center" style={{ height: '100%' }}>
                <Empty
                  image={<MessageOutlined style={{ fontSize: 40, color: token.colorTextQuaternary }} />}
                  description={t('discussions.pickReadOnly', { defaultValue: 'Select a discussion to read it.' })}
                />
              </Flex>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

interface ThreadPaneProps {
  thread: ClientThreadView;
  language: string;
  canComment: boolean;
  onBack?: () => void;
}

const ThreadPane = ({ thread, language, canComment, onBack }: ThreadPaneProps) => {
  const { t } = useTranslation('client-portal-v2-preview');
  const { token } = theme.useToken();

  return (
    <Flex vertical style={{ height: '100%', minHeight: 0 }}>
      <Flex align="center" gap={10} wrap="wrap" style={{ padding: '12px 16px', borderBottom: `1px solid ${token.colorBorderSecondary}` }}>
        {onBack && (
          <Button size="small" type="text" onClick={onBack}>
            {t('discussions.back', { defaultValue: '← Discussions' })}
          </Button>
        )}
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span aria-hidden>{CONTEXT_ICONS[thread.context.type]}</span>
            <span style={{ overflowWrap: 'anywhere' }}>{thread.context.label}</span>
          </div>
          <div style={{ fontSize: 11, color: token.colorTextTertiary, marginTop: 2 }}>
            {thread.ref_no ? `${thread.ref_no} · ` : ''}
            {decodeHtmlEntities(thread.project_name)}
          </div>
        </div>
      </Flex>

      <div role="log" aria-label={t('discussions.messagesLabel', { defaultValue: 'Messages' })} style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 16 }}>
        {thread.messages.length === 0 && (
          <Typography.Text type="secondary">{t('discussions.noMessages', { defaultValue: 'No messages yet' })}</Typography.Text>
        )}
        {thread.messages.map(message => {
          const isMine = message.mine;
          const isTeam = message.side === 'internal';
          const isClientOnly = message.visibility === 'client_only';
          const onBrand = isMine && !isClientOnly;
          return (
            <Flex key={message.id} gap={8} justify={isMine ? 'flex-end' : 'flex-start'} style={{ marginBottom: 14 }}>
              {!isMine && <ThreadAvatar name={message.author} />}
              <div style={{ maxWidth: 'min(560px, 82%)' }}>
                <Flex
                  align="center"
                  gap={6}
                  wrap="wrap"
                  justify={isMine ? 'flex-end' : 'flex-start'}
                  style={{ fontSize: 11.5, color: token.colorTextSecondary, marginBottom: 2 }}
                >
                  <span>{message.author}</span>
                  {isTeam && (
                    <Tag color="blue" style={{ marginInlineEnd: 0 }}>
                      {t('discussions.team', { defaultValue: 'Team' })}
                    </Tag>
                  )}
                  {isClientOnly && (
                    <Tag color="orange" icon={<LockOutlined />} style={{ marginInlineEnd: 0 }}>
                      {t('discussions.clientOnlyTag', { defaultValue: 'Client users only' })}
                    </Tag>
                  )}
                </Flex>
                <div
                  style={{
                    padding: '8px 12px',
                    borderRadius: 10,
                    background: isClientOnly ? token.colorWarningBg : isMine ? token.colorPrimary : token.colorFillQuaternary,
                    color: onBrand ? token.colorTextLightSolid : token.colorText,
                    border: isClientOnly ? `1px dashed ${token.colorWarning}` : 'none',
                    wordBreak: 'break-word',
                    fontSize: 13,
                  }}
                >
                  {message.reply_to && (
                    <div
                      style={{
                        marginBottom: 6,
                        padding: '2px 8px',
                        borderInlineStart: `3px solid ${onBrand ? token.colorTextLightSolid : token.colorPrimary}`,
                        fontSize: 12,
                        opacity: 0.85,
                      }}
                    >
                      <div style={{ fontWeight: 600 }}>{message.reply_to.author}</div>
                      <div style={{ fontStyle: message.reply_to.deleted ? 'italic' : 'normal', overflowWrap: 'anywhere' }}>
                        {message.reply_to.deleted
                          ? t('discussions.messageDeleted', { defaultValue: 'This message was deleted' })
                          : message.reply_to.snippet}
                      </div>
                    </div>
                  )}
                  {message.deleted ? (
                    <span style={{ fontStyle: 'italic', opacity: 0.8 }}>
                      {t('discussions.messageDeleted', { defaultValue: 'This message was deleted' })}
                    </span>
                  ) : (
                    <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(message.text) }} />
                  )}
                  {!message.deleted &&
                    message.attachments.map(attachment => (
                      <div key={attachment.id} style={{ marginTop: 6, fontSize: 12 }}>
                        <PaperClipOutlined /> {attachment.name}
                      </div>
                    ))}
                </div>
                <div style={{ fontSize: 11, color: token.colorTextTertiary, marginTop: 2, textAlign: isMine ? 'right' : 'left' }}>
                  {formatPortalDateTime(message.at, language)}
                  {message.edited && ` · ${t('discussions.edited', { defaultValue: 'edited' })}`}
                </div>
              </div>
            </Flex>
          );
        })}
      </div>

      <div style={{ padding: '10px 16px', borderTop: `1px solid ${token.colorBorderSecondary}`, color: token.colorTextTertiary, fontSize: 12 }}>
        {canComment
          ? t('discussions.previewComposer', { defaultValue: 'Preview only — this user can reply here in the real portal.' })
          : t('discussions.previewComposerReadOnly', { defaultValue: 'Preview only — this role can read discussions but not reply.' })}
      </div>
    </Flex>
  );
};
