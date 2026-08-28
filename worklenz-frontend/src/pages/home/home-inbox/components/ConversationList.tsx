import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Flex, Input, Spin, Typography } from '@/shared/antd-imports';
import { PlusOutlined, SearchOutlined } from '@ant-design/icons';
import { useAppSelector } from '@/hooks/useAppSelector';
import { themeWiseColor } from '@utils/themeWiseColor';
import { InboxConversation } from '../hooks/useInboxConversations';
import ConversationListItem from './ConversationListItem';

interface ConversationListProps {
  conversations: InboxConversation[];
  selectedId: string | null;
  pinnedIds: string[];
  loading: boolean;
  search: string;
  showCategoryTag?: boolean;
  onSearchChange: (value: string) => void;
  onSelect: (conversation: InboxConversation) => void;
  onTogglePin: (conversationId: string) => void;
  onNewChat: () => void;
}

const ConversationList: React.FC<ConversationListProps> = ({
  conversations,
  selectedId,
  pinnedIds,
  loading,
  search,
  showCategoryTag,
  onSearchChange,
  onSelect,
  onTogglePin,
  onNewChat,
}) => {
  const { t } = useTranslation('home-inbox');
  const themeMode = useAppSelector(state => state.themeReducer.mode);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <Flex gap={6} style={{ flexShrink: 0, padding: '4px 10px 10px' }}>
        <Input
          placeholder={t('searchPlaceholder', { defaultValue: 'Search chats' })}
          prefix={
            <SearchOutlined style={{ color: themeWiseColor('#bfbfbf', '#6b6b6b', themeMode) }} />
          }
          value={search}
          onChange={e => onSearchChange(e.target.value)}
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
          title={t('newChat', { defaultValue: 'New chat' })}
        />
      </Flex>

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        {loading ? (
          <Flex align="center" justify="center" style={{ padding: 24 }}>
            <Spin />
          </Flex>
        ) : conversations.length === 0 ? (
          <Flex vertical align="center" justify="center" gap={10} style={{ padding: 24, textAlign: 'center' }}>
            {search ? (
              <>
                <Typography.Text type="secondary">{t('noConversations')}</Typography.Text>
                <Button size="small" onClick={() => onSearchChange('')}>
                  {t('clearSearch')}
                </Button>
              </>
            ) : (
              <>
                <Typography.Text strong>{t('noConversationsYet')}</Typography.Text>
                <Typography.Text type="secondary" style={{ fontSize: 12, maxWidth: 220 }}>
                  {t('startFirstChat')}
                </Typography.Text>
                <Button size="small" type="primary" icon={<PlusOutlined />} onClick={onNewChat}>
                  {t('newChat')}
                </Button>
              </>
            )}
          </Flex>
        ) : (
          conversations.map(conversation => (
            <ConversationListItem
              key={conversation.id}
              conversation={conversation}
              isActive={selectedId === conversation.id}
              isPinned={pinnedIds.includes(conversation.id)}
              showCategoryTag={showCategoryTag}
              onClick={() => onSelect(conversation)}
              onTogglePin={() => onTogglePin(conversation.id)}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default ConversationList;
