import { useState, useEffect, useRef, useCallback } from 'react';
import { Skeleton, Avatar, Tooltip, Popconfirm } from 'antd';
import { Comment } from '@ant-design/compatible';
import dayjs from 'dayjs';

import { LikeOutlined, LikeTwoTone } from '@ant-design/icons';
import { ITaskCommentViewModel } from '@/types/tasks/task-comments.types';
import taskCommentsApiService from '@/api/tasks/task-comments.api.service';
import { useAuthService } from '@/hooks/useAuth';
import { fromNow } from '@/utils/dateUtils';
import { AvatarNamesMap } from '@/shared/constants';
import logger from '@/utils/errorLogger';
import TaskViewCommentEdit from './task-view-comment-edit';
import './task-comments.css';
import { useAppSelector } from '@/hooks/useAppSelector';
import { themeWiseColor } from '@/utils/themeWiseColor';
import { colors } from '@/styles/colors';
import AttachmentsGrid from '../attachments/attachments-grid';
import { TFunction } from 'i18next';
import SingleAvatar from '@/components/common/single-avatar/single-avatar';

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

// Helper function to process mentions in content
const processMentions = (content: string) => {
  if (!content) return '';

  // Check if content already contains mentions spans
  if (hasProcessedMentions(content)) {
    return content; // Already processed, return as is
  }

  // Replace @mentions with styled spans
  return content.replace(/@(\w+)/g, '<span class="mentions">@$1</span>');
};

const TaskComments = ({ taskId, t }: { taskId?: string, t: TFunction }) => {
  const [loading, setLoading] = useState(true);
  const [comments, setComments] = useState<ITaskCommentViewModel[]>([]);
  const commentsViewRef = useRef<HTMLDivElement>(null);
  const auth = useAuthService();
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const currentUserId = auth.getCurrentSession()?.id;

  const getComments = useCallback(
    async (showLoading = true) => {
      if (!taskId) return;

      try {
        if (showLoading) {
          setLoading(true);
        }

        const res = await taskCommentsApiService.getByTaskId(taskId);
        if (res.done) {
          // Sort comments by date (oldest first)
          const sortedComments = [...res.body].sort((a, b) => {
            return dayjs(a.created_at).isBefore(dayjs(b.created_at)) ? -1 : 1;
          });

          // Process mentions in content
          sortedComments.forEach(comment => {
            if (comment.content && !hasProcessedMentions(comment.content)) {
              comment.content = processMentions(comment.content);
            }
          });

          setComments(sortedComments);
        }

        setLoading(false);
      } catch (e) {
        logger.error('Error fetching comments', e);
        setLoading(false);
      }
    },
    [taskId]
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

  const canDelete = (userId?: string) => {
    if (!userId) return false;
    return userId === currentUserId;
  };

  const alreadyLiked = (item: ITaskCommentViewModel) => {
    const teamMemberId = auth.getCurrentSession()?.team_member_id;
    if (!teamMemberId) return false;
    return !!item.reactions?.likes?.liked_member_ids?.includes(teamMemberId);
  };

  const likeComment = async (item: ITaskCommentViewModel) => {
    if (!item.id || !taskId) return;

    try {
      const res = await taskCommentsApiService.updateReaction(item.id, {
        reaction_type: 'like',
        task_id: taskId,
      });
      if (res.done) {
        getComments(false);

        // Dispatch event to notify that a comment reaction was updated
        // Use update event instead of create to avoid scrolling
        document.dispatchEvent(new Event('task-comment-update'));
      }
    } catch (e) {
      logger.error('Error liking comment', e);
    }
  };

  const deleteComment = async (id?: string) => {
    if (!taskId || !id) return;

    try {
      const res = await taskCommentsApiService.delete(id, taskId);
      if (res.done) {
        await getComments(false);
        document.dispatchEvent(new Event('task-comment-update'));
      }
    } catch (e) {
      logger.error('Error deleting comment', e);
    }
  };

  const editComment = (item: ITaskCommentViewModel) => {
    item.edit = true;
    setComments([...comments]); // Force re-render
  };

  const commentUpdated = (comment: ITaskCommentViewModel) => {
    comment.edit = false;
    // Process mentions in updated content
    if (comment.content && !hasProcessedMentions(comment.content)) {
      comment.content = processMentions(comment.content);
    }
    setComments([...comments]); // Force re-render
  };

  const deleteAttachment = async (attachmentId: string) => {
    if (!attachmentId || !taskId) return;

    try {
      const res = await taskCommentsApiService.deleteAttachment(attachmentId, taskId);
      if (res.done) {
        await getComments(false);

        // Dispatch event to notify that an attachment was deleted
        document.dispatchEvent(new Event('task-comment-update'));
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

  const actionStyle = {
    color: themeWiseColor(colors.lightGray, colors.deepLightGray, themeMode),
  };

  // Render time separator between comments from different days
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

  // Check if the comment is from the current user
  const isCurrentUser = (userId?: string) => {
    return userId === currentUserId;
  };

  return (
    <div className={`task-view-comments theme-${themeMode}`} ref={commentsViewRef}>
      <Skeleton loading={loading}>
        {comments.length > 0 ? (
          <>
            {comments.map((item, index) => {
              const isUserComment = isCurrentUser(item.user_id);

              return (
                <div key={item.id}>
                  {/* Add time separator if this is the first comment or if it's from a different day than the previous comment */}
                  {(index === 0 ||
                    (index > 0 &&
                      isDifferentDay(
                        item.created_at || '',
                        comments[index - 1].created_at || ''
                      ))) &&
                    renderTimeSeparator(item.created_at || '')}

                  <Comment
                    key={item.id}
                    author={<span style={authorStyle}>{item.member_name}</span>}
                    datetime={<span style={dateStyle}>{fromNow(item.created_at || '')}</span>}
                    avatar={
                      <SingleAvatar name={item.member_name} avatarUrl={item.avatar_url}/>
                    }
                    content={
                      item.edit ? (
                        <TaskViewCommentEdit commentData={item} onUpdated={commentUpdated} />
                      ) : (
                        <>
                          <p
                            className={`comment-content-${themeMode}`}
                            dangerouslySetInnerHTML={{ __html: item.content || '' }}
                          />
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
                      )
                    }
                    actions={[
                      <span key="like" onClick={() => likeComment(item)}>
                        <Tooltip
                          title={
                            item?.reactions?.likes?.count
                              ? item.reactions?.likes?.liked_members?.map(member => (
                                  <div key={member}>{member}</div>
                                ))
                              : null
                          }
                        >
                          {alreadyLiked(item) ? (
                            <LikeTwoTone />
                          ) : (
                            <LikeOutlined style={actionStyle} />
                          )}{' '}
                          &nbsp;
                          <span className="count like" style={actionStyle}>
                            {item?.reactions?.likes?.count || ''}
                          </span>
                        </Tooltip>
                      </span>,
                      //   canDelete(item.user_id) && (
                      //     <span
                      //       key="edit"
                      //       onClick={() => editComment(item)}
                      //       style={actionStyle}
                      //     >
                      //       <EditOutlined />
                      //       <span style={{ marginLeft: 4 }}>Edit</span>
                      //     </span>
                      //   ),
                      canDelete(item.user_id) && (
                        <Popconfirm
                          key="delete"
                          title={t('taskInfoTab.comments.confirmDeleteComment')}
                          onConfirm={() => deleteComment(item.id)}
                        >
                          <span style={actionStyle}>{t('taskInfoTab.comments.delete')}</span>
                        </Popconfirm>
                      ),
                    ].filter(Boolean)}
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
