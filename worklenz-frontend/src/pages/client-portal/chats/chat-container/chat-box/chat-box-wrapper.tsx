import { Card, Flex, Typography, Spin, Button } from '@/shared/antd-imports';
import React, { ReactNode, useState } from 'react';
import ChatList from '../chat-list';
import ChatBox from './chat-box';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import {
  useGetOrganizationChatsQuery,
  clientPortalApi,
} from '../../../../../api/client-portal/client-portal-api';
import { useTranslation } from 'react-i18next';
import { MessageOutlined, ReloadOutlined, InboxOutlined } from '@ant-design/icons';
import NewChatModal from '@components/client-portal/NewChatModal';
import { themeWiseColor } from '@utils/themeWiseColor';

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
  clientId?: string;
};

interface ChatBoxWrapperProps {
  isNewChatModalOpen?: boolean;
  setIsNewChatModalOpen?: (open: boolean) => void;
}

const ChatBoxWrapper = ({
  isNewChatModalOpen: propIsNewChatModalOpen,
  setIsNewChatModalOpen: propSetIsNewChatModalOpen,
}: ChatBoxWrapperProps = {}) => {
  const [openedChatId, setOpenedChatId] = useState<string | null>(null);
  const [internalIsNewChatModalOpen, setInternalIsNewChatModalOpen] = useState(false);
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const dispatch = useAppDispatch();

  // Use prop if provided, otherwise use internal state
  const isNewChatModalOpen =
    propIsNewChatModalOpen !== undefined ? propIsNewChatModalOpen : internalIsNewChatModalOpen;
  const setIsNewChatModalOpen = propSetIsNewChatModalOpen || setInternalIsNewChatModalOpen;

  const { t } = useTranslation('client-portal-chats');

  const {
    data: apiChatsData,
    isLoading,
    error,
    refetch,
  } = useGetOrganizationChatsQuery(
    {},
    {
      refetchOnMountOrArgChange: true,
      skip: false,
    }
  );

  const localChatList = useAppSelector(state => state.clientsPortalReducer.chatsReducer.chatList);

  const chatList = React.useMemo(() => {
    try {
      // Handle the API response - it could be an array directly or wrapped
      let chatsArray: any[] = [];

      if (Array.isArray(apiChatsData)) {
        chatsArray = apiChatsData;
      } else if (apiChatsData && typeof apiChatsData === 'object') {
        const data = apiChatsData as any;
        if (data.chats && Array.isArray(data.chats)) {
          chatsArray = data.chats;
        } else if (data.body && Array.isArray(data.body)) {
          chatsArray = data.body;
        } else if (data.data && Array.isArray(data.data)) {
          chatsArray = data.data;
        }
      }

      if (chatsArray.length > 0) {
        return chatsArray.map((chat: any) => {
          // Extract clientId from chatId if not provided directly
          let clientId = chat.clientId;
          if (!clientId && chat.id && chat.id.includes('-')) {
            const parts = chat.id.split('-');
            if (parts.length >= 4) {
              const dateParts = parts.slice(-3);
              const dateStrTest = dateParts.join('-');
              if (/^\d{4}-\d{2}-\d{2}$/.test(dateStrTest)) {
                clientId = parts.slice(0, -3).join('-');
              }
            }
          }

          return {
            id: chat.id || '',
            name: chat.clientName || chat.title || chat.participants?.join(', ') || 'Unknown',
            chats_data: [],
            status: (chat.unreadCount > 0 ? 'unread' : 'read') as 'read' | 'unread',
            lastMessage: chat.lastMessage || '',
            lastMessageTime: chat.lastMessageTime || chat.lastMessageAt || '',
            unreadCount: chat.unreadCount || 0,
            participants: chat.participants || [],
            clientId: clientId || chat.clientId,
          };
        });
      }
      return localChatList || [];
    } catch (err) {
      console.error('Error processing chat list:', err);
      return localChatList || [];
    }
  }, [apiChatsData, localChatList]);

  const openedChat = Array.isArray(chatList)
    ? chatList.find(chat => chat.id === openedChatId)
    : null;

  const handleNewChatSuccess = (chatId: string) => {
    setOpenedChatId(chatId);
    setIsNewChatModalOpen(false);
    // Invalidate cache and refetch chat list to show the new conversation
    dispatch(clientPortalApi.util.invalidateTags(['Chats']));
    refetch();
  };

  // Loading state
  if (isLoading) {
    return (
      <Card
        style={{
          height: 'calc(100vh - 280px)',
          overflow: 'hidden',
          borderRadius: 12,
        }}
        styles={{ body: { padding: 0, height: '100%' } }}
      >
        <Flex align="center" justify="center" style={{ height: '100%' }}>
          <Flex vertical align="center" gap={16}>
            <Spin size="large" />
            <Typography.Text type="secondary">{t('loadingChats')}</Typography.Text>
          </Flex>
        </Flex>
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card
        style={{
          height: 'calc(100vh - 280px)',
          overflow: 'hidden',
          borderRadius: 12,
        }}
        styles={{ body: { padding: 0, height: '100%' } }}
      >
        <Flex align="center" justify="center" style={{ height: '100%' }}>
          <Flex vertical align="center" gap={16} style={{ textAlign: 'center', padding: 24 }}>
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: '50%',
                backgroundColor: themeWiseColor('#fff1f0', '#2a1215', themeMode),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <InboxOutlined style={{ fontSize: 28, color: '#ff4d4f' }} />
            </div>
            <Typography.Title level={5} style={{ margin: 0 }}>
              {t('errorLoadingChats')}
            </Typography.Title>
            <Typography.Text type="secondary" style={{ maxWidth: 300 }}>
              {t('errorLoadingChatsDescription')}
            </Typography.Text>
            <Button
              type="primary"
              icon={<ReloadOutlined />}
              onClick={() => refetch()}
              style={{ marginTop: 8 }}
            >
              {t('retryButton')}
            </Button>
          </Flex>
        </Flex>
      </Card>
    );
  }

  // Empty state
  if (!chatList || chatList.length === 0) {
    return (
      <Card
        style={{
          height: 'calc(100vh - 280px)',
          overflow: 'hidden',
          borderRadius: 12,
        }}
        styles={{ body: { padding: 0, height: '100%' } }}
      >
        <Flex align="center" justify="center" style={{ height: '100%' }}>
          <Flex vertical align="center" gap={20} style={{ textAlign: 'center', padding: 24 }}>
            <div
              style={{
                width: 80,
                height: 80,
                borderRadius: '50%',
                backgroundColor: themeWiseColor('#e6f4ff', '#111d2c', themeMode),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <MessageOutlined style={{ fontSize: 36, color: '#1890ff' }} />
            </div>
            <div>
              <Typography.Title level={4} style={{ margin: '0 0 8px 0' }}>
                {t('emptyStateTitle')}
              </Typography.Title>
              <Typography.Text type="secondary" style={{ maxWidth: 320, display: 'block' }}>
                {t('emptyStateDescription')}
              </Typography.Text>
            </div>
            <Button
              type="primary"
              icon={<MessageOutlined />}
              onClick={() => setIsNewChatModalOpen(true)}
              size="large"
              style={{
                height: 44,
                fontSize: 14,
                fontWeight: 500,
                paddingInline: 28,
                borderRadius: 8,
              }}
            >
              {t('startConversation')}
            </Button>
          </Flex>
        </Flex>
        <NewChatModal
          open={isNewChatModalOpen}
          onClose={() => setIsNewChatModalOpen(false)}
          onSuccess={handleNewChatSuccess}
        />
      </Card>
    );
  }

  // Main chat view
  return (
    <Card
      style={{
        height: 'calc(100vh - 280px)',
        overflow: 'hidden',
        borderRadius: 12,
      }}
      styles={{ body: { padding: 0, height: '100%' } }}
    >
      <Flex style={{ height: '100%' }}>
        {/* Chat list sidebar */}
        <ChatList
          chatList={chatList}
          setOpenedChatId={setOpenedChatId}
          selectedChatId={openedChatId}
        />

        {/* Chat content area */}
        {openedChat ? (
          <ChatBox openedChat={openedChat} />
        ) : (
          <Flex
            align="center"
            justify="center"
            vertical
            gap={16}
            style={{
              flex: 1,
              height: '100%',
              backgroundColor: themeWiseColor('#fafafa', '#141414', themeMode),
            }}
          >
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: '50%',
                backgroundColor: themeWiseColor('#f0f0f0', '#262626', themeMode),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <MessageOutlined
                style={{
                  fontSize: 28,
                  color: themeWiseColor('#bfbfbf', '#595959', themeMode),
                }}
              />
            </div>
            <div style={{ textAlign: 'center' }}>
              <Typography.Text type="secondary" style={{ fontSize: 15 }}>
                {t('selectChatMessage')}
              </Typography.Text>
              <br />
              <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                {t('selectChatDescription')}
              </Typography.Text>
            </div>
          </Flex>
        )}
      </Flex>

      <NewChatModal
        open={isNewChatModalOpen}
        onClose={() => setIsNewChatModalOpen(false)}
        onSuccess={handleNewChatSuccess}
      />
    </Card>
  );
};

export default ChatBoxWrapper;
