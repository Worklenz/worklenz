import { Button, Flex, Input, Typography, Spin, Tooltip } from '@/shared/antd-imports';
import React, { useEffect, useRef, useState } from 'react';
import SendChatItem from './send-chat-item';
import RecivedChatItem from './recived-chat-item';
import { SendOutlined, PaperClipOutlined, SmileOutlined, ReloadOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { TempChatsType } from './chat-box-wrapper';
import { useAppDispatch } from '../../../../../hooks/useAppDispatch';
import { sendMessage } from '../../../../../features/clients-portal/chats/chats-slice';
import { useAppSelector } from '../../../../../hooks/useAppSelector';
import { themeWiseColor } from '../../../../../utils/themeWiseColor';
import CustomAvatar from '../../../../../components/CustomAvatar';
import {
  useGetMessagesQuery,
  useSendMessageMutation,
  ClientPortalMessage,
} from '../../../../../api/client-portal/client-portal-api';

type ChatBoxProps = {
  openedChat: TempChatsType;
};

const ChatBox = ({ openedChat }: ChatBoxProps) => {
  const [message, setMessage] = useState<string>('');
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<any>(null);

  const { t } = useTranslation('client-portal-chats');
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const dispatch = useAppDispatch();

  const { data: messages, isLoading, error, refetch } = useGetMessagesQuery(openedChat.id);
  const [sendMessageMutation, { isLoading: isSending }] = useSendMessageMutation();

  const chatData = React.useMemo(() => {
    try {
      if (messages && Array.isArray(messages)) {
        return messages.map((msg: ClientPortalMessage) => ({
          id: msg.id || '',
          content: msg.content || '',
          time: new Date(msg.created_at || Date.now()),
          is_me: msg.sender_id === 'current_user',
        }));
      }
      return Array.isArray(openedChat.chats_data) ? openedChat.chats_data : [];
    } catch (err) {
      console.error('Error processing chat messages:', err);
      return Array.isArray(openedChat.chats_data) ? openedChat.chats_data : [];
    }
  }, [messages, openedChat.chats_data]);

  const handleSendMessage = async () => {
    if (message.trim()) {
      try {
        await sendMessageMutation({
          chatId: openedChat.id,
          messageData: {
            content: message.trim(),
            attachments: [],
          },
        }).unwrap();

        setMessage('');
        refetch();
      } catch (err) {
        console.error('Error sending message:', err);
        dispatch(sendMessage({ chatId: openedChat.id, message }));
        setMessage('');
      }
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatData.length]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [openedChat.id]);

  return (
    <Flex vertical flex={1} style={{ height: '100%', overflow: 'hidden' }}>
      {/* Chat Header */}
      <Flex
        align="center"
        gap={12}
        style={{
          padding: '12px 20px',
          borderBottom: `1px solid ${themeWiseColor('#f0f0f0', '#303030', themeMode)}`,
          backgroundColor: themeWiseColor('#fff', '#141414', themeMode),
        }}
      >
        <CustomAvatar avatarName={openedChat.name} size={40} />
        <Flex vertical flex={1}>
          <Typography.Text
            strong
            style={{
              fontSize: 15,
              textTransform: 'capitalize',
            }}
          >
            {openedChat.name}
          </Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {openedChat.participants?.length
              ? `${openedChat.participants.length} participants`
              : t('online')}
          </Typography.Text>
        </Flex>
        <Tooltip title={t('refresh')}>
          <Button
            type="text"
            icon={<ReloadOutlined />}
            onClick={() => refetch()}
            loading={isLoading}
          />
        </Tooltip>
      </Flex>

      {/* Messages Area */}
      <Flex
        vertical
        flex={1}
        style={{
          overflowY: 'auto',
          overflowX: 'hidden',
          padding: '16px 20px',
          backgroundColor: themeWiseColor('#fafafa', '#0d0d0d', themeMode),
        }}
      >
        {isLoading ? (
          <Flex align="center" justify="center" style={{ height: '100%' }}>
            <Flex vertical align="center" gap={12}>
              <Spin />
              <Typography.Text type="secondary">{t('loadingMessages')}</Typography.Text>
            </Flex>
          </Flex>
        ) : error ? (
          <Flex align="center" justify="center" style={{ height: '100%' }}>
            <Flex vertical align="center" gap={12}>
              <Typography.Text type="danger">{t('errorLoadingMessages')}</Typography.Text>
              <Button type="link" onClick={() => refetch()}>
                {t('retryButton')}
              </Button>
            </Flex>
          </Flex>
        ) : chatData.length === 0 ? (
          <Flex align="center" justify="center" style={{ height: '100%' }}>
            <Flex vertical align="center" gap={8}>
              <Typography.Text type="secondary">{t('noMessagesYet')}</Typography.Text>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {t('startTyping')}
              </Typography.Text>
            </Flex>
          </Flex>
        ) : (
          <Flex vertical gap={16}>
            {chatData.map((chatMessage, index) => (
              <div
                key={chatMessage.id || index}
                ref={index === chatData.length - 1 ? chatEndRef : null}
              >
                {chatMessage.is_me ? (
                  <SendChatItem chatData={chatMessage} />
                ) : (
                  <RecivedChatItem sendersName={openedChat.name} chatData={chatMessage} />
                )}
              </div>
            ))}
          </Flex>
        )}
      </Flex>

      {/* Message Input Area */}
      <Flex
        align="center"
        gap={12}
        style={{
          padding: '12px 20px',
          borderTop: `1px solid ${themeWiseColor('#f0f0f0', '#303030', themeMode)}`,
          backgroundColor: themeWiseColor('#fff', '#141414', themeMode),
        }}
      >
        <Tooltip title={t('attachFile')}>
          <Button
            type="text"
            icon={<PaperClipOutlined style={{ fontSize: 18 }} />}
            style={{ color: themeWiseColor('#8c8c8c', '#8c8c8c', themeMode) }}
          />
        </Tooltip>

        <Input.TextArea
          ref={inputRef}
          placeholder={t('chatInputPlaceholder')}
          value={message}
          onChange={e => setMessage(e.target.value)}
          onKeyDown={handleKeyPress}
          disabled={isSending}
          autoSize={{ minRows: 1, maxRows: 4 }}
          style={{
            flex: 1,
            borderRadius: 20,
            padding: '8px 16px',
            resize: 'none',
            backgroundColor: themeWiseColor('#f5f5f5', '#262626', themeMode),
            border: 'none',
          }}
        />

        <Tooltip title={t('emojiPicker')}>
          <Button
            type="text"
            icon={<SmileOutlined style={{ fontSize: 18 }} />}
            style={{ color: themeWiseColor('#8c8c8c', '#8c8c8c', themeMode) }}
          />
        </Tooltip>

        <Button
          type="primary"
          shape="circle"
          icon={<SendOutlined />}
          onClick={handleSendMessage}
          loading={isSending}
          disabled={!message.trim()}
          style={{
            width: 40,
            height: 40,
          }}
        />
      </Flex>
    </Flex>
  );
};

export default ChatBox;
