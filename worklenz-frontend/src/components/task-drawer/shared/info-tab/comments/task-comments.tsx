import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Skeleton,
  Tooltip,
  Popconfirm,
  Button,
  Space,
  Popover,
} from '@/shared/antd-imports';
import { EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { Comment } from '@ant-design/compatible';
import dayjs from 'dayjs';

import { ITaskComment, ITaskCommentViewModel, ReactionType } from '@/types/tasks/task-comments.types';
import taskCommentsApiService from '@/api/tasks/task-comments.api.service';
import { useAuthService } from '@/hooks/useAuth';
import { fromNow } from '@/utils/dateUtils';
import logger from '@/utils/errorLogger';
import './task-comments.css';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { setTargetCommentId } from '@/features/task-drawer/task-drawer.slice';

import { updateTaskCounts } from '@/features/task-management/task-management.slice';
import { themeWiseColor } from '@/utils/themeWiseColor';
import { colors } from '@/styles/colors';
import AttachmentsGrid from '../attachments/attachments-grid';
import { TFunction } from 'i18next';
import SingleAvatar from '@/components/common/single-avatar/single-avatar';
import { sanitizeCommentContent, stripHtmlTags } from '@/utils/sanitizeInput';
import { REACTION_CONFIGS } from '@/shared/reaction-config';
import { toggleUpgradeModal } from '@/features/admin-center/admin-center.slice';
import { hasBusinessFeatureAccess } from '@/ee/utils/subscription-utils';
import { teamMembersApiService } from '@/api/team-members/teamMembers.api.service';
import { ITeamMember } from '@/types/teamMembers/teamMember.types';
import CustomMentionsInput, { MentionOption } from './custom-mentions-input';
import '../info-tab-footer.css';
import { useAppSumoTracking } from '@/ee/hooks/useAppSumoTracking';
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

// Enhanced mention processing function — only highlights known mention names.
// Without knownNames we cannot safely identify mentions, so we skip highlighting
// to avoid false positives on arbitrary @-prefixed text.
const processMentions = (content: string, knownNames?: string[]) => {
  if (!content) return '';
  if (hasProcessedMentions(content)) return content;

  if (knownNames && knownNames.length > 0) {
    let result = content;
    for (const name of knownNames) {
      const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      // Match @name only when followed by whitespace, punctuation, or end-of-string
      // \b alone isn't enough — we need to exclude word chars after the name
      const regex = new RegExp(`@${escaped}(?=\\s|[.,;:!?)]|$)`, 'g');
      result = result.replace(
        regex,
        `<span class="mentions">@${name}</span>`
      );
    }
    return result;
  }

  return content;
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
// knownNames: list of mention names from the comment's mentions array
const processContent = (content: string, knownNames?: string[]) => {
  if (!content) return '';

  let processed = sanitizeCommentContent(content);

  if (!hasProcessedMentions(processed)) {
    processed = processMentions(processed, knownNames);
  }

  processed = linkifyUrls(processed);

  return processed;
};

/**
 * Strips all HTML markup from stored comment content so the textarea shows
 * plain text ready for re-editing.
 * Handles both tight format <span class="mentions">@Name</span>
 * and the backend's space-padded format <span class="mentions"> @Name </span>.
 */
const prepareContentForEditing = (content: string): string => {
  if (!content) return '';

  // The backend stores: `hello <span class="mentions"> @Name </span> world`
  // That produces "hello  @Name   world" if we just strip tags (double spaces).
  // Strategy:
  //   1. Replace the span (including any surrounding whitespace that is part of
  //      the span's padding) with a single "@Name" token.
  //   2. Collapse any double-spaces that result from the span's internal padding
  //      merging with the surrounding text spaces.
  const withoutMentionSpans = content.replace(
    /\s*<span class="mentions">\s*@([\w]+(?:\s+[\w]+)*)\s*<\/span>\s*/g,
    ' @$1 '
  );

  const withRawUrls = withoutMentionSpans.replace(/<a[^>]*href="([^"]*)"[^>]*>[^<]*<\/a>/gi, '$1');

  // Strip any remaining HTML tags, then trim leading/trailing whitespace
  return stripHtmlTags(withRawUrls);
};

const TaskComments = ({ taskId, t, isGuest = false }: { taskId?: string; t: TFunction; isGuest?: boolean }) => {
  const [loading, setLoading] = useState(true);
  const [comments, setComments] = useState<ITaskCommentViewModel[]>([]);
  const commentsViewRef = useRef<HTMLDivElement>(null);
  const auth = useAuthService();
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const currentSession = auth.getCurrentSession();
  const currentUserId = currentSession?.id;
  const teamMemberId = currentSession?.team_member_id;
  const hasBusinessAccess = hasBusinessFeatureAccess(currentSession);
  const { trackAppSumoEvent } = useAppSumoTracking();
  const isAppSumoUser = String(currentSession?.subscription_type || '').toLowerCase().includes('appsumo');
  const { targetCommentId } = useAppSelector(state => state.taskDrawerReducer);
  const dispatch = useAppDispatch();
  const [highlightedCommentId, setHighlightedCommentId] = useState<string | null>(null);


  // Inline-edit state
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editLoading, setEditLoading] = useState(false);
  const [editSelectedMembers, setEditSelectedMembers] = useState<{ team_member_id: string; name: string }[]>([]);

  // Members for mention dropdown (shared with edit input)
  const [members, setMembers] = useState<ITeamMember[]>([]);
  const { projectId } = useAppSelector(state => state.projectReducer);

  const mentionOptions: MentionOption[] = useMemo(
    () => members.map(m => ({ key: m.id!, value: m.name!, label: m.name! })),
    [members]
  );

  useEffect(() => {
    if (!projectId) return;
    teamMembersApiService
      .get(1, 10, null, null, null, true)
      .then(res => {
        if (res.done) {
          setMembers((res.body.data ?? []).filter(m => !m.pending_invitation) as ITeamMember[]);
        }
      })
      .catch(e => logger.error('Failed to fetch members for edit mentions', e));
  }, [projectId]);

  const getComments = useCallback(
    async (showLoading = true) => {
      if (!taskId) return;

      try {
        if (showLoading) {
          setLoading(true);
        }

        const res = await taskCommentsApiService.getByTaskId(taskId);
        if (res.done) {
          // Some comments can come back as multiple rows sharing the same id
          // (e.g. if a backend join fans out per-attachment). Merge by id so
          // React never sees two elements with the same key.
          const byId = new Map<string, ITaskCommentViewModel>();
          for (const row of res.body) {
            const existing = byId.get(row.id!);
            if (!existing) {
              byId.set(row.id!, { ...row, attachments: row.attachments ? [...row.attachments] : [] });
            } else if (row.attachments?.length) {
              const existingIds = new Set(existing.attachments?.map(a => a.id));
              for (const att of row.attachments) {
                if (!existingIds.has(att.id)) existing.attachments!.push(att);
              }
            }
          }

          const sortedComments = Array.from(byId.values()).sort((a, b) => {
            return dayjs(a.created_at).isBefore(dayjs(b.created_at)) ? -1 : 1;
          });

          // Process content for display but preserve task_id from response
          sortedComments.forEach(comment => {
            if (comment.content) {
              // Primary: use the mentions array from backend
              let knownNames: string[] | undefined = (comment as any).mentions
                ?.map((m: any) => m.user_name || m.name)
                .filter(Boolean) as string[] | undefined;

              // Fallback: if mentions array is missing/empty, extract @names
              // directly from raw content to handle the post-edit case where
              // the backend may not return the mentions array populated
              if (!knownNames || knownNames.length === 0) {
                const extracted = Array.from(
                  comment.content.matchAll(/@(\w+)/g),
                  m => m[1]
                );
                if (extracted.length > 0) {
                  knownNames = extracted;
                }
              }

              comment.content = processContent(comment.content, knownNames);
            }
            if (!comment.task_id) {
              comment.task_id = taskId;
            }
          });

          setComments(sortedComments);

          dispatch(
            updateTaskCounts({
              taskId,
              counts: {
                // Don't count soft-deleted comments
                comments_count: sortedComments.filter(c => !c.is_deleted).length,
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

  // Scroll to and highlight the target comment from a notification click.
  // Uses a polling approach so it works regardless of when comments finish rendering.
  useEffect(() => {
    if (!targetCommentId) return;
    if (loading) return;


    let attempts = 0;
    const maxAttempts = 20;
    let rafId: number;
    let timerId: ReturnType<typeof setTimeout>;

    const tryScroll = () => {
      attempts++;
      const el = document.getElementById(`comment-${targetCommentId}`);

      if (el) {
        const scrollContainer = el.closest('.ant-drawer-body') as HTMLElement | null;
        if (scrollContainer) {
          const offset = el.offsetTop - scrollContainer.clientHeight / 2 + el.clientHeight / 2;
          scrollContainer.scrollTo({ top: offset, behavior: 'smooth' });
        } else {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        setHighlightedCommentId(targetCommentId);

        timerId = setTimeout(() => {
          setHighlightedCommentId(null);
          dispatch(setTargetCommentId(null));
        }, 2500);
        return;
      }

      if (attempts < maxAttempts) {
        timerId = setTimeout(() => {
          rafId = requestAnimationFrame(tryScroll);
        }, 100);
      } else {
        // Comment truly isn't there (deleted, or comments list came back empty) — clear silently
        dispatch(setTargetCommentId(null));
      }
    };

    timerId = setTimeout(() => {
      rafId = requestAnimationFrame(tryScroll);
    }, 300);

    return () => {
      clearTimeout(timerId);
      cancelAnimationFrame(rafId);
    };
  }, [targetCommentId, loading, dispatch]);


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
    setEditSelectedMembers([]);
  };

  const cancelEdit = () => {
    setEditingCommentId(null);
    setEditContent('');
    setEditSelectedMembers([]);
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

      // Deduplicate mentions by team_member_id
      const uniqueMentions = Array.from(
        new Map(editSelectedMembers.map(m => [m.team_member_id, m])).values()
      );

      const res = await taskCommentsApiService.update(item.id, {
        task_id: resolvedTaskId,
        content: editContent,
        mentions: uniqueMentions,
      } as ITaskComment);

      if (res.done) {
        setEditingCommentId(null);
        setEditContent('');
        setEditSelectedMembers([]);
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

  // WhatsApp-style: only the last non-deleted comment sent by the current user is editable
  const lastOwnCommentId = useMemo(() => {
    for (let i = visibleComments.length - 1; i >= 0; i--) {
      const c = visibleComments[i];
      if (c.user_id === currentUserId && !c.is_deleted) {
        return c.id;
      }
    }
    return null;
  }, [visibleComments, currentUserId]);
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
                          dispatch(toggleUpgradeModal());
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
              const isDeleted = item.is_deleted === true;

              return (
                <div
                  key={item.id}
                  id={`comment-${item.id}`}
                  style={
                    highlightedCommentId === item.id
                      ? {
                        borderRadius: 6,
                        transition: 'background-color 0.4s ease',
                        backgroundColor: themeMode === 'dark'
                          ? 'rgba(24, 144, 255, 0.18)'
                          : 'rgba(24, 144, 255, 0.12)',
                        outline: themeMode === 'dark'
                          ? '1.5px solid rgba(24, 144, 255, 0.45)'
                          : '1.5px solid rgba(24, 144, 255, 0.35)',
                      }
                      : { transition: 'background-color 0.4s ease', outline: '1.5px solid transparent' }

                  }
                >
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
                        {/* ── Hover action bar — hidden for deleted comments ── */}
                        {!isEditing && !isDeleted && (
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
                                {/* WhatsApp-style: edit only available on the last own comment */}
                                {item.id === lastOwnCommentId && (
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
                                )}
                                <Popconfirm
                                  title={t('taskInfoTab.comments.confirmDeleteComment', {
                                    defaultValue: 'Delete this comment?',
                                  })}
                                  onConfirm={() => deleteComment(item.id)}
                                  okText={t('common.yes', { defaultValue: 'Yes' })}
                                  cancelText={t('common.no', { defaultValue: 'No' })}
                                  placement="topRight"
                                >
                                  <Tooltip
                                    title={t('taskInfoTab.comments.delete', {
                                      defaultValue: 'Delete',
                                    })}
                                  >
                                    <Button
                                      type="text"
                                      size="small"
                                      icon={<DeleteOutlined />}
                                      className="hover-action-btn"
                                      danger
                                    />
                                  </Tooltip>
                                </Popconfirm>
                              </>
                            )}
                          </div>
                        )}

                        {/* ── Comment body ───────────────────────────────── */}
                        <div className={`comment-content-${themeMode}`}>
                          {isDeleted ? (
                            <p
                              style={{
                                fontStyle: 'italic',
                                color: themeWiseColor(colors.lightGray, colors.deepLightGray, themeMode),
                                margin: 0,
                              }}
                            >
                              {t('taskInfoTab.comments.messageDeleted', {
                                defaultValue: 'This message was deleted',
                              })}
                            </p>
                          ) : isEditing ? (
                            <div>
                              <div style={{ position: 'relative' }}>
                                <CustomMentionsInput
                                  value={editContent}
                                  onChange={(val: string) => setEditContent(val)}
                                  onSelect={(option: MentionOption) => {
                                    const member = members.find(m => m.id === option.key);
                                    if (!member) return;
                                    setEditSelectedMembers(prev =>
                                      prev.some(p => p.team_member_id === member.id)
                                        ? prev
                                        : [...prev, { team_member_id: member.id!, name: member.name! }]
                                    );
                                  }}
                                  options={mentionOptions}
                                  themeMode={themeMode}
                                  autoFocus
                                  placeholder={t('taskInfoTab.comments.addCommentPlaceholder', {
                                    defaultValue: 'Add a comment...',
                                  })}
                                  filterOption={(input: string, option: MentionOption) => {
                                    if (!input) return true;
                                    return option.label.toLowerCase().includes(input.toLowerCase());
                                  }}
                                  style={{ minHeight: 60, maxHeight: 150, borderRadius: 4 }}
                                />
                              </div>
                              <Space style={{ marginTop: 8 }}>
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
                                    handleFilesSelected={() => { }}
                                    isCommentAttachment={true}
                                    isGuest={isGuest}
                                  />
                                </div>
                              )}
                            </>
                          )}

                          {/* ── Existing reaction badges ─────────────────── */}
                          {existingReactions.length > 0 && !isEditing && !isDeleted && (
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
