import { Button, Flex, Form, Input, Typography } from 'antd';
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

type ChatBoxProps = {
  openedChat: TempChatsType;
};

const ChatBox = ({ openedChat }: ChatBoxProps) => {
  const [message, setMessage] = useState<string>('');
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  // localization
  const { t } = useTranslation('client-portal-chats');

  // get theme data from theme reducer
  const themeMode = useAppSelector((state) => state.themeReducer.mode);

  const [form] = Form.useForm();

  const dispatch = useAppDispatch();

  // function to handle send message
  const handleSendMessage = () => {
    if (message.trim()) {
      dispatch(sendMessage({ chatId: openedChat.id, message }));
      setMessage('');
    }
  };

  // Scroll to bottom when messages change
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [openedChat.chats_data.length]);

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
        <Flex
          vertical
          gap={24}
          style={{
            width: '100%',
            height: 'calc(100vh - 372px)',
            overflowY: 'auto',
          }}
        >
          {openedChat.chats_data.map((chatData) => (
            <Flex
              justify={chatData.is_me ? 'flex-end' : 'flex-start'}
              ref={chatEndRef}
              style={{ width: '100%' }}
            >
              {chatData.is_me ? (
                <SendChatItem key={chatData.id} chatData={chatData} />
              ) : (
                <RecivedChatItem
                  key={chatData.id}
                  sendersName={openedChat.name}
                  chatData={chatData}
                />
              )}
            </Flex>
          ))}
        </Flex>
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
              onChange={(e) => setMessage(e.currentTarget.value)}
            />
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              icon={<SendOutlined />}
              style={{ height: '100%' }}
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
