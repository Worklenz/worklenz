import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Flex, Input, Typography } from '@/shared/antd-imports';
import { PlusOutlined, SearchOutlined } from '@ant-design/icons';
import CustomAvatar from '@components/CustomAvatar';
import { useAppSelector } from '@/hooks/useAppSelector';
import { themeWiseColor } from '@utils/themeWiseColor';
import type { ClientPortalChatConversation } from '@/api/client-portal/client-portal-api';
import { formatTime } from '@/pages/home/home-inbox/components/ConversationListItem';
import {
  ChatDotTone,
  ChatStatusTag,
  filterChatConversations,
  getChatDotTone,
  getChatStatusTag,
} from '../chats-helpers';

interface ChatsConversationListProps {
  conversations: ClientPortalChatConversation[];
  selectedId: string | null;
  onSelect: (conversation: ClientPortalChatConversation) => void;
  onNewChat: () => void;
}

export const ChatsConversationList: React.FC<ChatsConversationListProps> = ({
  conversations,
  selectedId,
  onSelect,
  onNewChat,
}) => {
  const { t } = useTranslation('client-portal-chats');
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const [query, setQuery] = useState('');

  const visible = filterChatConversations(conversations, query);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <Flex gap={6} style={{ flexShrink: 0, padding: '10px 10px' }}>
        <Input
          placeholder={t('searchChats', { defaultValue: 'Search chats' })}
          aria-label={t('searchChats', { defaultValue: 'Search chats' })}
          prefix={
            <SearchOutlined style={{ color: themeWiseColor('#bfbfbf', '#6b6b6b', themeMode) }} />
          }
          value={query}
          onChange={e => setQuery(e.target.value)}
          allowClear
          size="small"
          style={{
            borderRadius: 8,
            backgroundColor: themeWiseColor('#fafafa', '#1f1f1f', themeMode),
          }}
        />
        <Button
          size="small"
          type="primary"
          icon={<PlusOutlined />}
          onClick={onNewChat}
          title={t('newChatTitle', { defaultValue: 'New chat' })}
          aria-label={t('newChatTitle', { defaultValue: 'New chat' })}
        />
      </Flex>

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        {visible.length === 0 ? (
          <Flex vertical align="center" justify="center" gap={10} style={{ padding: 24, textAlign: 'center' }}>
            {query ? (
              <>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  {t('noChatsMatch', {
                    query,
                    defaultValue: 'No chats match "{{query}}".',
                  })}
                </Typography.Text>
                <Button size="small" onClick={() => setQuery('')}>
                  {t('clearSearch', { defaultValue: 'Clear search' })}
                </Button>
              </>
            ) : (
              <Typography.Text type="secondary" style={{ fontSize: 12, maxWidth: 240 }}>
                {t('noChatsAvailable', {
                  defaultValue:
                    'Clients with at least one project appear here so you can message them.',
                })}
              </Typography.Text>
            )}
          </Flex>
        ) : (
          visible.map(conversation => (
            <ChatsConversationListItem
              key={conversation.id}
              conversation={conversation}
              isActive={selectedId === conversation.id}
              onClick={() => onSelect(conversation)}
            />
          ))
        )}
      </div>
    </div>
  );
};

interface ChatsConversationListItemProps {
  conversation: ClientPortalChatConversation;
  isActive: boolean;
  onClick: () => void;
}

const ChatsConversationListItem: React.FC<ChatsConversationListItemProps> = ({
  conversation,
  isActive,
  onClick,
}) => {
  const { t } = useTranslation('client-portal-chats');
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const [hovered, setHovered] = useState(false);

  const border = themeWiseColor('#e8e8e8', '#303030', themeMode);
  const hoverBg = themeWiseColor('rgba(0,0,0,.04)', 'rgba(255,255,255,.06)', themeMode);
  const textSec = themeWiseColor('rgba(0,0,0,.45)', 'rgba(255,255,255,.45)', themeMode);

  const dotColors: Record<ChatDotTone, string> = {
    unread: '#ff4d4f',
    active: '#1677ff',
    none: 'transparent',
  };
  const tagColors: Record<ChatStatusTag, { background: string; color: string }> = {
    active: { background: 'rgba(82,196,26,.12)', color: '#52c41a' },
    expired: { background: 'rgba(255,77,79,.12)', color: '#ff4d4f' },
    invited: {
      background: 'rgba(250,173,20,.12)',
      color: themeWiseColor('#d46b08', '#faad14', themeMode),
    },
  };
  const tagLabels: Record<ChatStatusTag, string> = {
    active: t('statusActive', { defaultValue: 'Active' }),
    expired: t('statusExpired', { defaultValue: 'Expired' }),
    invited: t('statusInvited', { defaultValue: 'Invited' }),
  };

  const tag = getChatStatusTag(conversation);
  const hasMessages = !!conversation.lastMessage;
  const sender =
    conversation.lastSenderType === 'team_member'
      ? t('youText', { defaultValue: 'You' })
      : conversation.lastSenderName || conversation.name;
  const time = formatTime(
    conversation.lastMessageAt ?? undefined,
    t('yesterday', { defaultValue: 'Yesterday' })
  );

  return (
    <div
      role="button"
      tabIndex={0}
      aria-current={isActive ? 'true' : undefined}
      onClick={onClick}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        padding: '12px 14px',
        cursor: 'pointer',
        borderBottom: `1px solid ${border}`,
        background: isActive || hovered ? hoverBg : 'transparent',
        transition: 'background .1s',
      }}
    >
      <span
        aria-hidden
        style={{
          width: 8,
          height: 8,
          minWidth: 8,
          borderRadius: '50%',
          marginTop: 7,
          background: dotColors[getChatDotTone(conversation)],
        }}
      />
      <CustomAvatar avatarName={conversation.name || '?'} size={30} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <Flex align="center" justify="space-between" gap={6}>
          <span
            style={{
              fontWeight: 600,
              fontSize: 13,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {conversation.name}
          </span>
          {tag && (
            <span
              style={{
                ...tagColors[tag],
                borderRadius: 4,
                fontSize: 10,
                fontWeight: 600,
                padding: '1px 6px',
                lineHeight: '16px',
                textTransform: 'uppercase',
                flexShrink: 0,
              }}
            >
              {tagLabels[tag]}
            </span>
          )}
        </Flex>
        <div style={{ fontSize: 11, color: textSec, marginTop: 2 }}>
          {hasMessages
            ? `${sender}${time ? ` · ${time}` : ''}`
            : t('noMessagesYet', { defaultValue: 'No messages yet' })}
        </div>
        <div
          style={{
            fontSize: 12,
            color: textSec,
            marginTop: 3,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontWeight: conversation.unreadCount ? 600 : 400,
          }}
        >
          {hasMessages
            ? conversation.lastMessage
            : t('sayHello', { defaultValue: 'Say hello to get started.' })}
        </div>
      </div>
    </div>
  );
};
