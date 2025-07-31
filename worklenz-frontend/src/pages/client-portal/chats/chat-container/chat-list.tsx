import { Badge, Button, Flex, Table, Typography, Tooltip } from 'antd';
import React from 'react';
import { TempChatsType } from './chat-box/chat-box-wrapper';
import { PlusOutlined } from '@ant-design/icons';
import { colors } from '../../../../styles/colors';
import { useTranslation } from 'react-i18next';

type ChatListProps = {
  chatList: TempChatsType[];
  setOpenedChatId: (id: string) => void;
};

const ChatList = ({ chatList, setOpenedChatId }: ChatListProps) => {
  const { t } = useTranslation('client-portal-chats');

  const handleNewChat = () => {
    // TODO: Implement new chat functionality
    console.log('New chat clicked');
  };

  // Ensure chatList is always an array
  const safeChatList = Array.isArray(chatList) ? chatList : [];

  return (
    <Table
      dataSource={safeChatList}
      bordered
      pagination={false}
      rowKey="id"
      scroll={{
        y: safeChatList.length >= 7 ? 'calc(100vh - 300px)' : undefined,
      }}
      style={{ minWidth: 320 }}
      onRow={(record) => ({
        style: { cursor: 'pointer' },
        onClick: () => setOpenedChatId(record.id),
      })}
      columns={[
        {
          key: 'chatItem',
          title: (
            <Flex justify="space-between" align="center">
              <Typography.Text strong>
                {t('chatsTitle') || 'Chats'}
              </Typography.Text>
              <Tooltip title={t('newChat') || 'New Chat'}>
                <Button 
                  type="text" 
                  icon={<PlusOutlined />} 
                  onClick={handleNewChat}
                  size="small"
                />
              </Tooltip>
            </Flex>
          ),
          render: (record: TempChatsType) => (
            <Flex
              vertical
              gap={8}
              style={{ maxWidth: 280, overflow: 'hidden' }}
            >
              <Flex align="center" justify="space-between">
                <Flex align="center" gap={8}>
                  <Typography.Text
                    style={{
                      fontSize: 14,
                      fontWeight: 500,
                      textTransform: 'capitalize',
                    }}
                    ellipsis={{ tooltip: record.name }}
                  >
                    {record.name}
                  </Typography.Text>

                  {record.status === 'unread' && (
                    <Badge 
                      color={colors.vibrantOrange} 
                      count={record.unreadCount || 1}
                      size="small"
                    />
                  )}
                </Flex>
              </Flex>
              
              <Flex vertical gap={4}>
                <Typography.Text 
                  type="secondary" 
                  style={{ fontSize: 12 }}
                  ellipsis={{ tooltip: true }}
                >
                  {record.lastMessage || 
                    (record.chats_data && Array.isArray(record.chats_data) && record.chats_data.length > 0 
                      ? (record.chats_data[record.chats_data.length - 1].is_me
                          ? `You: ${record.chats_data[record.chats_data.length - 1].content}`
                          : record.chats_data[record.chats_data.length - 1].content)
                      : 'No messages yet'
                    )
                  }
                </Typography.Text>
                
                {record.lastMessageTime && (
                  <Typography.Text 
                    type="secondary" 
                    style={{ fontSize: 11 }}
                  >
                    {new Date(record.lastMessageTime).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </Typography.Text>
                )}
              </Flex>
            </Flex>
          ),
        },
      ]}
    />
  );
};

export default ChatList;
