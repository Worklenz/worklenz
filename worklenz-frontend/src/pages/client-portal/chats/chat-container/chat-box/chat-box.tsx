import { Button, Flex, Form, Input, Typography, Spin, Alert } from '@/shared/antd-imports';
import React, { useEffect, useRef, useState } from 'react';
import SendChatItem from './send-chat-item';
import RecivedChatItem from './recived-chat-item';
import { SendOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { TempChatsType } from './chat-box-wrapper';
import { useAppDispatch } from '../../../../../hooks/useAppDispatch';
import { sendMessage } from '../../../../../features/clients-portal/chats/chats-slice';
import { useAppSelector } from '../../../../../hooks/useAppSelector';
import { themeWiseColor } from '../../../../../utils/themeWiseColor';
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

  // localization
  const { t } = useTranslation('client-portal-chats');

  // get theme data from theme reducer
  const themeMode = useAppSelector(state => state.themeReducer.mode);

  const [form] = Form.useForm();
  const dispatch = useAppDispatch();

  // API hooks
  const { data: messages, isLoading, error, refetch } = useGetMessagesQuery(openedChat.id);
  const [sendMessageMutation, { isLoading: isSending }] = useSendMessageMutation();

  // Convert API messages to local format or use local data
  const chatData = React.useMemo(() => {
    try {
      if (messages && Array.isArray(messages)) {
        return messages.map((msg: ClientPortalMessage) => ({
          id: msg.id || '',
          content: msg.content || '',
          time: new Date(msg.created_at || Date.now()),
          is_me: msg.sender_id === 'current_user', // This should be replaced with actual user ID comparison
        }));
      }
      return Array.isArray(openedChat.chats_data) ? openedChat.chats_data : [];
    } catch (error) {
      console.error('Error processing chat messages:', error);
      return Array.isArray(openedChat.chats_data) ? openedChat.chats_data : [];
    }
  }, [messages, openedChat.chats_data]);

  // function to handle send message
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
        form.resetFields();
        refetch(); // Refresh messages after sending
      } catch (error) {
        console.error('Error sending message:', error);
        // Fallback to local state if API fails
        dispatch(sendMessage({ chatId: openedChat.id, message }));
        setMessage('');
      }
    }
  };

  // Scroll to bottom when messages change
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatData.length]);

  return (
    <Flex align="flex-start" vertical gap={12} flex={1}>
      <Flex
        align="center"
        style={{
          textTransform: 'capitalize',
          padding: 12,
          height: 66,
          width: '100%',
          borderBottom: `1px solid ${themeWiseColor('#f0f0f0', '#303030', themeMode)}`,
        }}
      >
        <Typography.Title level={5} style={{ marginBlock: 0 }}>
          {openedChat.name}
        </Typography.Title>
      </Flex>

      <Flex
        vertical
        gap={12}
        style={{
          width: '100%',
          height: 'calc(100vh - 448px)',
          overflowY: 'hidden',
        }}
      >
        {isLoading ? (
          <Flex align="center" justify="center" style={{ height: '100%' }}>
            <Spin />
          </Flex>
        ) : error ? (
          <Alert
            message="Error loading messages"
            description="Please try again later"
            type="error"
            showIcon
            style={{ margin: 16 }}
          />
        ) : (
          <Flex
            vertical
            gap={24}
            style={{
              width: '100%',
              height: 'calc(100vh - 372px)',
              overflowY: 'auto',
              padding: '0 16px',
            }}
          >
            {Array.isArray(chatData) &&
              chatData.map((chatMessage, index) => (
                <Flex
                  key={chatMessage.id || index}
                  justify={chatMessage.is_me ? 'flex-end' : 'flex-start'}
                  ref={index === chatData.length - 1 ? chatEndRef : null}
                  style={{ width: '100%' }}
                >
                  {chatMessage.is_me ? (
                    <SendChatItem chatData={chatMessage} />
                  ) : (
                    <RecivedChatItem sendersName={openedChat.name} chatData={chatMessage} />
                  )}
                </Flex>
              ))}
          </Flex>
        )}
      </Flex>

      <Flex
        style={{
          width: '100%',
          borderTop: `1px solid ${themeWiseColor('#f0f0f0', '#303030', themeMode)}`,
          padding: 12,
        }}
      >
        <Form
          form={form}
          layout="inline"
          style={{
            height: 36,
            width: '100%',
          }}
          onFinish={handleSendMessage}
        >
          <Form.Item style={{ flex: 1 }}>
            <Input
              placeholder={t('chatInputPlaceholder')}
              value={message}
              onChange={e => setMessage(e.currentTarget.value)}
              disabled={isSending}
            />
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              icon={<SendOutlined />}
              style={{ height: '100%' }}
              loading={isSending}
              disabled={!message.trim()}
            >
              {t('sendButton')}
            </Button>
          </Form.Item>
        </Form>
      </Flex>
    </Flex>
  );
};

export default ChatBox;
