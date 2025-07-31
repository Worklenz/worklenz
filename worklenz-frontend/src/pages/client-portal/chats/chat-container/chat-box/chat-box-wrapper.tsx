import { Card, Divider, Flex, Typography, Spin, Empty, Button } from 'antd';
import React, { ReactNode, useState, useEffect } from 'react';
import ChatList from '../chat-list';
import ChatBox from './chat-box';
import { useAppSelector } from '../../../../../hooks/useAppSelector';
import { useGetChatsQuery } from '../../../../../api/client-portal/client-portal-api';
import { useTranslation } from 'react-i18next';
import { MessageOutlined } from '@ant-design/icons';

export type TempChatsType = {
  id: string;
  name: string;
  chats_data: {
    id: string;
    content: ReactNode | string;
    time: Date;
    is_me: boolean;
  }[];
  status: 'read' | 'unread';
  lastMessage?: string;
  lastMessageTime?: string;
  unreadCount?: number;
  participants?: string[];
};

const ChatBoxWrapper = () => {
  const [openedChatId, setOpenedChatId] = useState<string | null>(null);
  
  // localization
  const { t } = useTranslation('client-portal-chats');
  
  // Fetch chats from API
  const { data: apiChats, isLoading, error, refetch } = useGetChatsQuery(undefined, {
    // Force skip cache and make fresh request
    refetchOnMountOrArgChange: true,
    // Skip the query if we don't have auth
    skip: false
  });
  
  // Debug logging
  React.useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('Chat API Query State:', {
        isLoading,
        error,
        apiChats,
        hasData: !!apiChats
      });
    }
  }, [isLoading, error, apiChats]);

  // Force refetch when component mounts
  React.useEffect(() => {
    console.log('ChatBoxWrapper mounted, triggering refetch...');
    console.log('RTK Query hook state:', { isLoading, error, apiChats });
    refetch();
  }, [refetch]);

  // get chat list from redux (fallback to local state)
  const localChatList = useAppSelector(
    (state) => state.clientsPortalReducer.chatsReducer.chatList
  );

  // Convert API chats to local format or use local data
  const chatList = React.useMemo(() => {
    try {
      if (process.env.NODE_ENV === 'development') {
        console.log('API Chats Response:', apiChats);
        console.log('Is apiChats an array?', Array.isArray(apiChats));
      }
      
      // Handle different response formats
      let chatsArray = apiChats;
      
      // If the response is wrapped in an object (like { body: [...] })
      if (apiChats && typeof apiChats === 'object' && !Array.isArray(apiChats)) {
        const apiChatsObj = apiChats as any;
        if (apiChatsObj.body && Array.isArray(apiChatsObj.body)) {
          chatsArray = apiChatsObj.body;
        } else if (apiChatsObj.data && Array.isArray(apiChatsObj.data)) {
          chatsArray = apiChatsObj.data;
        }
      }
      
      if (chatsArray && Array.isArray(chatsArray)) {
        return chatsArray.map(chat => ({
          id: chat.id || '',
          name: chat.title || chat.participants?.join(', ') || 'Unknown',
          chats_data: [], // Will be loaded when chat is opened
          status: (chat.unreadCount > 0 ? 'unread' : 'read') as 'read' | 'unread',
          lastMessage: chat.lastMessage || '',
          lastMessageTime: chat.lastMessageTime || '',
          unreadCount: chat.unreadCount || 0,
          participants: chat.participants || []
        }));
      }
      return localChatList || [];
    } catch (error) {
      console.error('Error processing chat list:', error);
      return localChatList || [];
    }
  }, [apiChats, localChatList]);

  // get the opened chat
  const openedChat = Array.isArray(chatList) ? chatList.find((chat) => chat.id === openedChatId) : null;

  if (isLoading) {
    return (
      <Card
        style={{ height: 'calc(100vh - 280px)', overflow: 'hidden' }}
        styles={{ body: { padding: 0 } }}
      >
        <Flex align="center" justify="center" style={{ height: '100%' }}>
          <Flex vertical align="center" gap={16}>
            <Spin size="large" />
            <Typography.Text type="secondary">Loading chats...</Typography.Text>
          </Flex>
        </Flex>
      </Card>
    );
  }

  if (error) {
    return (
      <Card
        style={{ height: 'calc(100vh - 280px)', overflow: 'hidden' }}
        styles={{ body: { padding: 0 } }}
      >
        <Flex align="center" justify="center" style={{ height: '100%' }}>
          <Flex vertical align="center" gap={16}>
            <Typography.Text type="danger">Error loading chats</Typography.Text>
            <Typography.Text type="secondary">
              {error && 'data' in error ? String(error.data) : 'Something went wrong'}
            </Typography.Text>
            <button onClick={() => refetch()}>
              Retry
            </button>
          </Flex>
        </Flex>
      </Card>
    );
  }

  // Handle empty state
  if (!chatList || chatList.length === 0) {
    return (
      <Card
        style={{ height: 'calc(100vh - 280px)', overflow: 'hidden' }}
        styles={{ body: { padding: 0 } }}
      >
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            <div>
              <Typography.Title level={4} style={{ marginBottom: 8 }}>
                {t('noChatsTitle')}
              </Typography.Title>
              <Typography.Text type="secondary">
                {t('noChatsDescription')}
              </Typography.Text>
            </div>
          }
          style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            justifyContent: 'center', 
            alignItems: 'center',
            height: 'calc(100vh - 320px)'
          }}
        >
          <Button
            type="primary"
            icon={<MessageOutlined />}
            onClick={() => setOpenedChatId(null)}
          >
            {t('startConversation')}
          </Button>
        </Empty>
      </Card>
    );
  }

  return (
    <Card
      style={{ height: 'calc(100vh - 280px)', overflow: 'hidden' }}
      styles={{ body: { padding: 0 } }}
    >
      <Flex>
        {/* chat list */}
        <ChatList chatList={chatList} setOpenedChatId={setOpenedChatId} />

        <Divider
          type="vertical"
          style={{ height: 'calc(100vh - 300px)', marginInline: 0 }}
        />

        {/* chat box */}
        {openedChat ? (
          <ChatBox openedChat={openedChat} />
        ) : (
          <Flex
            align="center"
            justify="center"
            style={{
              width: '100%',
              height: '100%',
              marginBlock: 24,
            }}
          >
            <Typography.Text type="secondary">
              {t('selectChatMessage')}
            </Typography.Text>
          </Flex>
        )}
      </Flex>
    </Card>
  );
};

export default ChatBoxWrapper;
