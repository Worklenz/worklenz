import React, { useState, useEffect, useRef } from 'react';
import { 
  Card, 
  Typography, 
  Flex, 
  Input, 
  Button, 
  List, 
  Avatar, 
  Space,
  Badge,
  Spin,
  Alert,
  Upload,
  message,
  Divider,
  SendOutlined, 
  PaperClipOutlined, 
  ReloadOutlined,
  MessageOutlined 
} from '@/shared/antd-imports';
import clientPortalAPI from '@/services/api';
import { ClientMessage, ClientChat, ApiResponse } from '@/types';
import { useAppSelector } from '@/hooks/useAppSelector';

const { Title, Paragraph, Text } = Typography;
const { TextArea } = Input;

interface ChatListItem extends ClientChat {
  id: string;
  title: string;
}

const ChatsPage: React.FC = () => {
  const [chats, setChats] = useState<ChatListItem[]>([]);
  const [selectedChat, setSelectedChat] = useState<string | null>(null);
  const [messages, setMessages] = useState<ClientMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isMessagesLoading, setIsMessagesLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { theme } = useAppSelector((state) => state.ui);

  // Load chats on component mount
  useEffect(() => {
    loadChats();
  }, []);

  // Load messages when a chat is selected
  useEffect(() => {
    if (selectedChat) {
      loadMessages(selectedChat);
    }
  }, [selectedChat]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadChats = async () => {
    try {
      setIsLoading(true);
      const response: ApiResponse<any> = await clientPortalAPI.getChats();
      if (response.done && response.body) {
        // Transform the chat data to include IDs and titles
        const chatList: ChatListItem[] = (response.body as ClientChat[]).map((chat, index) => ({
          ...chat,
          id: `chat-${index}`,
          title: `Chat - ${new Date(chat.date).toLocaleDateString()}`
        }));
        setChats(chatList);
        
        // Auto-select the first chat if available
        if (chatList.length > 0 && !selectedChat) {
          setSelectedChat(chatList[0].id);
        }
      } else {
        setError('Failed to load chats');
      }
    } catch (err) {
      console.error('Error loading chats:', err);
      setError('Failed to load chats. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  };

  const loadMessages = async (_chatId: string) => {
    try {
      setIsMessagesLoading(true);
      const response: ApiResponse<any> = await clientPortalAPI.getMessages({
        page: 1,
        limit: 50
      });
      if (response.done && response.body) {
        setMessages(response.body as ClientMessage[]);
      } else {
        setError('Failed to load messages');
      }
    } catch (err) {
      console.error('Error loading messages:', err);
      setError('Failed to load messages. Please try again later.');
    } finally {
      setIsMessagesLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim()) return;

    try {
      setIsSending(true);
      const response: ApiResponse<any> = await clientPortalAPI.sendMessage({
        message: newMessage.trim(),
        messageType: 'text'
      });
      
      if (response.done && response.body) {
        setMessages(prev => [...prev, response.body as ClientMessage]);
        setNewMessage('');
        message.success('Message sent successfully');
      } else {
        message.error('Failed to send message');
      }
    } catch (err) {
      console.error('Error sending message:', err);
      message.error('Failed to send message. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleFileUpload = async (file: File) => {
    try {
      const uploadResponse = await clientPortalAPI.uploadFile(file, 'chat');
      if (uploadResponse.done && uploadResponse.body) {
        const messageResponse = await clientPortalAPI.sendMessage({
          message: `Shared a file: ${file.name}`,
          messageType: 'file',
          fileUrl: uploadResponse.body.url
        });
        
        if (messageResponse.done && messageResponse.body) {
          setMessages(prev => [...prev, messageResponse.body as ClientMessage]);
          message.success('File uploaded and sent successfully');
        }
      }
    } catch (err) {
      console.error('Error uploading file:', err);
      message.error('Failed to upload file');
    }
    return false; // Prevent default upload behavior
  };

  const getTotalUnreadCount = () => {
    return chats.reduce((total, chat) => total + chat.unreadCount, 0);
  };

  const formatMessageTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const renderMessage = (msg: ClientMessage) => {
    const isFromClient = msg.senderType === 'client';
    
    return (
      <div
        key={msg.id}
        style={{
          display: 'flex',
          justifyContent: isFromClient ? 'flex-end' : 'flex-start',
          marginBottom: 16
        }}
      >
        <div style={{ maxWidth: '70%' }}>
          {!isFromClient && (
            <div style={{ marginBottom: 4 }}>
              <Space>
                <Avatar size="small" src={msg.senderAvatar}>
                  {msg.senderName?.charAt(0)?.toUpperCase()}
                </Avatar>
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  {msg.senderName}
                </Text>
              </Space>
            </div>
          )}
          <Card
            size="small"
            style={{
              backgroundColor: isFromClient 
                ? (theme === 'dark' ? '#1890ff' : '#1890ff')
                : (theme === 'dark' ? '#262626' : '#f5f5f5'),
              color: isFromClient ? 'white' : 'inherit',
              borderRadius: 12,
              border: 'none'
            }}
          >
            <div>{msg.message}</div>
            {msg.messageType === 'file' && msg.fileUrl && (
              <div style={{ marginTop: 8 }}>
                <a href={msg.fileUrl} target="_blank" rel="noopener noreferrer">
                  <PaperClipOutlined /> Download File
                </a>
              </div>
            )}
            <div style={{ 
              fontSize: '11px', 
              opacity: 0.7, 
              marginTop: 4,
              textAlign: 'right'
            }}>
              {formatMessageTime(msg.createdAt)}
            </div>
          </Card>
        </div>
      </div>
    );
  };

  if (error) {
    return (
      <Flex vertical gap={24} style={{ width: '100%' }}>
        <Alert
          message="Error"
          description={error}
          type="error"
          showIcon
          action={
            <Button size="small" onClick={loadChats}>
              <ReloadOutlined /> Retry
            </Button>
          }
        />
      </Flex>
    );
  }

  return (
    <Flex vertical gap={24} style={{ width: '100%' }}>
      <Flex vertical gap={8}>
        <Flex align="center" gap={12}>
          <MessageOutlined style={{ fontSize: 20 }} />
          <Title level={1} style={{ margin: 0 }}>Chats</Title>
          {getTotalUnreadCount() > 0 && (
            <Badge count={getTotalUnreadCount()} style={{ backgroundColor: '#ff4d4f' }} />
          )}
        </Flex>
        <Paragraph type="secondary" style={{ margin: 0 }}>
          Communicate with your service providers
        </Paragraph>
      </Flex>
      
      <div style={{ display: 'flex', gap: 16, height: 'calc(100vh - 248px)' }}>
        {/* Chat List */}
        <Card 
          title="Conversations" 
          style={{ width: 320, height: '100%' }}
          bodyStyle={{ padding: 0, height: 'calc(100% - 57px)', overflow: 'auto' }}
          extra={
            <Button 
              type="text" 
              icon={<ReloadOutlined />} 
              onClick={loadChats}
              loading={isLoading}
            />
          }
        >
          <Spin spinning={isLoading}>
            <List
              itemLayout="horizontal"
              dataSource={chats}
              renderItem={(chat) => (
                <List.Item
                  onClick={() => setSelectedChat(chat.id)}
                  style={{
                    cursor: 'pointer',
                    backgroundColor: selectedChat === chat.id 
                      ? (theme === 'dark' ? '#1890ff20' : '#e6f7ff')
                      : 'transparent',
                    padding: '12px 16px',
                    borderLeft: selectedChat === chat.id ? '3px solid #1890ff' : 'none'
                  }}
                >
                  <List.Item.Meta
                    avatar={<MessageOutlined />}
                    title={
                      <Flex justify="space-between" align="center">
                        <span>{chat.title}</span>
                        {chat.unreadCount > 0 && (
                          <Badge count={chat.unreadCount} size="small" />
                        )}
                      </Flex>
                    }
                    description={
                      <Text type="secondary" style={{ fontSize: '12px' }}>
                        {chat.lastMessageAt ? 
                          new Date(chat.lastMessageAt).toLocaleDateString() : 
                          'No messages yet'
                        }
                      </Text>
                    }
                  />
                </List.Item>
              )}
            />
          </Spin>
        </Card>

        {/* Chat Messages */}
        <Card 
          title={selectedChat ? `Chat Messages` : 'Select a conversation'}
          style={{ flex: 1, height: '100%' }}
          bodyStyle={{ 
            padding: 0, 
            height: 'calc(100% - 57px)',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          {selectedChat ? (
            <>
              {/* Messages Area */}
              <div 
                style={{ 
                  flex: 1, 
                  padding: 16, 
                  overflowY: 'auto',
                  backgroundColor: theme === 'dark' ? '#141414' : '#fafafa'
                }}
              >
                <Spin spinning={isMessagesLoading}>
                  {messages.length > 0 ? (
                    <>
                      {messages.map(renderMessage)}
                      <div ref={messagesEndRef} />
                    </>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '50px' }}>
                      <Text type="secondary">No messages yet. Start the conversation!</Text>
                    </div>
                  )}
                </Spin>
              </div>

              <Divider style={{ margin: 0 }} />

              {/* Message Input */}
              <div style={{ padding: 16 }}>
                <Space.Compact style={{ width: '100%' }}>
                  <TextArea
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Type your message..."
                    autoSize={{ minRows: 1, maxRows: 4 }}
                    style={{ flex: 1 }}
                  />
                  <Upload
                    beforeUpload={handleFileUpload}
                    showUploadList={false}
                    accept="*"
                  >
                    <Button icon={<PaperClipOutlined />} />
                  </Upload>
                  <Button 
                    type="primary" 
                    icon={<SendOutlined />}
                    onClick={sendMessage}
                    loading={isSending}
                    disabled={!newMessage.trim()}
                  >
                    Send
                  </Button>
                </Space.Compact>
              </div>
            </>
          ) : (
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              height: '100%'
            }}>
              <Text type="secondary">Select a conversation to start chatting</Text>
            </div>
          )}
        </Card>
      </div>
    </Flex>
  );
};

export default ChatsPage;