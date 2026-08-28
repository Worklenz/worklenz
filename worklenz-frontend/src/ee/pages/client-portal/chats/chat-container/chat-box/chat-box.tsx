import {
  Button,
  Flex,
  Input,
  Typography,
  Spin,
  Tooltip,
  Popover,
  Select,
  theme,
  message as antMessage,
} from '@/shared/antd-imports';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import dayjs from 'dayjs';
import { ArrowLeftOutlined, CheckSquareOutlined, PaperClipOutlined, ReloadOutlined, RollbackOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { TempChatsType } from './chat-box-wrapper';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { sendMessage } from '@/ee/features/clients-portal/chats/chats-slice';
import { useAppSelector } from '@/hooks/useAppSelector';
import { themeWiseColor } from '@utils/themeWiseColor';
import CustomAvatar from '@components/CustomAvatar';
import { formatDateForSeparator, isDifferentDay } from '@/utils/chatDateFormat';
import { useSocket } from '@/socket/socketContext';
import { SocketEvents } from '@/shared/socket-events';
import { useAuthService } from '@/hooks/useAuth';
import {
  setSelectedTaskId,
  setShowTaskDrawer,
  fetchTask,
} from '@/features/task-drawer/task-drawer.slice';
import { setProjectId } from '@/features/project/project.slice';
import {
  useGetOrganizationMessagesQuery,
  useSendOrganizationMessageMutation,
  useUploadOrganizationChatFileMutation,
  useGetClientProjectsQuery,
} from '../../../../../api/client-portal/client-portal-api';
import '@/styles/chat-thread.css';

type ChatBoxProps = {
  openedChat: TempChatsType;
  /** Mobile only — when provided, a back button renders in the chat header. */
  onBack?: () => void;
};

const ChatBox = ({ openedChat, onBack }: ChatBoxProps) => {
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
  const { useToken } = theme;
  const { token } = useToken();
  const dispatch = useAppDispatch();
  const { socket } = useSocket();
  const authService = useAuthService();
  const currentSession = useMemo(() => authService.getCurrentSession(), [authService]);
  const currentUser = useAppSelector(state => (state as any).userReducer);

  const border = themeWiseColor('#f0f0f0', '#303030', themeMode);

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

  const [isRefreshing, setIsRefreshing] = useState(false);
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

  // Convert-to-task needs a project the CLIENT has access to, not one the
  // current staff member is necessarily a member of.
  const { data: clientProjectsData } = useGetClientProjectsQuery(
    { clientId: clientId || '' },
    { skip: !clientId }
  );
  const clientProjects = useMemo(() => {
    const raw = clientProjectsData as any;
    return raw?.body?.projects || raw?.projects || [];
  }, [clientProjectsData]);

  const [taskPickerOpenId, setTaskPickerOpenId] = useState<string | null>(null);
  const [pickerProjectId, setPickerProjectId] = useState<string | undefined>();

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

  const toPlainTaskName = (text: string) => {
    // tasks.name is capped at 500 chars in the DB
    const trimmed = (text || '').trim();
    return trimmed.length > 500 ? `${trimmed.slice(0, 499)}…` : trimmed;
  };

  const createTaskInProject = (projectId: string, name: string) => {
    if (!socket || !name) return;
    const newTask = {
      name,
      project_id: projectId,
      reporter_id: currentSession?.id,
      team_id: currentSession?.team_id,
    };
    socket.emit(SocketEvents.QUICK_TASK.toString(), JSON.stringify(newTask));
    socket.once(
      SocketEvents.QUICK_TASK.toString(),
      (task: { id?: string; project_id?: string; error?: boolean; message?: string }) => {
        if (task?.error || !task?.id) {
          antMessage.error(task?.message || t('convertToTaskError') || 'Failed to create task');
          return;
        }
        dispatch(setSelectedTaskId(task.id));
        dispatch(fetchTask({ taskId: task.id, projectId: task.project_id || projectId }));
        dispatch(setProjectId(task.project_id || projectId));
        dispatch(setShowTaskDrawer(true));
        antMessage.success(t('convertToTaskSuccess') || 'Task created from message');
      }
    );
  };

  const handleConvertToTask = (item: { id: string; content: React.ReactNode | string }) => {
    const name = toPlainTaskName(typeof item.content === 'string' ? item.content : '');
    if (!name) {
      antMessage.warning(
        t('convertToTaskEmpty') || 'Message has no text to use as a task name'
      );
      return;
    }
    if (clientProjects.length === 0) {
      antMessage.warning(t('noClientProject') || 'This client has no assigned project');
      return;
    }
    if (clientProjects.length === 1) {
      createTaskInProject(clientProjects[0].id, name);
      return;
    }
    setPickerProjectId(clientProjects[0].id);
    setTaskPickerOpenId(item.id);
  };

  return (
    <Flex vertical flex={1} style={{ height: '100%', overflow: 'hidden' }} className={`theme-${themeMode}`}>
      {/* Chat Header */}
      <Flex
        align="center"
        gap={12}
        style={{
          padding: '12px 20px',
          borderBottom: `1px solid ${themeWiseColor('#f0f0f0', '#303030', themeMode)}`,
          backgroundColor: token.colorBgContainer,
        }}
      >
        {onBack && (
          <Button
            type="text"
            shape="circle"
            icon={<ArrowLeftOutlined />}
            onClick={onBack}
            style={{ flexShrink: 0 }}
          />
        )}
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
            icon={<ReloadOutlined
              style={{
                animation: isRefreshing ? 'spin 1s linear infinite' : 'none',
              }}
            />
            }
            onClick={async () => {
              setIsRefreshing(true);
              await refetch();
              setTimeout(() => setIsRefreshing(false), 800);
            }}
          />
        </Tooltip>
      </Flex>

      {/* Messages Area - same bubble layout and background as the project Updates chat */}
      <div
        className="updates-list-container"
        style={{
          backgroundColor: token.colorBgContainer,
        }}
      >
        <div style={{ maxWidth: '900px', margin: '0 auto', width: '100%' }}>
          {isLoading ? (
            <Flex align="center" justify="center" style={{ padding: 40 }}>
              <Flex vertical align="center" gap={12}>
                <Spin />
                <Typography.Text type="secondary">{t('loadingMessages')}</Typography.Text>
              </Flex>
            </Flex>
          ) : error ? (
            <Flex align="center" justify="center" style={{ padding: 40 }}>
              <Flex vertical align="center" gap={12}>
                <Typography.Text type="danger">{t('errorLoadingMessages')}</Typography.Text>
                <Button type="link" onClick={() => refetch()}>
                  {t('retryButton')}
                </Button>
              </Flex>
            </Flex>
          ) : chatData.length === 0 ? (
            <Flex align="center" justify="center" style={{ padding: 40 }}>
              <Flex vertical align="center" gap={8}>
                <Typography.Text type="secondary">{t('noMessagesYet')}</Typography.Text>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  {t('startTyping')}
                </Typography.Text>
              </Flex>
            </Flex>
          ) : (
            chatData.map((chatMessage: any, index: number) => {
              const isMine = !!chatMessage.is_me;
              const timeIso = new Date(chatMessage.time).toISOString();
              const prevTimeIso =
                index > 0 ? new Date(chatData[index - 1].time).toISOString() : null;
              const showTimeSeparator = index === 0 || (prevTimeIso ? isDifferentDay(timeIso, prevTimeIso) : false);
              const taskName = toPlainTaskName(
                typeof chatMessage.content === 'string' ? chatMessage.content : ''
              );

              return (
                <div
                  key={chatMessage.id || index}
                  className={`chat-msg-row ${isMine ? 'mine' : 'theirs'}`}
                  ref={index === chatData.length - 1 ? chatEndRef : null}
                >
                  {showTimeSeparator && (
                    <div className="comment-time-separator">
                      <span
                        style={{
                          backgroundColor: token.colorBgContainer,
                          color: token.colorTextSecondary,
                        }}
                      >
                        {formatDateForSeparator(timeIso, t)}
                      </span>
                    </div>
                  )}

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'flex-end',
                      gap: 8,
                      justifyContent: isMine ? 'flex-end' : 'flex-start',
                    }}
                  >
                    {!isMine && (
                      <div style={{ width: 28, flexShrink: 0 }}>
                        <CustomAvatar avatarName={openedChat.name} size={28} />
                      </div>
                    )}

                    <div className="chat-msg-wrapper" style={{ maxWidth: '60%' }}>
                      <div
                        className="chat-msg-toolbar"
                        style={{
                          display: chatMessage.is_deleted ? 'none' : 'flex',
                        }}
                      >
                        <div className="chat-msg-actions">
                          <div className="quick-reactions">
                            {['👍', '❤️', '😂', '😮', '😢', '🙏', '🎉', '🔥'].map((emoji) => (
                              <Tooltip title={emoji} key={emoji}>
                                <button
                                  key={emoji}
                                  className="quick-emoji"
                                  onClick={() =>
                                    antMessage.info(
                                      t('comingSoon', { defaultValue: 'Reactions are available in project chat' }) || 'Reactions are available in project chat'
                                    )
                                  }
                                >
                                  {emoji}
                                </button>
                              </Tooltip>
                            ))}
                          </div>
                          <div className="hover-divider" />
                          <Tooltip title={t('actions.reply', { defaultValue: 'Reply' })}>
                            <button
                              className="hover-icon-btn"
                              onClick={() => {
                                setMessage(`> ${toPlainTaskName(chatMessage.content || '')}\n\n`);
                                inputRef.current?.focus();
                              }}
                            >
                              <RollbackOutlined style={{ fontSize: 14 }} />
                            </button>
                          </Tooltip>
                          <Tooltip
                            title={
                              clientProjects.length === 0
                                ? t('noClientProject') || 'This client has no assigned project'
                                : t('convertToTask') || 'Convert to task'
                            }
                          >
                            <Popover
                              trigger="click"
                              open={taskPickerOpenId === chatMessage.id}
                              onOpenChange={open => {
                                if (!open) setTaskPickerOpenId(null);
                              }}
                              content={
                                <Flex vertical gap={8} style={{ width: 220 }}>
                                  <Select
                                    size="small"
                                    value={pickerProjectId}
                                    onChange={setPickerProjectId}
                                    options={clientProjects.map((p: any) => ({
                                      value: p.id,
                                      label: p.name,
                                    }))}
                                    style={{ width: '100%' }}
                                  />
                                  <Button
                                    size="small"
                                    type="primary"
                                    onClick={() => {
                                      if (pickerProjectId)
                                        createTaskInProject(pickerProjectId, taskName);
                                      setTaskPickerOpenId(null);
                                    }}
                                  >
                                    {t('createTask') || 'Create task'}
                                  </Button>
                                </Flex>
                              }
                            >
                              <button
                                className="hover-icon-btn"
                                disabled={clientProjects.length === 0}
                                onClick={() => handleConvertToTask(chatMessage)}
                              >
                                <CheckSquareOutlined style={{ fontSize: 14 }} />
                              </button>
                            </Popover>
                          </Tooltip>
                        </div>
                      </div>

                      {!isMine && (
                        <div className="chat-msg-author">{openedChat.name}</div>
                      )}

                      {chatMessage.content && (
                        <div className={`chat-msg-bubble ${isMine ? 'mine' : 'theirs'}`}>
                          {chatMessage.content}
                        </div>
                      )}

                      {chatMessage.file_url && (
                        <a
                          href={chatMessage.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="chat-msg-attachment"
                        >
                          <PaperClipOutlined />
                          <span className="chat-msg-attachment-name">
                            {chatMessage.file_name || 'Attachment'}
                          </span>
                        </a>
                      )}

                      <div className="chat-msg-time">{dayjs(chatMessage.time).format('HH:mm')}</div>
                    </div>

                    {isMine && (
                      <div style={{ width: 28, flexShrink: 0 }}>
                        <CustomAvatar
                          avatarName={currentUser?.name || 'Me'}
                          avatarUrl={currentUser?.avatar_url}
                          size={28}
                        />
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Message Input Area */}
      <div
        className="updates-input-container"
        style={{
          borderTop: `1px solid ${border}`,
          backgroundColor: token.colorBgContainer,
        }}
      >
        {pendingFile && (
          <Flex
            align="center"
            gap={8}
            style={{
              maxWidth: '900px',
              margin: '0 auto 6px',
              width: '100%',
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
        <Flex
          align={message.trim() ? 'flex-end' : 'center'}
          gap={10}
          style={{ maxWidth: '900px', margin: '0 auto', width: '100%' }}
        >
          <input
            ref={fileInputRef}
            type="file"
            style={{ display: 'none' }}
            onChange={handleFileSelect}
            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
          />
          <Tooltip title={t('attachFile')}>
            <button
              className="chat-attach-btn"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              style={{ flexShrink: 0 }}
            >
              <PaperClipOutlined style={{ fontSize: 18 }} />
            </button>
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
              minWidth: 0,
              minHeight: 40,
              borderRadius: 20,
              padding: '8px 16px',
              resize: 'none',
              backgroundColor: themeWiseColor('#fff', '#1f1f1f', themeMode),
              border: `1px solid ${themeWiseColor('#d9d9d9', '#434343', themeMode)}`,
            }}
          />

          <Button
            type="primary"
            shape="round"
            onClick={handleSendMessage}
            loading={isSending || isUploading}
            disabled={!message.trim() && !pendingFile}
            className="send-button"
            style={{
              height: 40,
              paddingInline: 24,
              flexShrink: 0,
              fontWeight: 500,
              backgroundColor: !message.trim() && !pendingFile ? themeWiseColor('#d9d9d9', '#434343', themeMode) : '#1677ff',
              borderColor: !message.trim() && !pendingFile ? themeWiseColor('#d9d9d9', '#434343', themeMode) : '#1677ff',
              color: !message.trim() && !pendingFile ? themeWiseColor('rgba(0, 0, 0, 0.25)', '#ffffff', themeMode) : '#fff',
              opacity: 1,
            }}
          >
            {t('sendButton', { defaultValue: 'Send' })}
          </Button>
        </Flex>
      </div>
    </Flex>
  );
};

export default ChatBox;
