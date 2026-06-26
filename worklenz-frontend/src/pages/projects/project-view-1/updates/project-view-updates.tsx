import {
  Button,
  Card,
  Empty,
  Flex,
  Form,
  Popconfirm,
  Space,
  Spin,
  theme,
  Tooltip,
  Input,
  Dropdown,
  message,
  Popover,
} from '@/shared/antd-imports';
import { SendOutlined, EditOutlined, MoreOutlined, DeleteOutlined } from '@ant-design/icons';
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
  updateCommentAfterEdit,
} from '@/features/projects/singleProject/updates/updatesSlice';
import { useUpgradePrompt } from '@/worklenz-ee/hooks/use-upgrade-prompt';
import { useAppSumoTracking } from '@/hooks/useAppSumoTracking';
import { AppSumoUpsellEvents } from '@/types/mixpanel-events.types';
import { getAllProjectMembers } from '@/features/projects/singleProject/members/projectMembersSlice';
import { projectCommentsApiService } from '@/api/projects/comments/project-comments.api.service';
import { useAuthService } from '@/hooks/useAuth';
import SingleAvatar from '@/components/common/single-avatar/single-avatar';
import { themeWiseColor } from '@/utils/themeWiseColor';
import { colors } from '@/styles/colors';
import { useBusinessFeatures } from '@/worklenz-ee/hooks/use-business-features';
import CustomMentionsInput from './CustomMentionsInput';
import './project-view-updates.css';

dayjs.extend(relativeTime);

const { useToken } = theme;

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

const escapeHtml = (text: string) => {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
};

const ProjectViewUpdates = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const dispatch = useAppDispatch();
  const { socket } = useSocket();
  const [form] = Form.useForm();
  const { t } = useTranslation('project-view-updates');
  const { token } = useToken();
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const authService = useAuthService();
  const currentSession = useMemo(() => authService.getCurrentSession(), [authService]);
  const { hasBusinessAccess } = useBusinessFeatures();
  const { promptUpgrade } = useUpgradePrompt();
  const { trackAppSumoEvent } = useAppSumoTracking();
  const isAppSumoUser = String(currentSession?.subscription_type || '').toLowerCase().includes('appsumo');

  const listRef = useRef<HTMLDivElement>(null);

  const { updatesList, loading } = useAppSelector(state => state.updatesReducer);
  const user = useAppSelector(state => state.userReducer);
  const projectMembers = useAppSelector(state => state.projectMemberReducer.currentMembersList);

  const [submitting, setSubmitting] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [commentValue, setCommentValue] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<
    { id: string; team_member_id: string; name: string; user_id?: string }[]
  >([]);

  const [editSelectedMembers, setEditSelectedMembers] = useState<
    { id: string; team_member_id: string; name: string; user_id?: string }[]
  >([]);

  useEffect(() => {
    if (projectId) {
      dispatch(getProjectComments(projectId));
      dispatch(getAllProjectMembers(projectId));
    }
  }, [projectId, dispatch]);

  useEffect(() => {
    if (!socket || !projectId) return;

    const handleNewComment = (isNew: boolean) => {
      if (isNew) {
        dispatch(getProjectComments(projectId));
      }
    };

    const handleReactionAdded = (data: any) => {
      dispatch(
        addReactionToComment({
          comment_id: data.comment_id,
          reactions: data.reactions,
        })
      );
    };

    const handleReactionRemoved = (data: any) => {
      dispatch(
        addReactionToComment({
          comment_id: data.comment_id,
          reactions: data.reactions,
        })
      );
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

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [updatesList]);

  const mentionsOptions = useMemo(
    () =>
      projectMembers
        .filter(member => member.name && member.user_id)
        .map(member => ({
          value: member.name,
          label: (
            <Space>
              <SingleAvatar avatarUrl={member.avatar_url} name={member.name} />
              <span>{member.name}</span>
              {member.role && (
                <span style={{ color: '#999', fontSize: '12px' }}>({member.role})</span>
              )}
            </Space>
          ),
          key: member.user_id,
        })),
    [projectMembers]
  );

  const memberSelectHandler = useCallback(
    (member: any) => {
      if (!member?.value || !member?.key) return;

      const selectedMember = projectMembers.find(m => m.user_id === member.key);

      if (!selectedMember || !selectedMember.user_id) return;

      const mentionObject = {
        id: selectedMember.user_id!,
        team_member_id: selectedMember.id!,
        name: selectedMember.name!,
        user_id: selectedMember.user_id!,
      };

      setSelectedMembers(prev => {
        if (prev.some(m => m.id === selectedMember.user_id)) {
          return prev;
        }
        return [...prev, mentionObject];
      });
    },
    [projectMembers]
  );

  const handleCommentChange = useCallback((value: string) => {
    setCommentValue(value);
  }, []);

  const onFinish = async () => {
    if (!projectId || !commentValue?.trim()) {
      message.error(t('emptyCommentError', { defaultValue: 'Please enter a comment' }));
      return;
    }

    setSubmitting(true);

    try {
      const uniqueMentions = Array.from(
        new Map(selectedMembers.map(member => [member.id, member])).values()
      );

      const validMentions = uniqueMentions.filter(
        mention => mention.id && mention.user_id && mention.name
      );

      if (validMentions.length !== uniqueMentions.length) {
        message.warning('Some invalid mentions were removed');
      }

      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const mentionsWithValidUUIDs = validMentions.filter(mention => uuidRegex.test(mention.id));

      if (mentionsWithValidUUIDs.length !== validMentions.length) {
        message.error('Some mentions have invalid user IDs and were removed');
      }

      await dispatch(
        createProjectComment({
          project_id: projectId,
          content: commentValue,
          mentions: mentionsWithValidUUIDs,
        })
      ).unwrap();

      setCommentValue('');
      setSelectedMembers([]);

      setTimeout(() => {
        if (listRef.current) {
          listRef.current.scrollTop = listRef.current.scrollHeight;
        }
      }, 100);
    } catch (error: any) {
      if (
        error?.message?.includes('foreign_key_violation') ||
        error?.message?.includes('informed_by')
      ) {
        message.error('Failed to send comment: Invalid user reference. Please try again.');
      } else {
        message.error(t('commentError', { defaultValue: 'Failed to send comment' }));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.shiftKey) {
      e.preventDefault();
      onFinish();
    }
  };

  const handleDelete = async (commentId: string) => {
    if (!commentId) return;
    try {
      await dispatch(deleteProjectComment(commentId)).unwrap();
      message.success(t('deleteSuccess', { defaultValue: 'Comment deleted successfully' }));
    } catch (error) {
      message.error(t('deleteError', { defaultValue: 'Failed to delete comment' }));
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

  
  const handleEdit = async (commentId: string, item: any) => {
    if (!editContent.trim()) return;

    let originalContent = item.content || '';
    if (item.mentions && item.mentions.length > 0) {
      item.mentions.forEach((mention: any, index: number) => {
        const userName = mention.user_name || mention.name;
        originalContent = originalContent.replace(`{${index}}`, `@${userName}`);
      });
    }
   
    if (editContent.trim() === originalContent.trim()) {
      setEditingCommentId(null);
      setEditContent('');
      setEditSelectedMembers([]);
      return;
    }

    try {
      let contentToSave = editContent;

      editSelectedMembers.forEach((member, index) => {
        contentToSave = contentToSave.replace(`@${member.name}`, `{${index}}`);
      });

      await projectCommentsApiService.editComment(commentId, contentToSave);

      setEditingCommentId(null);
      setEditContent('');
      setEditSelectedMembers([]);

      message.success(t('editSuccess', { defaultValue: 'Comment updated successfully' }));
    } catch (error) {
      message.error(t('editError', { defaultValue: 'Failed to edit comment' }));
    }
  };

  const startEdit = (commentId: string, content: string, mentions?: any[]) => {
    setEditingCommentId(commentId);

    let editableContent = content;

    if (mentions && mentions.length > 0) {
      mentions.forEach((mention, index) => {
        const userName = mention.user_name || mention.name;
        editableContent = editableContent.replace(`{${index}}`, `@${userName}`);
      });

      setEditSelectedMembers(
        mentions.map(mention => ({
          id: mention.user_id || mention.id,
          team_member_id: mention.team_member_id || mention.id,
          name: mention.user_name || mention.name,
          user_id: mention.user_id || mention.id,
        }))
      );
    } else {
      setEditSelectedMembers([]);
    }

    setEditContent(editableContent);
  };

  const processMentions = (content: string, mentions: any[]) => {
    let processedContent = content.replace(/\n/g, '<br/>');

    if (!mentions || mentions.length === 0) {
      return processedContent;
    }

    mentions.forEach((mention, index) => {
      const userName = mention.user_name || mention.name;
      if (!userName) return;

      const escapedName = escapeHtml(userName);

      // Normal saved format: {0}, {1}
      processedContent = processedContent.replace(
        new RegExp(`\\{${index}\\}`, 'g'),
        `<span class='mentions'>@${escapedName}</span>`
      );

      // Old edited format: @User Name saved as plain text
      processedContent = processedContent.replace(
        new RegExp(`@${userName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'g'),
        `<span class='mentions'>@${escapedName}</span>`
      );
    });

    return processedContent;
  };

  const renderCommentContent = (htmlContent: string, mentions?: any[]) => {
    const processedContent = mentions ? processMentions(htmlContent, mentions) : htmlContent;
    return <div dangerouslySetInnerHTML={{ __html: processedContent }} />;
  };

  const renderTimeSeparator = (date: string) => (
    <div className="comment-time-separator">
      <span
        style={{
          backgroundColor: token.colorBgContainer,
          color: token.colorTextSecondary,
        }}
      >
        {formatDateForSeparator(date)}
      </span>
    </div>
  );

  const authorStyle = {
    color: themeWiseColor(colors.lightGray, colors.deepLightGray, themeMode),
    fontSize: '12px',
  };

  const dateStyle = {
    color: themeWiseColor(colors.deepLightGray, colors.lightGray, themeMode),
    fontSize: '11px',
    marginLeft: '8px',
  };

  const shouldGroupWithPrevious = (currentIndex: number, list = updatesList) => {
    if (currentIndex === 0) return false;

    const current = list[currentIndex];
    const previous = list[currentIndex - 1];

    const isSameUser = current.user_id === previous.user_id;
    const timeDiff = dayjs(current.created_at).diff(dayjs(previous.created_at), 'minute');
    const isWithinTimeWindow = timeDiff < 2;

    return isSameUser && isWithinTimeWindow;
  };

  const ninetyDaysAgo = Date.now() - 90 * 24 * 60 * 60 * 1000;
  const visibleUpdates = hasBusinessAccess
    ? updatesList
    : updatesList.filter(item => {
        if (!item.created_at) return true;
        return new Date(item.created_at).getTime() >= ninetyDaysAgo;
      });
  const lockedUpdatesCount = hasBusinessAccess ? 0 : updatesList.length - visibleUpdates.length;
  const [isHistoryPopoverOpen, setIsHistoryPopoverOpen] = useState(false);

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
          backgroundColor: token.colorBgContainer,
        }}
      >
        <div style={{ maxWidth: '900px', margin: '0 auto', width: '100%' }}>
          {loading && updatesList.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <Spin size="large" />
            </div>
          ) : visibleUpdates.length === 0 ? (
            <Empty description={t('emptyState')} />
          ) : (
            <div>
              {lockedUpdatesCount > 0 && (
                <Flex
                  align="center"
                  justify="space-between"
                  style={{ marginBottom: 12, paddingInline: 16 }}
                >
                  <span style={{ fontSize: 12, color: '#8c8c8c' }}>
                    {t('historyLockedBoundary', {
                      defaultValue: 'Chat history is limited to the last 90 days on this plan',
                    })}
                  </span>
                  <Popover
                    trigger="click"
                    open={isHistoryPopoverOpen}
                    onOpenChange={open => {
                      setIsHistoryPopoverOpen(open);
                      if (isAppSumoUser) {
                        trackAppSumoEvent(
                          open ? AppSumoUpsellEvents.UPGRADE_PROMPT_SHOWN : AppSumoUpsellEvents.UPGRADE_PROMPT_DISMISSED,
                          { feature: 'project_updates_history' }
                        );
                      }
                    }}
                    title={t('historyLockedTitle', { defaultValue: 'Chat History Locked' })}
                    content={
                      <Flex vertical gap={12} style={{ maxWidth: 280 }}>
                        <span>
                          {t('historyLockedBody', {
                            defaultValue:
                              'Chat history beyond 90 days is available on the Business plan.',
                          })}
                        </span>
                        <Button
                          type="primary"
                          onClick={() => {
                            setIsHistoryPopoverOpen(false);
                            if (isAppSumoUser) {
                              trackAppSumoEvent(AppSumoUpsellEvents.LOCKED_HISTORY_VIEW_CLICKED, { feature: 'project_updates_history' });
                              trackAppSumoEvent(AppSumoUpsellEvents.UPGRADE_NOW_CLICKED, { feature: 'project_updates_history' });
                            }
                            promptUpgrade();
                          }}
                        >
                          {t('upgradeNow', { defaultValue: 'Upgrade Now' })}
                        </Button>
                      </Flex>
                    }
                  >
                    <Button size="small">
                      {t('viewFullHistory', { defaultValue: 'View Full History' })}
                    </Button>
                  </Popover>
                </Flex>
              )}
              {visibleUpdates.map((item, index) => {
                const isUserComment = item.user_id === user.id;
                const isGrouped = shouldGroupWithPrevious(index, visibleUpdates);

                const showTimeSeparator =
                  index === 0 ||
                  (index > 0 &&
                    isDifferentDay(
                      item.created_at || '',
                      visibleUpdates[index - 1].created_at || ''
                    ));

                return (
                  <div key={item.id || index}>
                    {showTimeSeparator && renderTimeSeparator(item.created_at || '')}

                    <Comment
                      author={
                        !isGrouped ? <span style={authorStyle}>{item.created_by}</span> : null
                      }
                      datetime={
                        !isGrouped ? (
                          <span style={dateStyle}>{dayjs(item.created_at).fromNow()}</span>
                        ) : null
                      }
                      avatar={
                        !isGrouped ? (
                          <SingleAvatar name={item.created_by} avatarUrl={item.avatar_url} />
                        ) : (
                          <div style={{ width: '32px' }} />
                        )
                      }
                      content={
                        <div className="comment-wrapper">
                          <div className="comment-hover-bar">
                            <div className="quick-reactions">
                              <Tooltip title={t('reactions.like', { defaultValue: 'Like' })}>
                                <span
                                  className="quick-emoji"
                                  onClick={() => handleReaction(item.id!, '👍')}
                                >
                                  👍
                                </span>
                              </Tooltip>
                              <Tooltip title={t('reactions.love', { defaultValue: 'Love' })}>
                                <span
                                  className="quick-emoji"
                                  onClick={() => handleReaction(item.id!, '❤️')}
                                >
                                  ❤️
                                </span>
                              </Tooltip>
                              <Tooltip title={t('reactions.laugh', { defaultValue: 'Laugh' })}>
                                <span
                                  className="quick-emoji"
                                  onClick={() => handleReaction(item.id!, '😄')}
                                >
                                  😄
                                </span>
                              </Tooltip>
                              <Tooltip
                                title={t('reactions.surprised', { defaultValue: 'Surprised' })}
                              >
                                <span
                                  className="quick-emoji"
                                  onClick={() => handleReaction(item.id!, '😮')}
                                >
                                  😮
                                </span>
                              </Tooltip>
                              <Tooltip title={t('reactions.sad', { defaultValue: 'Sad' })}>
                                <span
                                  className="quick-emoji"
                                  onClick={() => handleReaction(item.id!, '😢')}
                                >
                                  😢
                                </span>
                              </Tooltip>
                              <Tooltip
                                title={t('reactions.celebrate', { defaultValue: 'Celebrate' })}
                              >
                                <span
                                  className="quick-emoji"
                                  onClick={() => handleReaction(item.id!, '🎉')}
                                >
                                  🎉
                                </span>
                              </Tooltip>
                              <Tooltip title={t('reactions.rocket', { defaultValue: 'Rocket' })}>
                                <span
                                  className="quick-emoji"
                                  onClick={() => handleReaction(item.id!, '🚀')}
                                >
                                  🚀
                                </span>
                              </Tooltip>
                              <Tooltip title={t('reactions.eyes', { defaultValue: 'Eyes' })}>
                                <span
                                  className="quick-emoji"
                                  onClick={() => handleReaction(item.id!, '👀')}
                                >
                                  👀
                                </span>
                              </Tooltip>
                              <Tooltip title={t('reactions.fire', { defaultValue: 'Fire' })}>
                                <span
                                  className="quick-emoji"
                                  onClick={() => handleReaction(item.id!, '🔥')}
                                >
                                  🔥
                                </span>
                              </Tooltip>
                              <Tooltip title={t('reactions.hundred', { defaultValue: '100' })}>
                                <span
                                  className="quick-emoji"
                                  onClick={() => handleReaction(item.id!, '💯')}
                                >
                                  💯
                                </span>
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
                                    onClick={() =>
                                      startEdit(item.id!, item.content || '', item.mentions)
                                    }
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
                                        },
                                      },
                                    ],
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
                                  onChange={e => setEditContent(e.target.value)}
                                  autoSize={{ minRows: 2, maxRows: 6 }}
                                  style={{ marginBottom: 8 }}
                                />
                                <Space>
                                  {/* ✅ FIX: Pass item to handleEdit so it can compare
                                      original vs current content before calling the API */}
                                  <Button
                                    size="small"
                                    type="primary"
                                    onClick={() => handleEdit(item.id!, item)}
                                  >
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
                                  <Tooltip
                                    title={`Edited ${dayjs(item.last_edited_at).fromNow()} by ${item.last_edited_by_name || 'Unknown'}`}
                                  >
                                    <span
                                      style={{
                                        fontSize: 11,
                                        color: '#8c8c8c',
                                        marginLeft: 8,
                                        fontStyle: 'italic',
                                      }}
                                    >
                                      (edited)
                                    </span>
                                  </Tooltip>
                                )}
                              </>
                            )}

                            {item.reactions && item.reactions.length > 0 && (
                              <div
                                style={{ marginTop: 6, display: 'flex', gap: 4, flexWrap: 'wrap' }}
                              >
                                {item.reactions.map((reaction: any) => {
                                  const hasReacted = reaction.users?.some(
                                    (u: any) => u.user_id === user.id
                                  );
                                  return (
                                    <Tooltip
                                      key={reaction.emoji}
                                      title={
                                        reaction.users?.map((u: any) => u.user_name).join(', ') ||
                                        ''
                                      }
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
          backgroundColor: token.colorBgContainer,
          position: 'relative',
          zIndex: 10,
          overflow: 'visible',
        }}
      >
        <div style={{ maxWidth: '900px', margin: '0 auto', width: '100%' }}>
          <div style={{ marginBottom: 8 }}>
            <CustomMentionsInput
              placeholder={t('inputPlaceholder')}
              options={mentionsOptions}
              value={commentValue}
              onSelect={memberSelectHandler}
              onChange={handleCommentChange}
              onKeyDown={handleKeyDown}
              prefix="@"
              filterOption={(input: string, option: any) => {
                if (!input) return true;
                const optionLabel =
                  option?.label?.props?.children?.[1]?.props?.children || option?.value || '';
                return optionLabel.toLowerCase().includes(input.toLowerCase());
              }}
              style={{
                minHeight: 60,
                maxHeight: 120,
                borderRadius: '8px',
              }}
              themeMode={themeMode}
            />
          </div>
          <Flex justify="flex-end">
            <Button
              type="primary"
              onClick={onFinish}
              loading={submitting}
              icon={<SendOutlined />}
              size="small"
              disabled={!commentValue.trim()}
            >
              {t('addButton')}
            </Button>
          </Flex>
        </div>
      </div>
    </Card>
  );
};

export default ProjectViewUpdates;