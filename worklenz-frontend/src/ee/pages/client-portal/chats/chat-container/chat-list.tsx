import { Flex, Typography, Badge, Input } from '@/shared/antd-imports';
import React, { useState } from 'react';
import { TempChatsType } from './chat-box/chat-box-wrapper';
import { SearchOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import CustomAvatar from '@components/CustomAvatar';
import { useAppSelector } from '@/hooks/useAppSelector';
import { themeWiseColor } from '@utils/themeWiseColor';

type ChatListProps = {
  chatList: TempChatsType[];
  setOpenedChatId: (id: string) => void;
  selectedChatId?: string | null;
};

const ChatList = ({ chatList, setOpenedChatId, selectedChatId }: ChatListProps) => {
  const { t } = useTranslation('client-portal-chats');
  const [isNewChatModalOpen, setIsNewChatModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const themeMode = useAppSelector(state => state.themeReducer.mode);

  const handleNewChat = () => {
    setIsNewChatModalOpen(true);
  };

  const handleNewChatSuccess = (chatId: string) => {
    setOpenedChatId(chatId);
    setIsNewChatModalOpen(false);
  };

  // Ensure chatList is always an array and filter by search
  const safeChatList = Array.isArray(chatList) ? chatList : [];
  const filteredChatList = safeChatList.filter(
    chat =>
      chat.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      chat.lastMessage?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatTime = (timeString?: string) => {
    if (!timeString) return '';
    const date = new Date(timeString);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday = date.toDateString() === yesterday.toDateString();

    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (isYesterday) {
      return t('yesterday');
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  const getLastMessagePreview = (record: TempChatsType) => {
    // First check if lastMessage exists and is not empty
    if (record.lastMessage && record.lastMessage.trim()) {
      return record.lastMessage;
    }
    // Then check if there are messages in chats_data
    if (record.chats_data && Array.isArray(record.chats_data) && record.chats_data.length > 0) {
      const lastMsg = record.chats_data[record.chats_data.length - 1];
      return lastMsg.is_me ? `${t('youText')}: ${lastMsg.content}` : String(lastMsg.content);
    }
    // Only show "No messages yet" if we're certain there are no messages
    // Check if lastMessageTime exists - if it does, there might be messages but lastMessage wasn't loaded
    if (record.lastMessageTime) {
      // If there's a timestamp but no message, it might be loading or there's a sync issue
      // Show a meaningful message instead of empty string
      return t('messageUnavailable');
    }
    return t('noMessagesYet');
  };

  return (
    <Flex
      vertical
      style={{
        width: 320,
        minWidth: 320,
        height: '100%',
        borderRight: `1px solid ${themeWiseColor('#f0f0f0', '#303030', themeMode)}`,
      }}
    >
      {/* Header */}
      <Flex
        justify="center"
        align="center"
        style={{
          padding: '16px',
          borderBottom: `1px solid ${themeWiseColor('#f0f0f0', '#303030', themeMode)}`,
        }}
      >
        <Typography.Text strong style={{ fontSize: 16 }}>
          {t('chatsTitle')}
        </Typography.Text>
      </Flex>

      {/* Search */}
      <div style={{ padding: '12px 16px' }}>
        <Input
          placeholder={t('searchConversations')}
          prefix={
            <SearchOutlined style={{ color: themeWiseColor('#bfbfbf', '#6b6b6b', themeMode) }} />
          }
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          allowClear
          style={{
            borderRadius: 8,
            backgroundColor: themeWiseColor('#fafafa', '#1f1f1f', themeMode),
          }}
        />
      </div>

      {/* Chat List */}
      <Flex
        vertical
        style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
        }}
      >
        {filteredChatList.length === 0 ? (
          <Flex align="center" justify="center" style={{ padding: 24, height: '100%' }}>
            <Typography.Text type="secondary">
              {searchQuery ? t('noClientsFound') : t('noChatsDescription')}
            </Typography.Text>
          </Flex>
        ) : (
          filteredChatList.map(chat => (
            <Flex
              key={chat.id}
              align="center"
              gap={12}
              onClick={() => setOpenedChatId(chat.id)}
              style={{
                padding: '12px 16px',
                cursor: 'pointer',
                backgroundColor:
                  selectedChatId === chat.id
                    ? themeWiseColor('#e6f4ff', '#111d2c', themeMode)
                    : 'transparent',
                borderLeft:
                  selectedChatId === chat.id ? '3px solid #1890ff' : '3px solid transparent',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={e => {
                if (selectedChatId !== chat.id) {
                  e.currentTarget.style.backgroundColor = themeWiseColor(
                    '#fafafa',
                    '#262626',
                    themeMode
                  );
                }
              }}
              onMouseLeave={e => {
                if (selectedChatId !== chat.id) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }
              }}
            >
              {/* Avatar with badge */}
              <Badge count={chat.unreadCount || 0} size="small" offset={[-4, 4]}>
                <CustomAvatar avatarName={chat.name} size={44} />
              </Badge>

              {/* Chat info */}
              <Flex vertical flex={1} style={{ minWidth: 0, overflow: 'hidden' }}>
                <Flex justify="space-between" align="center" style={{ marginBottom: 4 }}>
                  <Typography.Text
                    strong={!!chat.unreadCount}
                    style={{
                      fontSize: 14,
                      textTransform: 'capitalize',
                      maxWidth: 150,
                    }}
                    ellipsis={{ tooltip: chat.name }}
                  >
                    {chat.name}
                  </Typography.Text>
                  <Typography.Text type="secondary" style={{ fontSize: 11, flexShrink: 0 }}>
                    {formatTime(chat.lastMessageTime)}
                  </Typography.Text>
                </Flex>

                <Typography.Text
                  type="secondary"
                  style={{
                    fontSize: 13,
                    fontWeight: chat.unreadCount ? 500 : 400,
                    color: chat.unreadCount
                      ? themeWiseColor('#262626', '#d9d9d9', themeMode)
                      : undefined,
                  }}
                  ellipsis
                >
                  {getLastMessagePreview(chat)}
                </Typography.Text>
              </Flex>
            </Flex>
          ))
        )}
      </Flex>
    </Flex>
  );
};

export default ChatList;
