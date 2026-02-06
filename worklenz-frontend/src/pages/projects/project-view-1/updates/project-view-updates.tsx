import {
  Button,
  Card,
  Empty,
  Flex,
  Form,
  Mentions,
  Popconfirm,
  Space,
  Spin,
  theme,
  Tooltip,
  Input,
  Dropdown
} from '@/shared/antd-imports';
import {
  SendOutlined,
  UserOutlined,
  MessageOutlined,
  EditOutlined,
  MoreOutlined,
  DeleteOutlined,
  SmileOutlined
} from '@ant-design/icons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { useTranslation } from 'react-i18next';
import { Comment } from '@ant-design/compatible';

import { useAppDispatch, useAppSelector } from '@/app/store';
import { useSocket } from '@/socket/socketContext';
import { SocketEvents } from '@/shared/socket-events';
import {
  getProjectComments,
  createProjectComment,
  deleteProjectComment,
  addReactionToComment,
  updateCommentAfterEdit
} from '@/features/projects/singleProject/updates/updatesSlice';
import { getAllProjectMembers } from '@/features/projects/singleProject/members/projectMembersSlice';
import { projectCommentsApiService } from '@/api/projects/comments/project-comments.api.service';
import EmojiPicker from '@/components/project-updates/EmojiPicker';
import { getUserSession } from '@/utils/session-helper';
import SingleAvatar from '@/components/common/single-avatar/single-avatar';
import { themeWiseColor } from '@/utils/themeWiseColor';
import { colors } from '@/styles/colors';
import './project-view-updates.css';

dayjs.extend(relativeTime);

const { useToken } = theme;

// Helper function from task-comments.tsx
const formatDateForSeparator = (date: string) => {
  const today = dayjs();
  const commentDate = dayjs(date);

  if (commentDate.isSame(today, 'day')) {
    return 'Today';
  } else if (commentDate.isSame(today.subtract(1, 'day'), 'day')) {
    return 'Yesterday';
  } else {
    return commentDate.format('MMMM D, YYYY');
  }
};

const isDifferentDay = (date1: string, date2: string) => {
  return !dayjs(date1).isSame(dayjs(date2), 'day');
};

const ProjectViewUpdates = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const dispatch = useAppDispatch();
  const { socket } = useSocket();
  const [form] = Form.useForm();
  const { t } = useTranslation('project-view-updates');
  const { token } = useToken();
  const themeMode = useAppSelector(state => state.themeReducer.mode);

  // Ref for auto-scrolling
  const listRef = useRef<HTMLDivElement>(null);

  const { updatesList, loading } = useAppSelector(state => state.updatesReducer);
  const user = useAppSelector(state => state.userReducer);
  const projectMembers = useAppSelector(state => state.projectMemberReducer.currentMembersList);

  const [submitting, setSubmitting] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');

  // Initial fetch
  useEffect(() => {
    if (projectId) {
      dispatch(getProjectComments(projectId));
      dispatch(getAllProjectMembers(projectId));
    }
  }, [projectId, dispatch]);

  // Socket listener for real-time updates
  useEffect(() => {
    if (!socket || !projectId) return;

    const handleNewComment = (isNew: boolean) => {
      if (isNew) {
        dispatch(getProjectComments(projectId));
      }
    };

    const handleReactionAdded = (data: any) => {
      dispatch(addReactionToComment({
        comment_id: data.comment_id,
        reactions: data.reactions
      }));
    };

    const handleReactionRemoved = (data: any) => {
      dispatch(addReactionToComment({
        comment_id: data.comment_id,
        reactions: data.reactions
      }));
    };

    const handleCommentEdited = (data: any) => {
      dispatch(updateCommentAfterEdit(data));
    };

    const eventName = SocketEvents.NEW_PROJECT_COMMENT_RECEIVED.toString();
    socket.on(eventName, handleNewComment);
    socket.on(SocketEvents.PROJECT_COMMENT_REACTION_ADDED.toString(), handleReactionAdded);
    socket.on(SocketEvents.PROJECT_COMMENT_REACTION_REMOVED.toString(), handleReactionRemoved);
    socket.on(SocketEvents.PROJECT_COMMENT_EDITED.toString(), handleCommentEdited);

    return () => {
      socket.off(eventName, handleNewComment);
      socket.off(SocketEvents.PROJECT_COMMENT_REACTION_ADDED.toString(), handleReactionAdded);
      socket.off(SocketEvents.PROJECT_COMMENT_REACTION_REMOVED.toString(), handleReactionRemoved);
      socket.off(SocketEvents.PROJECT_COMMENT_EDITED.toString(), handleCommentEdited);
    };
  }, [socket, projectId, dispatch]);

  // Scroll to bottom on new updates
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [updatesList]);

  const onFinish = async (values: any) => {
    if (!projectId || !values.comment?.trim()) return;

    setSubmitting(true);

    const content = values.comment;

    // Detect mentions from text
    const mentionedMembers = projectMembers
      .filter(member => member.name && content.includes(`@${member.name}`) && (member.user_id || member.id))
      .map(m => ({
        id: m.user_id || m.id,
        name: m.name,
        team_member_id: m.team_member_id
      }));

    try {
      const result = await dispatch(createProjectComment({
        project_id: projectId,
        content: content,
        mentions: mentionedMembers
      })).unwrap();
      form.resetFields();
      
      // Scroll to bottom after posting
      setTimeout(() => {
        if (listRef.current) {
          listRef.current.scrollTop = listRef.current.scrollHeight;
        }
      }, 100);
    } catch (error) {
      console.error('Failed to send comment', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && e.shiftKey) {
      e.preventDefault();
      form.submit();
    }
  };

  const handleDelete = async (commentId: string) => {
    if (!commentId) return;
    try {
      await dispatch(deleteProjectComment(commentId)).unwrap();
    } catch (error) {
      console.error('Failed to delete comment', error);
    }
  };

  const handleReaction = async (commentId: string, emoji: string) => {
    try {
      await projectCommentsApiService.addReaction(commentId, emoji);
    } catch (error) {
      console.error('Failed to add reaction', error);
    }
  };

  const handleRemoveReaction = async (commentId: string, emoji: string) => {
    try {
      await projectCommentsApiService.removeReaction(commentId, emoji);
    } catch (error) {
      console.error('Failed to remove reaction', error);
    }
  };

  const handleEdit = async (commentId: string) => {
    if (!editContent.trim()) return;
    
    try {
      await projectCommentsApiService.editComment(commentId, editContent);
      setEditingCommentId(null);
      setEditContent('');
    } catch (error) {
      console.error('Failed to edit comment', error);
    }
  };

  const startEdit = (commentId: string, content: string) => {
    setEditingCommentId(commentId);
    // Strip HTML tags for editing
    const textContent = content.replace(/<[^>]*>/g, '');
    setEditContent(textContent);
  };

  const processMentions = (content: string, mentions: any[]) => {
    if (!mentions || mentions.length === 0) {
      return content.replace(/\n/g, '<br/>');
    }

    let processedContent = content;
    const placeholders = content.match(/{\d+}/g);
    
    if (placeholders) {
      processedContent = processedContent.replace(/\n/g, '<br/>');
      
      placeholders.forEach((placeholder) => {
        const match = placeholder.match(/\d+/);
        if (match) {
          const index = parseInt(match[0]);
          if (index >= 0 && index < mentions.length && mentions[index]) {
            const userName = mentions[index].user_name || mentions[index].name;
            processedContent = processedContent.replace(
              placeholder,
              `<span class='mentions'>@${userName}</span>`
            );
          }
        }
      });
    } else {
      processedContent = processedContent.replace(/\n/g, '<br/>');
    }
    
    return processedContent;
  };

  const renderCommentContent = (htmlContent: string, mentions?: any[]) => {
    const processedContent = mentions ? processMentions(htmlContent, mentions) : htmlContent;
    return (
      <div
        dangerouslySetInnerHTML={{ __html: processedContent }}
      />
    );
  };

  const renderTimeSeparator = (date: string) => (
    <div className="comment-time-separator">
      <span
        style={{
          backgroundColor: token.colorBgContainer, // Match container background
          color: token.colorTextSecondary
        }}
      >
        {formatDateForSeparator(date)}
      </span>
    </div>
  );

  const mentionsOptions = useMemo(() => projectMembers
    .filter(member => member.user_id || member.id)
    .map(member => ({
      value: member.name || '',
      label: (
        <Space>
          <SingleAvatar avatarUrl={member.avatar_url} name={member.name} />
          <span>{member.name}</span>
        </Space>
      ),
    })), [projectMembers]);

  // Styles from task-comments.tsx logic
  const authorStyle = {
    color: themeWiseColor(colors.lightGray, colors.deepLightGray, themeMode),
    fontSize: '12px',
  };

  const dateStyle = {
    color: themeWiseColor(colors.deepLightGray, colors.lightGray, themeMode),
    fontSize: '11px',
    marginLeft: '8px'
  };

  const actionStyle = {
    color: themeWiseColor(colors.lightGray, colors.deepLightGray, themeMode),
    cursor: 'pointer',
    fontSize: '11px'
  };

  // Helper function to check if messages should be grouped
  const shouldGroupWithPrevious = (currentIndex: number) => {
    if (currentIndex === 0) return false;
    
    const current = updatesList[currentIndex];
    const previous = updatesList[currentIndex - 1];
    
    // Group if same user and within 2 minutes
    const isSameUser = current.user_id === previous.user_id;
    const timeDiff = dayjs(current.created_at).diff(dayjs(previous.created_at), 'minute');
    const isWithinTimeWindow = timeDiff < 2;
    
    return isSameUser && isWithinTimeWindow;
  };

  return (
    <Card
      className={`project-view-updates theme-${themeMode}`}
      styles={{ body: { padding: 0, height: '100%', display: 'flex', flexDirection: 'column' } }}
      style={{ height: 'calc(100vh - 260px)' }}
    >
      <div
        className="updates-list-container"
        ref={listRef}
        style={{
          backgroundColor: token.colorBgContainer
        }}
      >
        <div style={{ maxWidth: '900px', margin: '0 auto', width: '100%' }}>
        {loading && updatesList.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <Spin size="large" />
          </div>
        ) : updatesList.length === 0 ? (
          <Empty description={t('emptyState')} />
        ) : (
          <div>
            {updatesList.map((item, index) => {
              const isUserComment = item.user_id === user.id;
              const isGrouped = shouldGroupWithPrevious(index);

              // Render time separator logic
              const showTimeSeparator = index === 0 ||
                (index > 0 && isDifferentDay(item.created_at || '', updatesList[index - 1].created_at || ''));

              return (
                <div key={item.id || index}>
                  {showTimeSeparator && renderTimeSeparator(item.created_at || '')}

                  <Comment
                    author={!isGrouped ? <span style={authorStyle}>{item.created_by}</span> : null}
                    datetime={!isGrouped ? <span style={dateStyle}>{dayjs(item.created_at).fromNow()}</span> : null}
                    avatar={
                      !isGrouped ? (
                        <SingleAvatar
                          name={item.created_by}
                          avatarUrl={item.avatar_url}
                        />
                      ) : (
                        <div style={{ width: '32px' }} />
                      )
                    }
                    content={
                      <div className="comment-wrapper">
                        <div className="comment-hover-bar">
                          <div className="quick-reactions">
                            <Tooltip title={t('reactions.like', { defaultValue: 'Like' })}>
                              <span className="quick-emoji" onClick={() => handleReaction(item.id!, '👍')}>👍</span>
                            </Tooltip>
                            <Tooltip title={t('reactions.love', { defaultValue: 'Love' })}>
                              <span className="quick-emoji" onClick={() => handleReaction(item.id!, '❤️')}>❤️</span>
                            </Tooltip>
                            <Tooltip title={t('reactions.laugh', { defaultValue: 'Laugh' })}>
                              <span className="quick-emoji" onClick={() => handleReaction(item.id!, '😄')}>😄</span>
                            </Tooltip>
                            <Tooltip title={t('reactions.surprised', { defaultValue: 'Surprised' })}>
                              <span className="quick-emoji" onClick={() => handleReaction(item.id!, '😮')}>😮</span>
                            </Tooltip>
                            <Tooltip title={t('reactions.sad', { defaultValue: 'Sad' })}>
                              <span className="quick-emoji" onClick={() => handleReaction(item.id!, '😢')}>😢</span>
                            </Tooltip>
                            <Tooltip title={t('reactions.celebrate', { defaultValue: 'Celebrate' })}>
                              <span className="quick-emoji" onClick={() => handleReaction(item.id!, '🎉')}>🎉</span>
                            </Tooltip>
                            <Tooltip title={t('reactions.rocket', { defaultValue: 'Rocket' })}>
                              <span className="quick-emoji" onClick={() => handleReaction(item.id!, '🚀')}>🚀</span>
                            </Tooltip>
                            <Tooltip title={t('reactions.eyes', { defaultValue: 'Eyes' })}>
                              <span className="quick-emoji" onClick={() => handleReaction(item.id!, '👀')}>👀</span>
                            </Tooltip>
                            <Tooltip title={t('reactions.fire', { defaultValue: 'Fire' })}>
                              <span className="quick-emoji" onClick={() => handleReaction(item.id!, '🔥')}>🔥</span>
                            </Tooltip>
                            <Tooltip title={t('reactions.hundred', { defaultValue: '100' })}>
                              <span className="quick-emoji" onClick={() => handleReaction(item.id!, '💯')}>💯</span>
                            </Tooltip>
                          </div>
                          {isUserComment && (
                            <>
                              <div className="hover-divider" />
                              <Tooltip title={t('actions.edit', { defaultValue: 'Edit' })}>
                                <Button
                                  type="text"
                                  size="small"
                                  icon={<EditOutlined />}
                                  className="hover-action-btn"
                                  onClick={() => startEdit(item.id!, item.content || '')}
                                />
                              </Tooltip>
                              <Dropdown
                                menu={{
                                  items: [
                                    {
                                      key: 'delete',
                                      label: t('deleteButton'),
                                      icon: <DeleteOutlined />,
                                      danger: true,
                                      onClick: () => {
                                        handleDelete(item.id!);
                                      }
                                    }
                                  ]
                                }}
                                trigger={['click']}
                              >
                                <Button
                                  type="text"
                                  size="small"
                                  icon={<MoreOutlined />}
                                  className="hover-action-btn"
                                />
                              </Dropdown>
                            </>
                          )}
                        </div>
                        <div className={`comment-content-${themeMode}`}>
                          {editingCommentId === item.id ? (
                            <div>
                              <Input.TextArea
                                value={editContent}
                                onChange={(e) => setEditContent(e.target.value)}
                                autoSize={{ minRows: 2, maxRows: 6 }}
                                style={{ marginBottom: 8 }}
                              />
                              <Space>
                              <Button size="small" type="primary" onClick={() => handleEdit(item.id!)}>
                                {t('actions.save', { defaultValue: 'Save' })}
                              </Button>
                              <Button size="small" onClick={() => setEditingCommentId(null)}>
                                {t('cancelButton', { defaultValue: 'Cancel' })}
                              </Button>
                            </Space>
                            </div>
                          ) : (
                            <>
                              {renderCommentContent(item.content || '', item.mentions)}
                              {item.edited && (
                                <Tooltip title={`Edited ${dayjs(item.last_edited_at).fromNow()} by ${item.last_edited_by_name || 'Unknown'}`}>
                                  <span style={{ fontSize: 11, color: '#8c8c8c', marginLeft: 8, fontStyle: 'italic' }}>
                                    (edited)
                                  </span>
                                </Tooltip>
                              )}
                            </>
                          )}
                        
                          {/* Reactions */}
                          {item.reactions && item.reactions.length > 0 && (
                            <div style={{ marginTop: 6, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                              {item.reactions.map((reaction: any) => {
                                const hasReacted = reaction.users?.some((u: any) => u.user_id === user.id);
                                return (
                                  <Tooltip
                                    key={reaction.emoji}
                                    title={reaction.users?.map((u: any) => u.user_name).join(', ') || ''}
                                  >
                                    <span
                                      onClick={() => {
                                        if (hasReacted) {
                                          handleRemoveReaction(item.id!, reaction.emoji);
                                        } else {
                                          handleReaction(item.id!, reaction.emoji);
                                        }
                                      }}
                                      className={`reaction ${hasReacted ? 'reacted' : ''}`}
                                    >
                                      {reaction.emoji} {reaction.count}
                                    </span>
                                  </Tooltip>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    }
                    className={`${isUserComment ? 'current-user-comment' : ''} ${isGrouped ? 'grouped-comment' : ''}`}
                  />
                </div>
              );
            })}
          </div>
        )}
        </div>
      </div>

      <div
        className="updates-input-container"
        style={{
          borderTop: `1px solid ${token.colorBorderSecondary}`,
          backgroundColor: token.colorBgContainer
        }}
      >
        <div style={{ maxWidth: '900px', margin: '0 auto', width: '100%' }}>
          <Form form={form} onFinish={onFinish}>
            <Form.Item name="comment" style={{ marginBottom: 8 }}>
              <Mentions
                rows={2}
                placeholder={`${t('inputPlaceholder')} (Shift+Enter to send)`}
                options={mentionsOptions}
                autoSize={{ minRows: 1, maxRows: 4 }}
                style={{ borderRadius: '8px' }}
                onKeyDown={handleKeyDown}
              />
            </Form.Item>
            <Flex justify="flex-end">
              <Button
                type="primary"
                htmlType="submit"
                loading={submitting}
                icon={<SendOutlined />}
                size="small"
              >
                {t('addButton')}
              </Button>
            </Flex>
          </Form>
        </div>
      </div>
    </Card>
  );
};

export default ProjectViewUpdates;