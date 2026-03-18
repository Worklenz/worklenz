import {
  Button,
  Flex,
  Input,
  Typography,
  Spin,
  Tooltip,
  message as antMessage,
} from '@/shared/antd-imports';
import React, { useEffect, useRef, useState } from 'react';
import SendChatItem from './send-chat-item';
import RecivedChatItem from './recived-chat-item';
import { SendOutlined, PaperClipOutlined, ReloadOutlined } from '@ant-design/icons';
import EmojiPicker from '@components/project-updates/EmojiPicker';
import { useTranslation } from 'react-i18next';
import { TempChatsType } from './chat-box-wrapper';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { sendMessage } from '@features/clients-portal/chats/chats-slice';
import { useAppSelector } from '@/hooks/useAppSelector';
import { themeWiseColor } from '@utils/themeWiseColor';
import CustomAvatar from '@components/CustomAvatar';
import {
  useGetOrganizationMessagesQuery,
  useSendOrganizationMessageMutation,
  useUploadOrganizationChatFileMutation,
} from '../../../../../api/client-portal/client-portal-api';

type ChatBoxProps = {
  openedChat: TempChatsType;
};

const ChatBox = ({ openedChat }: ChatBoxProps) => {
  const [message, setMessage] = useState<string>('');
  const [pendingFile, setPendingFile] = useState<{
    name: string;
    data: string;
    type: string;
  } | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const { t } = useTranslation('client-portal-chats');
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const dispatch = useAppDispatch();

  // Get clientId from chat object or extract from chatId
  const clientId = React.useMemo(() => {
    if (openedChat.clientId) {
      return openedChat.clientId;
    }
    // Fallback: Extract clientId from chatId (format: clientId-date)
    if (!openedChat.id || !openedChat.id.includes('-')) return null;
    const parts = openedChat.id.split('-');
    if (parts.length >= 4) {
      const dateParts = parts.slice(-3);
      const dateStrTest = dateParts.join('-');
      // Validate date format (YYYY-MM-DD)
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateStrTest)) {
        return parts.slice(0, -3).join('-');
      }
    }
    return null;
  }, [openedChat.id, openedChat.clientId]);

  const {
    data: messagesData,
    isLoading,
    error,
    refetch,
  } = useGetOrganizationMessagesQuery(
    { chatId: openedChat.id, clientId: clientId || '' },
    {
      skip: !clientId,
      refetchOnMountOrArgChange: true, // Always refetch when chat is opened
      refetchOnFocus: true, // Refetch when window regains focus
    }
  );
  const [sendMessageMutation, { isLoading: isSending }] = useSendOrganizationMessageMutation();
  const [uploadFile, { isLoading: isUploading }] = useUploadOrganizationChatFileMutation();

  // Extract messages from response
  const messages = React.useMemo(() => {
    if (messagesData) {
      // Handle different response formats
      if (Array.isArray(messagesData)) {
        return messagesData;
      }
      // getChatDetails returns { date, messages, total, page, limit }
      if ('messages' in messagesData && Array.isArray(messagesData.messages)) {
        return messagesData.messages;
      }
      // Some APIs wrap in body - check with type guard
      const dataWithBody = messagesData as any;
      if (dataWithBody.body) {
        if (Array.isArray(dataWithBody.body)) {
          return dataWithBody.body;
        }
        if (dataWithBody.body.messages && Array.isArray(dataWithBody.body.messages)) {
          return dataWithBody.body.messages;
        }
      }
    }
    return [];
  }, [messagesData]);

  const chatData = React.useMemo(() => {
    try {
      if (messages && Array.isArray(messages) && messages.length > 0) {
        // Get current user ID from store or context
        const currentUserId = (window as any).__WORKLENZ_USER__?.id;
        return messages.map((msg: any) => ({
          id: msg.id || '',
          content: msg.message || msg.content || '',
          time: new Date(msg.created_at || msg.createdAt || Date.now()),
          is_me:
            msg.senderType === 'team_member' || (currentUserId && msg.senderId === currentUserId),
          file_url: msg.file_url || msg.fileUrl || null,
          file_name:
            msg.file_name ||
            msg.fileName ||
            (msg.file_url || msg.fileUrl
              ? decodeURIComponent(String(msg.file_url || msg.fileUrl).split('/').pop() || '')
              : null),
        }));
      }
      return Array.isArray(openedChat.chats_data) ? openedChat.chats_data : [];
    } catch (err) {
      console.error('Error processing chat messages:', err);
      return Array.isArray(openedChat.chats_data) ? openedChat.chats_data : [];
    }
  }, [messages, openedChat.chats_data]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = ev => {
      const dataUrl = ev.target?.result as string;
      // Strip base64 header (e.g. "data:image/png;base64,")
      const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
      setPendingFile({ name: file.name, data: base64, type: file.type });
    };
    reader.readAsDataURL(file);
    // Reset so the same file can be selected again
    e.target.value = '';
  };

  const handleSendMessage = async () => {
    if ((!message.trim() && !pendingFile) || !clientId) return;
    try {
      let fileUrl: string | undefined;
      let fileName: string | undefined;

      if (pendingFile) {
        const uploadResult = await uploadFile({
          fileData: pendingFile.data,
          fileName: pendingFile.name,
          fileType: pendingFile.type,
          clientId: clientId || undefined,
        }).unwrap();
        fileUrl = uploadResult.url;
        fileName = uploadResult.fileName;
        setPendingFile(null);
      }

      await sendMessageMutation({
        chatId: openedChat.id,
        clientId: clientId,
        messageData: {
          content: message.trim() || (fileName ? `Shared file: ${fileName}` : ''),
          attachments: fileUrl ? [{ url: fileUrl, name: fileName }] : [],
        },
      }).unwrap();

      setMessage('');
    } catch (err) {
      console.error('Error sending message:', err);
      antMessage.error(t('errorSendingMessage') || 'Failed to send message');
      dispatch(sendMessage({ chatId: openedChat.id, message }));
      setMessage('');
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
        vertical
        style={{
          borderTop: `1px solid ${themeWiseColor('#f0f0f0', '#303030', themeMode)}`,
          backgroundColor: themeWiseColor('#fff', '#141414', themeMode),
        }}
      >
        {pendingFile && (
          <Flex
            align="center"
            gap={8}
            style={{
              padding: '6px 20px',
              backgroundColor: themeWiseColor('#f5f5f5', '#1f1f1f', themeMode),
              fontSize: 12,
            }}
          >
            <PaperClipOutlined />
            <Typography.Text style={{ fontSize: 12, flex: 1 }} ellipsis>
              {pendingFile.name}
            </Typography.Text>
            <Button
              type="text"
              size="small"
              onClick={() => setPendingFile(null)}
              style={{ fontSize: 11, height: 20, padding: '0 4px' }}
            >
              ✕
            </Button>
          </Flex>
        )}
        <Flex align="center" gap={12} style={{ padding: '12px 20px' }}>
          <input
            ref={fileInputRef}
            type="file"
            style={{ display: 'none' }}
            onChange={handleFileSelect}
            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
          />
          <Tooltip title={t('attachFile')}>
            <Button
              type="text"
              icon={<PaperClipOutlined style={{ fontSize: 18 }} />}
              style={{ color: themeWiseColor('#8c8c8c', '#8c8c8c', themeMode) }}
              onClick={() => fileInputRef.current?.click()}
              loading={isUploading}
            />
          </Tooltip>

          <Input.TextArea
            ref={inputRef}
            placeholder={t('chatInputPlaceholder')}
            value={message}
            onChange={e => setMessage(e.target.value)}
            onKeyDown={handleKeyPress}
            disabled={isSending || isUploading}
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

          <EmojiPicker onSelect={emoji => setMessage(prev => prev + emoji)} />

          <Button
            type="primary"
            shape="circle"
            icon={<SendOutlined />}
            onClick={handleSendMessage}
            loading={isSending || isUploading}
            disabled={!message.trim() && !pendingFile}
            style={{
              width: 40,
              height: 40,
            }}
          />
        </Flex>
      </Flex>
    </Flex>
  );
};

export default ChatBox;
