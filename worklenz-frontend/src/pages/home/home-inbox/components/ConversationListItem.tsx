import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PushpinFilled, PushpinOutlined } from '@ant-design/icons';
import { useAppSelector } from '@/hooks/useAppSelector';
import { themeWiseColor } from '@utils/themeWiseColor';
import { InboxConversation } from '../hooks/useInboxConversations';

const formatTime = (timeString?: string, yesterdayLabel = 'Yesterday') => {
  if (!timeString) return '';
  const date = new Date(timeString);
  if (Number.isNaN(date.getTime())) return '';
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (isToday) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (date.toDateString() === yesterday.toDateString()) return yesterdayLabel;
  return date.toLocaleDateString([], { weekday: 'short' });
};

interface ConversationListItemProps {
  conversation: InboxConversation;
  isActive: boolean;
  isPinned: boolean;
  showCategoryTag?: boolean;
  onClick: () => void;
  onTogglePin: () => void;
}

const ConversationListItem: React.FC<ConversationListItemProps> = ({
  conversation,
  isActive,
  isPinned,
  showCategoryTag,
  onClick,
  onTogglePin,
}) => {
  const { t } = useTranslation('home-inbox');
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const [hovered, setHovered] = useState(false);

  const border = themeWiseColor('#e8e8e8', '#303030', themeMode);
  const hoverBg = themeWiseColor('rgba(0,0,0,.04)', 'rgba(255,255,255,.06)', themeMode);
  const textSec = themeWiseColor('rgba(0,0,0,.45)', 'rgba(255,255,255,.45)', themeMode);
  const tagBg = themeWiseColor('rgba(0,0,0,.06)', 'rgba(255,255,255,.1)', themeMode);

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: '12px 14px',
        cursor: 'pointer',
        borderBottom: `1px solid ${border}`,
        background: isActive || hovered ? hoverBg : 'transparent',
        transition: 'background .1s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
        <div
          style={{
            fontWeight: 600,
            fontSize: 13,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            minWidth: 0,
          }}
        >
          {conversation.category === 'project' && (
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                flexShrink: 0,
                background: conversation.colorCode || '#1677ff',
              }}
            />
          )}
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {conversation.name}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {showCategoryTag && (
            <span
              style={{
                background: tagBg,
                color: textSec,
                borderRadius: 4,
                fontSize: 10,
                fontWeight: 600,
                padding: '1px 6px',
                lineHeight: '16px',
                textTransform: 'uppercase',
                flexShrink: 0,
              }}
            >
              {conversation.category === 'project'
                ? t('categoryProject', { defaultValue: 'Project' })
                : t('categoryClient', { defaultValue: 'Client' })}
            </span>
          )}
          {(hovered || isPinned) && (
            <button
              onClick={e => {
                e.stopPropagation();
                onTogglePin();
              }}
              title={isPinned ? t('unpinChat', { defaultValue: 'Unpin chat' }) : t('pinChat', { defaultValue: 'Pin chat' })}
              style={{
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                padding: 0,
                lineHeight: 1,
                color: isPinned ? '#1677ff' : textSec,
                fontSize: 12,
              }}
            >
              {isPinned ? <PushpinFilled /> : <PushpinOutlined />}
            </button>
          )}
          {!!conversation.unreadCount && (
            <span
              style={{
                background: '#1677ff',
                color: '#fff',
                borderRadius: 10,
                fontSize: 10,
                fontWeight: 700,
                padding: '1px 6px',
                lineHeight: '16px',
              }}
            >
              {conversation.unreadCount}
            </span>
          )}
        </div>
      </div>
      <div style={{ fontSize: 11, color: textSec, marginTop: 2 }}>
        {(conversation.category === 'project'
          ? conversation.authorName || conversation.participants?.[0]
          : conversation.name) || ''}
        {conversation.lastMessageTime
          ? ` · ${formatTime(conversation.lastMessageTime, t('yesterday', { defaultValue: 'Yesterday' }))}`
          : ''}
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
        {conversation.lastMessage ||
          (conversation.category === 'project'
            ? t('noUpdatesYet', { defaultValue: 'No updates yet' })
            : t('noMessagesYet', { defaultValue: 'No messages yet' }))}
      </div>
    </div>
  );
};

export default ConversationListItem;
