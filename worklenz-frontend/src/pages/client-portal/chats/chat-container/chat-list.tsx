import { Badge, Button, Flex, Table, Typography } from 'antd';
import React from 'react';
import { TempChatsType } from './chat-box/chat-box-wrapper';
import { PlusOutlined } from '@ant-design/icons';
import { colors } from '../../../../styles/colors';

type ChatListProps = {
  chatList: TempChatsType[];
  setOpenedChatId: (id: string) => void;
};

const ChatList = ({ chatList, setOpenedChatId }: ChatListProps) => {
  return (
    <Table
      dataSource={chatList}
      bordered
      pagination={false}
      scroll={{
        y: chatList.length >= 7 ? 'calc(100vh - 300px)' : undefined,
      }}
      style={{ minWidth: 300 }}
      onRow={(record) => ({
        style: { cursor: 'pointer' },
        onClick: () => setOpenedChatId(record.id),
      })}
      columns={[
        {
          key: 'chatItem',
          title: (
            <Flex justify="flex-end">
              <Button type="text" icon={<PlusOutlined />} />
            </Flex>
          ),
          render: (record: TempChatsType) => (
            <Flex
              vertical
              gap={8}
              style={{ maxWidth: 200, overflow: 'hidden' }}
            >
              <Flex align="center" justify="space-between">
                <Flex align="center" justify="space-between" gap={8}>
                  <Typography.Text
                    style={{
                      fontSize: 16,
                      fontWeight: 500,
                      textTransform: 'capitalize',
                    }}
                  >
                    {record.name}
                  </Typography.Text>

                  {record.status === 'unread' && (
                    <Badge color={colors.vibrantOrange} />
                  )}
                </Flex>
              </Flex>
              <Flex vertical gap={8}>
                <Typography.Text ellipsis={{ expanded: false }}>
                  {record.chats_data[record.chats_data.length - 1].is_me
                    ? `You: ${record.chats_data[record.chats_data.length - 1].content}`
                    : record.chats_data[record.chats_data.length - 1].content}
                </Typography.Text>
              </Flex>
            </Flex>
          ),
        },
      ]}
    />
  );
};

export default ChatList;
