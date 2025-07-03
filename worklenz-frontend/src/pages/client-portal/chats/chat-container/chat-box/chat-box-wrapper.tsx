import { Card, Divider, Flex, Typography } from 'antd';
import { ReactNode, useState } from 'react';
import ChatList from '../chat-list';
import ChatBox from './chat-box';
import { useAppSelector } from '../../../../../hooks/useAppSelector';

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
};

const ChatBoxWrapper = () => {
  const [openedChatId, setOpenedChatId] = useState<string | null>(null);

  // get chat list chats reducer
  const chatList = useAppSelector(
    (state) => state.clientsPortalReducer.chatsReducer.chatList
  );

  // get the opened chat
  const openedChat = chatList.find((chat) => chat.id === openedChatId);

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
              Select a chat to start messaging
            </Typography.Text>
          </Flex>
        )}
      </Flex>
    </Card>
  );
};

export default ChatBoxWrapper;
