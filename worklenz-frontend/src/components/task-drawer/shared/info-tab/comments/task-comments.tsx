import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Skeleton,
  Tooltip,
  Popconfirm,
  Button,
  Space,
  Dropdown,
  Input,
  Popover,
} from '@/shared/antd-imports';
import { EditOutlined, MoreOutlined, DeleteOutlined } from '@ant-design/icons';
import { Comment } from '@ant-design/compatible';
import dayjs from 'dayjs';

import { ITaskComment, ITaskCommentViewModel, ReactionType } from '@/types/tasks/task-comments.types';
import taskCommentsApiService from '@/api/tasks/task-comments.api.service';
import { useAuthService } from '@/hooks/useAuth';
import { fromNow } from '@/utils/dateUtils';
import { AvatarNamesMap } from '@/shared/constants';
import logger from '@/utils/errorLogger';
import './task-comments.css';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { updateTaskCounts } from '@/features/task-management/task-management.slice';
import { themeWiseColor } from '@/utils/themeWiseColor';
import { colors } from '@/styles/colors';
import AttachmentsGrid from '../attachments/attachments-grid';
import { TFunction } from 'i18next';
import SingleAvatar from '@/components/common/single-avatar/single-avatar';
import { sanitizeCommentContent } from '@/utils/sanitizeInput';
import { useSocket } from '@/socket/socketContext';
import { SocketEvents } from '@/shared/socket-events';
import { REACTION_CONFIGS } from '@/shared/reaction-config';
import { useUpgradePrompt } from '@/worklenz-ee/hooks/use-upgrade-prompt';
import { useBusinessFeatures } from '@/worklenz-ee/hooks/use-business-features';
import { useAppSumoTracking } from '@/hooks/useAppSumoTracking';
import { AppSumoUpsellEvents } from '@/types/mixpanel-events.types';

// Helper function to format date for time separators
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

// Helper function to check if two dates are from different days
const isDifferentDay = (date1: string, date2: string) => {
  return !dayjs(date1).isSame(dayjs(date2), 'day');
};

// Helper function to check if content already has processed mentions
const hasProcessedMentions = (content: string): boolean => {
  return content.includes('<span class="mentions">');
};

// Enhanced mention processing function
const processMentions = (content: string) => {
  if (!content) return '';

  if (hasProcessedMentions(content)) {
    return content;
  }

  return content.replace(/@([\w]+(?:\s+[\w]+)*)/g, '<span class="mentions">@$1</span>');
};

/**
 * Converts plain-text URLs in a string into safe, clickable anchor tags.
 */
const linkifyUrls = (content: string): string => {
  if (!content) return '';

  const URL_REGEX = /(?<!href="|href=')(https?:\/\/[\w\-._~:/?#[\]@!$&'()*+,;=%]+)/gi;

  return content.replace(URL_REGEX, rawUrl => {
    const safeHref = rawUrl.replace(/"/g, '%22').replace(/'/g, '%27');
    const label = rawUrl.replace(/^https?:\/\//, '');

    return (
      `<a ` +
      `href="${safeHref}" ` +
      `target="_blank" ` +
      `rel="noopener noreferrer" ` +
      `class="comment-link"` +
      `>${label}</a>`
    );
  });
};

// Helper function to process content
const processContent = (content: string) => {
  if (!content) return '';

  let processed = sanitizeCommentContent(content);

  if (!hasProcessedMentions(processed)) {
    processed = processMentions(processed);
  }

  processed = linkifyUrls(processed);

  return processed;
};

/**
 * Strips all HTML markup from stored comment content so the textarea shows
 * plain text ready for re-editing.
 */
const prepareContentForEditing = (content: string): string => {
  if (!content) return '';

  const withoutMentionSpans = content.replace(
    /<span class="mentions">@([\w]+(?:\s+[\w]+)*)<\/span>/g,
    '@$1'
  );

  const withRawUrls = withoutMentionSpans.replace(/<a[^>]*href="([^"]*)"[^>]*>[^<]*<\/a>/gi, '$1');

  return withRawUrls.replace(/<[^>]*>/g, '');
};

const TaskComments = ({ taskId, t }: { taskId?: string; t: TFunction }) => {
  const [loading, setLoading] = useState(true);
  const [comments, setComments] = useState<ITaskCommentViewModel[]>([]);
  const commentsViewRef = useRef<HTMLDivElement>(null);
  const auth = useAuthService();
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const currentSession = auth.getCurrentSession();
  const currentUserId = currentSession?.id;
  const teamMemberId = currentSession?.team_member_id;
  const { hasBusinessAccess } = useBusinessFeatures();
  const { promptUpgrade } = useUpgradePrompt();
  const { trackAppSumoEvent } = useAppSumoTracking();
  const isAppSumoUser = String(currentSession?.subscription_type || '').toLowerCase().includes('appsumo');
  const { socket, connected } = useSocket();
  const dispatch = useAppDispatch();

  // Inline-edit state
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editLoading, setEditLoading] = useState(false);

  const getComments = useCallback(
    async (showLoading = true) => {
      if (!taskId) return;

      try {
        if (showLoading) {
          setLoading(true);
        }

        const res = await taskCommentsApiService.getByTaskId(taskId);
        if (res.done) {
          const sortedComments = [...res.body].sort((a, b) => {
            return dayjs(a.created_at).isBefore(dayjs(b.created_at)) ? -1 : 1;
          });

          // Process content for display but preserve task_id from response
          sortedComments.forEach(comment => {
            if (comment.content) {
              comment.content = processContent(comment.content);
            }
            // Ensure task_id is always set — fall back to the prop if backend omits it
            if (!comment.task_id) {
              comment.task_id = taskId;
            }
          });

          setComments(sortedComments);

          dispatch(
            updateTaskCounts({
              taskId,
              counts: {
                comments_count: sortedComments.length,
              },
            })
          );
        }

        setLoading(false);
      } catch (e) {
        logger.error('Error fetching comments', e);
        setLoading(false);
      }
    },
    [taskId, dispatch]
  );

  useEffect(() => {
    if (taskId) {
      getComments();
    }

    return () => {
      setComments([]);
    };
  }, [taskId, getComments]);

  const scrollIntoView = useCallback(() => {
    commentsViewRef.current?.scrollIntoView();
  }, []);

  useEffect(() => {
    const handleCommentCreate = () => {
      getComments(false);
      scrollIntoView();
    };

    const handleCommentUpdate = () => {
      getComments(false);
    };

    document.addEventListener('task-comment-create', handleCommentCreate);
    document.addEventListener('task-comment-update', handleCommentUpdate);

    return () => {
      document.removeEventListener('task-comment-create', handleCommentCreate);
      document.removeEventListener('task-comment-update', handleCommentUpdate);
    };
  }, [taskId, getComments, scrollIntoView]);

  const canEdit = (userId?: string) => {
    if (!userId) return false;
    return userId === currentUserId;
  };

  // ─── Reactions ────────────────────────────────────────────────────────────

  const handleReactionClick = async (item: ITaskCommentViewModel, reactionType: ReactionType) => {
    if (!item.id || !taskId) return;

    try {
      const res = await taskCommentsApiService.updateReaction(item.id, {
        reaction_type: reactionType,
        task_id: taskId,
      });
      if (res.done) {
        getComments(false);
        document.dispatchEvent(new Event('task-comment-update'));
      }
    } catch (e) {
      logger.error('Error updating reaction', e);
    }
  };

  const hasUserReacted = (item: ITaskCommentViewModel, reactionType: ReactionType): boolean => {
    if (!teamMemberId || !item?.reactions) return false;
    return item.reactions[reactionType]?.reacted_member_ids?.includes(teamMemberId) || false;
  };

  const getExistingReactions = (item: ITaskCommentViewModel) => {
    if (!item.reactions) return [];
    return Object.entries(item.reactions)
      .filter(([_, details]) => details.count > 0)
      .map(([type, details]) => {
        const config = REACTION_CONFIGS.find(c => c.type === type);
        return {
          type: type as ReactionType,
          emoji: config?.emoji || '👍',
          count: details.count,
          members: details.reacted_members || [],
          isUserReacted: hasUserReacted(item, type as ReactionType),
        };
      });
  };

  // ─── Delete ───────────────────────────────────────────────────────────────

  const deleteComment = async (id?: string) => {
    if (!taskId || !id) return;

    try {
      const res = await taskCommentsApiService.delete(id, taskId);
      if (res.done) {
        await getComments(false);
      }
    } catch (e) {
      logger.error('Error deleting comment', e);
    }
  };

  // ─── Edit ─────────────────────────────────────────────────────────────────

  const startEdit = (item: ITaskCommentViewModel) => {
    setEditingCommentId(item.id || null);
    setEditContent(prepareContentForEditing(item.content || ''));
  };

  const cancelEdit = () => {
    setEditingCommentId(null);
    setEditContent('');
  };

  const saveEdit = async (item: ITaskCommentViewModel) => {
    const resolvedTaskId = item.task_id || taskId;

    if (!item.id || !resolvedTaskId || !editContent.trim()) return;

    const originalContent = prepareContentForEditing(item.content || '');
    if (editContent.trim() === originalContent.trim()) {
      cancelEdit();
      return;
    }

    try {
      setEditLoading(true);

      const res = await taskCommentsApiService.update(item.id, {
        task_id: resolvedTaskId,
        content: editContent,
      } as ITaskComment);

      if (res.done) {
        setEditingCommentId(null);
        setEditContent('');
        getComments(false);
        document.dispatchEvent(
          new CustomEvent('task-comment-update', {
            detail: { taskId: resolvedTaskId },
          })
        );
      }
    } catch (e) {
      logger.error('Error updating comment', e);
    } finally {
      setEditLoading(false);
    }
  };

  // ─── Delete Attachment ────────────────────────────────────────────────────

  const deleteAttachment = async (attachmentId: string) => {
    if (!attachmentId || !taskId) return;

    try {
      const res = await taskCommentsApiService.deleteAttachment(attachmentId, taskId);
      if (res.done) {
        await getComments(false);
        document.dispatchEvent(
          new CustomEvent('task-comment-update', {
            detail: { taskId },
          })
        );
      }
    } catch (e) {
      logger.error('Error deleting attachment', e);
    }
  };

  // Theme-aware styles
  const authorStyle = {
    color: themeWiseColor(colors.lightGray, colors.deepLightGray, themeMode),
    fontSize: '12px',
  };

  const dateStyle = {
    color: themeWiseColor(colors.deepLightGray, colors.lightGray, themeMode),
    fontSize: '11px',
  };

  const renderTimeSeparator = (date: string) => (
    <div className="comment-time-separator">
      <span
        style={{
          backgroundColor: themeWiseColor('#fff', '#1e1e1e', themeMode),
        }}
      >
        {formatDateForSeparator(date)}
      </span>
    </div>
  );

  const isCurrentUser = (userId?: string) => {
    return userId === currentUserId;
  };

  const ninetyDaysAgo = Date.now() - 90 * 24 * 60 * 60 * 1000;
  const visibleComments = hasBusinessAccess
    ? comments
    : comments.filter(comment => {
        if (!comment.created_at) return true;
        return new Date(comment.created_at).getTime() >= ninetyDaysAgo;
      });
  const lockedCommentsCount = hasBusinessAccess ? 0 : comments.length - visibleComments.length;
  const [isHistoryPopoverOpen, setIsHistoryPopoverOpen] = useState(false);

  return (
    <div className={`task-view-comments theme-${themeMode}`} ref={commentsViewRef}>
      <Skeleton loading={loading}>
        {visibleComments.length > 0 ? (
          <>
            {lockedCommentsCount > 0 && (
              <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between' }}>
                <p style={{ margin: 0, fontSize: 12, color: '#8c8c8c' }}>
                  {t('taskInfoTab.comments.historyLockedBoundary', {
                    defaultValue: 'Comment history is limited to the last 90 days on this plan',
                  })}
                </p>
                <Popover
                  trigger="click"
                  open={isHistoryPopoverOpen}
                  onOpenChange={open => {
                    setIsHistoryPopoverOpen(open);
                    if (isAppSumoUser) {
                      trackAppSumoEvent(
                        open ? AppSumoUpsellEvents.UPGRADE_PROMPT_SHOWN : AppSumoUpsellEvents.UPGRADE_PROMPT_DISMISSED,
                        { feature: 'comment_history' }
                      );
                    }
                  }}
                  title={t('taskInfoTab.comments.historyLockedTitle', {
                    defaultValue: 'Comment History Locked',
                  })}
                  content={
                    <div style={{ maxWidth: 280, display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <span>
                        {t('taskInfoTab.comments.historyLockedBody', {
                          defaultValue:
                            'Comments beyond 90 days are available on the Business plan.',
                        })}
                      </span>
                      <Button
                        type="primary"
                        onClick={() => {
                          setIsHistoryPopoverOpen(false);
                          if (isAppSumoUser) {
                            trackAppSumoEvent(AppSumoUpsellEvents.LOCKED_HISTORY_VIEW_CLICKED, { feature: 'comment_history' });
                            trackAppSumoEvent(AppSumoUpsellEvents.UPGRADE_NOW_CLICKED, { feature: 'comment_history' });
                          }
                          promptUpgrade();
                        }}
                      >
                        {t('upgradeNow', { defaultValue: 'Upgrade Now' })}
                      </Button>
                    </div>
                  }
                >
                  <Button size="small">
                    {t('taskInfoTab.comments.viewFullComments', {
                      defaultValue: 'View comment history',
                    })}
                  </Button>
                </Popover>
              </div>
            )}
            {visibleComments.map((item, index) => {
              const isUserComment = isCurrentUser(item.user_id);
              const existingReactions = getExistingReactions(item);
              const isEditing = editingCommentId === item.id;

              return (
                <div key={item.id}>
                  {(index === 0 ||
                    (index > 0 &&
                      isDifferentDay(
                        item.created_at || '',
                        visibleComments[index - 1].created_at || ''
                      ))) &&
                    renderTimeSeparator(item.created_at || '')}

                  <Comment
                    key={item.id}
                    author={<span style={authorStyle}>{item.member_name}</span>}
                    datetime={
                      <span style={dateStyle}>
                        {fromNow(item.created_at || '')}
                        {/* ── Edited indicator ── */}
                        {item.is_edited && (
                          <span
                            style={{
                              marginLeft: 6,
                              fontSize: '10px',
                              color: themeWiseColor(colors.lightGray, colors.deepLightGray, themeMode),
                              fontStyle: 'italic',
                            }}
                          >
                            {t('taskInfoTab.comments.edited', { defaultValue: '(edited)' })}
                          </span>
                        )}
                      </span>
                    }
                    avatar={<SingleAvatar name={item.member_name} avatarUrl={item.avatar_url} />}
                    content={
                      <div className="comment-wrapper">
                        {/* ── Hover action bar ───────────────────────────── */}
                        {!isEditing && (
                          <div className={`comment-hover-bar theme-${themeMode}`}>
                            {/* Quick emoji reactions */}
                            <div className="quick-reactions">
                              {REACTION_CONFIGS.slice(0, 6).map(config => (
                                <Tooltip
                                  key={config.type}
                                  title={t(`reactions.${config.type}`, {
                                    defaultValue: config.label,
                                  })}
                                >
                                  <span
                                    className={`quick-emoji${hasUserReacted(item, config.type) ? ' reacted-emoji' : ''}`}
                                    onClick={() => handleReactionClick(item, config.type)}
                                  >
                                    {config.emoji}
                                  </span>
                                </Tooltip>
                              ))}
                            </div>

                            {/* Edit + Delete (own comments only) */}
                            {isUserComment && (
                              <>
                                <div className={`hover-divider theme-${themeMode}`} />
                                <Tooltip
                                  title={t('taskInfoTab.comments.edit', {
                                    defaultValue: 'Edit',
                                  })}
                                >
                                  <Button
                                    type="text"
                                    size="small"
                                    icon={<EditOutlined />}
                                    className="hover-action-btn"
                                    onClick={() => startEdit(item)}
                                  />
                                </Tooltip>
                                <Dropdown
                                  menu={{
                                    items: [
                                      {
                                        key: 'delete',
                                        label: (
                                          <Popconfirm
                                            title={t(
                                              'taskInfoTab.comments.confirmDeleteComment'
                                            )}
                                            onConfirm={() => deleteComment(item.id)}
                                            okText={t('common.yes', { defaultValue: 'Yes' })}
                                            cancelText={t('common.no', { defaultValue: 'No' })}
                                          >
                                            <span>
                                              {t('taskInfoTab.comments.delete', {
                                                defaultValue: 'Delete',
                                              })}
                                            </span>
                                          </Popconfirm>
                                        ),
                                        icon: <DeleteOutlined />,
                                        danger: true,
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
                        )}

                        {/* ── Comment body ───────────────────────────────── */}
                        <div className={`comment-content-${themeMode}`}>
                          {isEditing ? (
                            <div>
                              <Input.TextArea
                                value={editContent}
                                onChange={e => setEditContent(e.target.value)}
                                autoSize={{ minRows: 2, maxRows: 6 }}
                                style={{ marginBottom: 8 }}
                                autoFocus
                              />
                              <Space>
                                <Button
                                  size="small"
                                  type="primary"
                                  loading={editLoading}
                                  onClick={() => saveEdit(item)}
                                >
                                  {t('taskInfoTab.comments.save', { defaultValue: 'Save' })}
                                </Button>
                                <Button size="small" onClick={cancelEdit}>
                                  {t('taskInfoTab.comments.cancel', { defaultValue: 'Cancel' })}
                                </Button>
                              </Space>
                            </div>
                          ) : (
                            <>
                              <p dangerouslySetInnerHTML={{ __html: item.content || '' }} />
                              {item.attachments && item.attachments.length > 0 && (
                                <div className="ant-upload-list ant-upload-list-picture-card">
                                  <AttachmentsGrid
                                    attachments={item.attachments}
                                    t={t}
                                    loadingTask={false}
                                    uploading={false}
                                    handleFilesSelected={() => {}}
                                    isCommentAttachment={true}
                                  />
                                </div>
                              )}
                            </>
                          )}

                          {/* ── Existing reaction badges ─────────────────── */}
                          {existingReactions.length > 0 && !isEditing && (
                            <div className="reaction-badges-row">
                              {existingReactions.map(reaction => (
                                <Tooltip
                                  key={reaction.type}
                                  title={
                                    reaction.members.length > 0 ? (
                                      <div>
                                        {reaction.members.map((member, i) => (
                                          <div key={i}>{member}</div>
                                        ))}
                                      </div>
                                    ) : null
                                  }
                                >
                                  <span
                                    className={`reaction ${reaction.isUserReacted ? 'reacted' : ''} theme-${themeMode}`}
                                    onClick={() => handleReactionClick(item, reaction.type)}
                                  >
                                    {reaction.emoji} {reaction.count}
                                  </span>
                                </Tooltip>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    }
                    className={isUserComment ? 'current-user-comment' : ''}
                  />
                </div>
              );
            })}
          </>
        ) : (
          <div className="empty-comments">
            <p
              style={{
                textAlign: 'center',
                color: themeWiseColor(colors.lightGray, colors.deepLightGray, themeMode),
                padding: '16px 0',
              }}
            >
              {t('taskInfoTab.comments.noComments')}
            </p>
          </div>
        )}
      </Skeleton>
    </div>
  );
};

export default TaskComments;
