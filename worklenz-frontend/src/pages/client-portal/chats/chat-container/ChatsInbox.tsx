import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Flex, Spin, Typography } from '@/shared/antd-imports';
import { InboxOutlined, MessageOutlined, ReloadOutlined } from '@ant-design/icons';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useResponsive } from '@/hooks/useResponsive';
import { themeWiseColor } from '@utils/themeWiseColor';
import NewChatModal from '@components/client-portal/NewChatModal';
import { useGetChatConversationsQuery } from '@/api/client-portal/client-portal-api';
import ChatBox from './chat-box/chat-box';
import { ChatsConversationList } from './ChatsConversationList';
import { toOpenedChat } from '../chats-helpers';

// A new chat's id is "<clientId>-<YYYY-MM-DD>"; the conversation itself is one thread per client.
const CHAT_ID_DATE_SUFFIX = /-\d{4}-\d{2}-\d{2}$/;

/**
 * The global two-pane inbox: every client with a project on the left, the selected client's whole
 * conversation on the right. Laid out like Home > Inbox.
 */
export const ChatsInbox: React.FC = () => {
  const { t } = useTranslation('client-portal-chats');
  const [isNewChatModalOpen, setIsNewChatModalOpen] = useState(false);
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const { isDesktop } = useResponsive();
  const border = themeWiseColor('#e8e8e8', '#303030', themeMode);

  const { data, isLoading, isError, refetch } = useGetChatConversationsQuery(undefined, {
    refetchOnMountOrArgChange: true,
  });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Below desktop the list and the thread can't both fit, so only one shows at a time.
  const [mobileShowDetail, setMobileShowDetail] = useState(false);
  // Opening a thread marks the client's messages read on the server, but the list isn't refetched
  // until something changes; remember what was open (and how recent it was) so the unread dot
  // clears now and comes back if a newer message arrives.
  const [openedAt, setOpenedAt] = useState<Record<string, string | null>>({});

  const conversations = useMemo(
    () =>
      (data ?? []).map(conversation =>
        conversation.id in openedAt && openedAt[conversation.id] === conversation.lastMessageAt
          ? { ...conversation, unreadCount: 0 }
          : conversation
      ),
    [data, openedAt]
  );

  const selected =
    conversations.find(conversation => conversation.id === selectedId) ??
    (isDesktop ? conversations[0] : undefined) ??
    null;

  const openConversation = (id: string) => {
    const conversation = (data ?? []).find(item => item.id === id);
    setSelectedId(id);
    if (conversation) {
      setOpenedAt(prev => ({ ...prev, [id]: conversation.lastMessageAt }));
    }
    if (!isDesktop) setMobileShowDetail(true);
  };

  const handleNewChatSuccess = (chatId: string) => {
    setIsNewChatModalOpen(false);
    openConversation(chatId.replace(CHAT_ID_DATE_SUFFIX, ''));
  };

  const renderStatePanel = (content: React.ReactNode) => (
    <Flex
      align="center"
      justify="center"
      style={{ flex: 1, minHeight: 0, border: `1px solid ${border}`, borderRadius: 10 }}
    >
      {content}
    </Flex>
  );

  if (isLoading) {
    return renderStatePanel(
      <Flex vertical align="center" gap={12}>
        <Spin />
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          {t('loadingChats', { defaultValue: 'Loading conversations...' })}
        </Typography.Text>
      </Flex>
    );
  }

  if (isError) {
    return renderStatePanel(
      <Flex vertical align="center" gap={12} style={{ textAlign: 'center', padding: 24 }}>
        <InboxOutlined style={{ fontSize: 28, color: '#ff4d4f' }} />
        <Typography.Text strong>
          {t('errorLoadingChats', { defaultValue: 'Unable to Load Messages' })}
        </Typography.Text>
        <Typography.Text type="secondary" style={{ fontSize: 12, maxWidth: 300 }}>
          {t('errorLoadingChatsDescription', {
            defaultValue:
              "We couldn't load your messages. Please check your connection and try again.",
          })}
        </Typography.Text>
        <Button type="primary" size="small" icon={<ReloadOutlined />} onClick={() => refetch()}>
          {t('retryButton', { defaultValue: 'Try Again' })}
        </Button>
      </Flex>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: isDesktop ? 'row' : 'column',
        flex: 1,
        minHeight: 0,
        border: `1px solid ${border}`,
        borderRadius: 10,
        overflow: 'hidden',
      }}
    >
      {(isDesktop || !mobileShowDetail) && (
        <div
          style={{
            width: isDesktop ? 320 : '100%',
            flexShrink: 0,
            borderRight: isDesktop ? `1px solid ${border}` : 'none',
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
            overflow: 'hidden',
          }}
        >
          <ChatsConversationList
            conversations={conversations}
            selectedId={selected?.id ?? null}
            onSelect={conversation => openConversation(conversation.id)}
            onNewChat={() => setIsNewChatModalOpen(true)}
          />
        </div>
      )}

      {(isDesktop || mobileShowDetail) && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0 }}>
          {selected ? (
            <ChatBox
              key={selected.id}
              openedChat={toOpenedChat(selected)}
              onBack={!isDesktop ? () => setMobileShowDetail(false) : undefined}
              subtitle={t('activeProjects', {
                count: selected.projectsCount,
                defaultValue_one: '{{count}} active project',
                defaultValue_other: '{{count}} active projects',
                defaultValue: '{{count}} active projects',
              })}
            />
          ) : (
            <Flex vertical align="center" justify="center" gap={12} style={{ flex: 1 }}>
              <MessageOutlined
                style={{
                  fontSize: 28,
                  color: themeWiseColor('#bfbfbf', '#595959', themeMode),
                }}
              />
              <Typography.Text type="secondary">
                {t('selectChatMessage', { defaultValue: 'Select a conversation to view messages' })}
              </Typography.Text>
            </Flex>
          )}
        </div>
      )}

      <NewChatModal
        open={isNewChatModalOpen}
        onClose={() => setIsNewChatModalOpen(false)}
        onSuccess={handleNewChatSuccess}
      />
    </div>
  );
};
