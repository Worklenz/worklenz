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
  message,
  Popover,
  Typography,
} from '@/shared/antd-imports';
import {
  EditOutlined,
  DeleteOutlined,
  PaperClipOutlined,
  RollbackOutlined,
  CheckSquareOutlined,
  PushpinOutlined,
  PushpinFilled,
  CloseOutlined,
} from '@ant-design/icons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { useTranslation } from 'react-i18next';

import { useAppDispatch, useAppSelector } from '@/app/store';
import { useSocket } from '@/socket/socketContext';
import { SocketEvents } from '@/shared/socket-events';
import {
  getProjectComments,
  createProjectComment,
  deleteProjectComment,
  addReactionToComment,
  updateCommentAfterEdit,
  markCommentDeleted,
  updateCommentPinState,
} from '@/features/projects/singleProject/updates/updatesSlice';
import {
  setSelectedTaskId,
  setShowTaskDrawer,
  fetchTask,
} from '@/features/task-drawer/task-drawer.slice';
import { setProjectId } from '@/features/project/project.slice';
import { IProjectUpdateCommentViewModel } from '@/types/project/project.types';
import { toggleUpgradeModal } from '@/features/admin-center/admin-center.slice';
import { useAppSumoTracking } from '@/ee/hooks/useAppSumoTracking';
import { AppSumoUpsellEvents } from '@/types/mixpanel-events.types';
import { getAllProjectMembers } from '@/features/projects/singleProject/members/projectMembersSlice';
import { projectCommentsApiService } from '@/api/projects/comments/project-comments.api.service';
import { useAuthService } from '@/hooks/useAuth';
import SingleAvatar from '@/components/common/single-avatar/single-avatar';
import { hasBusinessFeatureAccess } from '@/ee/utils/subscription-utils';
import CustomMentionsInput from './CustomMentionsInput';
import { formatDateForSeparator, isDifferentDay } from '@/utils/chatDateFormat';
import { themeWiseColor } from '@utils/themeWiseColor';
import '@/styles/chat-thread.css';
import './project-view-updates.css';

dayjs.extend(relativeTime);

const { useToken } = theme;

const REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏', '🎉', '🔥'];

const escapeHtml = (text: string) => {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
};

// Wrap bare http(s) URLs that appear as plain text in anchors so they render as
// clickable links. Walks text nodes only, leaving existing <a> tags and mention
// spans untouched.
const autoLinkUrls = (html: string) => {
  if (!html || !/https?:\/\//i.test(html)) return html;
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
  const targets: Text[] = [];
  let node: Node | null;
  while ((node = walker.nextNode())) {
    if ((node.parentElement as HTMLElement)?.closest('a')) continue;
    if (/https?:\/\//i.test(node.nodeValue || '')) targets.push(node as Text);
  }
  targets.forEach(textNode => {
    const text = textNode.nodeValue || '';
    const frag = doc.createDocumentFragment();
    const re = /https?:\/\/[^\s<>"]+/gi;
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = re.exec(text))) {
      const url = match[0].replace(/[.,;:!?)]+$/, '');
      if (match.index > lastIndex) {
        frag.appendChild(doc.createTextNode(text.slice(lastIndex, match.index)));
      }
      const a = doc.createElement('a');
      a.setAttribute('href', url);
      a.setAttribute('target', '_blank');
      a.setAttribute('rel', 'noopener noreferrer');
      a.textContent = url;
      frag.appendChild(a);
      lastIndex = match.index + url.length;
    }
    if (lastIndex < text.length) frag.appendChild(doc.createTextNode(text.slice(lastIndex)));
    textNode.parentNode?.replaceChild(frag, textNode);
  });
  return doc.body.innerHTML;
};

interface ProjectViewUpdatesProps {
  // Overrides the route param - lets this feed be embedded outside the
  // project page (e.g. the Home > Inbox "Projects" tab).
  projectId?: string;
  // Fills the parent container instead of sizing against the viewport.
  fullHeight?: boolean;
}

const ProjectViewUpdates = ({ projectId: projectIdProp, fullHeight }: ProjectViewUpdatesProps = {}) => {
  const { projectId: routeProjectId } = useParams<{ projectId: string }>();
  const projectId = projectIdProp || routeProjectId;
  const dispatch = useAppDispatch();
  const { socket } = useSocket();
  const [form] = Form.useForm();
  const { t } = useTranslation('project-view-updates');
  const { token } = useToken();
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const authService = useAuthService();
  const currentSession = useMemo(() => authService.getCurrentSession(), [authService]);
  const hasBusinessAccess = hasBusinessFeatureAccess(currentSession);
  const { trackAppSumoEvent } = useAppSumoTracking();
  const isAppSumoUser = String(currentSession?.subscription_type || '').toLowerCase().includes('appsumo');

  const listRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const [replyTo, setReplyTo] = useState<IProjectUpdateCommentViewModel | null>(null);
  const [pendingAttachment, setPendingAttachment] = useState<{
    name: string;
    url: string;
    key: string;
    type?: string;
    size?: number;
  } | null>(null);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);

  // Plain-text version of a comment (mentions substituted, tags stripped) —
  // used for reply snippets and convert-to-task titles.
  const toPlainText = useCallback((item: IProjectUpdateCommentViewModel) => {
    const div = document.createElement('div');
    div.innerHTML = (item.content || '').replace(/<br\s*\/?>/gi, ' ');
    let text = div.textContent || div.innerText || '';
    (item.mentions || []).forEach((mention: any, index: number) => {
      const name = mention?.user_name || mention?.name;
      if (!name) return;
      text = text.replace(new RegExp(`\\{${index}\\}`, 'g'), `@${name}`);
    });
    return text.replace(/\s+/g, ' ').trim();
  }, []);

  useEffect(() => {
    if (projectId) {
      dispatch(getProjectComments(projectId));
      dispatch(getAllProjectMembers(projectId));
      // Opening the conversation clears its unread badge (Inbox + project tab)
      projectCommentsApiService.markConversationRead(projectId).catch(() => {});
    }
  }, [projectId, dispatch]);

  useEffect(() => {
    if (!socket || !projectId) return;

    const handleNewComment = (payload: any) => {
      if (!payload) return;
      // Enriched payloads carry the project id — skip other projects' events
      if (typeof payload === 'object' && payload.project_id && payload.project_id !== projectId) {
        return;
      }
      dispatch(getProjectComments(projectId));
      if (document.visibilityState === 'visible') {
        projectCommentsApiService.markConversationRead(projectId).catch(() => {});
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

    const handleCommentDeleted = (data: any) => {
      if (data?.project_id && data.project_id !== projectId) return;
      if (data?.comment_id) dispatch(markCommentDeleted(data.comment_id));
    };

    const handlePinChanged = (data: any) => {
      if (data?.project_id && data.project_id !== projectId) return;
      if (data?.comment_id) dispatch(updateCommentPinState(data));
    };

    const eventName = SocketEvents.NEW_PROJECT_COMMENT_RECEIVED.toString();
    socket.on(eventName, handleNewComment);
    socket.on(SocketEvents.PROJECT_COMMENT_REACTION_ADDED.toString(), handleReactionAdded);
    socket.on(SocketEvents.PROJECT_COMMENT_REACTION_REMOVED.toString(), handleReactionRemoved);
    socket.on(SocketEvents.PROJECT_COMMENT_EDITED.toString(), handleCommentEdited);
    socket.on(SocketEvents.PROJECT_COMMENT_DELETED.toString(), handleCommentDeleted);
    socket.on(SocketEvents.PROJECT_COMMENT_PIN_CHANGED.toString(), handlePinChanged);

    return () => {
      socket.off(eventName, handleNewComment);
      socket.off(SocketEvents.PROJECT_COMMENT_REACTION_ADDED.toString(), handleReactionAdded);
      socket.off(SocketEvents.PROJECT_COMMENT_REACTION_REMOVED.toString(), handleReactionRemoved);
      socket.off(SocketEvents.PROJECT_COMMENT_EDITED.toString(), handleCommentEdited);
      socket.off(SocketEvents.PROJECT_COMMENT_DELETED.toString(), handleCommentDeleted);
      socket.off(SocketEvents.PROJECT_COMMENT_PIN_CHANGED.toString(), handlePinChanged);
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

  const handleAttachmentSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !projectId) return;

    setUploadingAttachment(true);
    try {
      const dataUrl: string = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = ev => resolve(ev.target?.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const res = await projectCommentsApiService.uploadCommentAttachment(
        projectId,
        dataUrl,
        file.name,
        file.type
      );
      if (res.done && res.body) {
        setPendingAttachment(res.body);
      } else {
        message.error(res.message || t('attachmentUploadError', { defaultValue: 'Failed to upload attachment' }));
      }
    } catch (error) {
      message.error(t('attachmentUploadError', { defaultValue: 'Failed to upload attachment' }));
    } finally {
      setUploadingAttachment(false);
    }
  };

  const isSubmittingRef = useRef(false);

  const onFinish = async () => {
    if (!projectId || (!commentValue?.trim() && !pendingAttachment)) return;
    if (isSubmittingRef.current) return; // ← prevents double fire
    isSubmittingRef.current = true;


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
          content: commentValue.trim() || (pendingAttachment ? `Shared file: ${pendingAttachment.name}` : ''),
          mentions: mentionsWithValidUUIDs,
          reply_to_id: replyTo?.id,
          reply_to_preview: replyTo
            ? {
                id: replyTo.id,
                author_name: replyTo.created_by,
                content_snippet: toPlainText(replyTo).slice(0, 150),
                is_deleted: false,
              }
            : undefined,
          attachments: pendingAttachment ? [pendingAttachment] : [],
        })
      ).unwrap();

      setCommentValue('');
      setSelectedMembers([]);
      setReplyTo(null);
      setPendingAttachment(null);

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
      isSubmittingRef.current = false;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      if (commentValue?.trim() && !submitting) {
        onFinish();
      }
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

  const handlePinToggle = async (item: IProjectUpdateCommentViewModel) => {
    if (!item.id || !projectId) return;
    try {
      const res = await projectCommentsApiService.setPinned(item.id, projectId, !item.pinned_at);
      if (res.done && res.body) {
        dispatch(updateCommentPinState(res.body));
      }
    } catch (error) {
      message.error(t('pinError', { defaultValue: 'Failed to update pin' }));
    }
  };

  const handleConvertToTask = (item: IProjectUpdateCommentViewModel) => {
    if (!socket || !projectId) return;
    const plain = toPlainText(item);
    // tasks.name is capped at 500 chars in the DB
    const name = plain.length > 500 ? `${plain.slice(0, 499)}…` : plain;
    if (!name) {
      message.warning(t('convertToTaskEmpty', { defaultValue: 'Message has no text to use as a task name' }));
      return;
    }

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
          message.error(
            task?.message || t('convertToTaskError', { defaultValue: 'Failed to create task' })
          );
          return;
        }
        dispatch(setSelectedTaskId(task.id));
        dispatch(fetchTask({ taskId: task.id, projectId: task.project_id || projectId }));
        dispatch(setProjectId(task.project_id || projectId));
        dispatch(setShowTaskDrawer(true));
        message.success(t('convertToTaskSuccess', { defaultValue: 'Task created from message' }));
      }
    );
  };

  const handleEdit = async (commentId: string, originalContent: string) => {
    if (!editContent.trim()) return;
    if (editContent.trim() === originalContent.trim()) {
      setEditingCommentId(null);
      return;
    }

    try {
      let contentToSave = editContent;

      editSelectedMembers.forEach((member, index) => {
        contentToSave = contentToSave.replace(`@${member.name}`, `{${index}}`);
      });

      const response = await projectCommentsApiService.editComment(commentId, contentToSave);

      // Optimistically update the UI immediately
      if (response.done && response.body) {
        dispatch(updateCommentAfterEdit({
          comment_id: commentId,
          content: contentToSave,
          edited: true,
          edit_count: response.body.edit_count || 1,
          last_edited_at: response.body.last_edited_at || new Date().toISOString(),
          last_edited_by_name: response.body.last_edited_by_name || user?.name || 'You',
        }));
      }

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
    // Strip any HTML tags from content before editing
    const stripHtml = (html: string) => {
      const div = document.createElement('div');
      div.innerHTML = html;
      return div.textContent || div.innerText || '';
    };

    let editableContent = stripHtml(content);

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
    return <div dangerouslySetInnerHTML={{ __html: autoLinkUrls(processedContent) }} />;
  };

  const renderTimeSeparator = (date: string) => (
    <div className="comment-time-separator">
      <span
        style={{
          backgroundColor: token.colorBgContainer,
          color: token.colorTextSecondary,
        }}
      >
        {formatDateForSeparator(date, t)}
      </span>
    </div>
  );

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
      style={{ height: fullHeight ? '100%' : 'calc(100vh - 260px)' }}
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
                            dispatch(toggleUpgradeModal());
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
                  <div
                    key={item.id || index}
                    className={`chat-msg-row ${isUserComment ? 'mine' : 'theirs'} ${isGrouped ? 'grouped' : ''}`}
                  >
                    {showTimeSeparator && renderTimeSeparator(item.created_at || '')}

                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'flex-end',
                        gap: 8,
                        justifyContent: isUserComment ? 'flex-end' : 'flex-start',
                      }}
                    >
                      {!isUserComment && (
                        <div style={{ width: 28, flexShrink: 0 }}>
                          {!isGrouped && (
                            <SingleAvatar name={item.created_by} avatarUrl={item.avatar_url} size={28} />
                          )}
                        </div>
                      )}

                      <div className="chat-msg-wrapper" style={{ maxWidth: '60%' }}>
                        <div
                          className="chat-msg-toolbar"
                          style={{
                            display:
                              editingCommentId === item.id || item.is_deleted ? 'none' : 'flex',
                          }}
                        >
                          <div className="chat-msg-actions">
                            {REACTIONS.map(emoji => (
                              <button
                                key={emoji}
                                className="quick-emoji"
                                title={emoji}
                                onClick={() => handleReaction(item.id!, emoji)}
                              >
                                {emoji}
                              </button>
                            ))}
                            <div className="hover-divider" />
                            <Tooltip title={t('actions.reply', { defaultValue: 'Reply' })}>
                              <button
                                className="hover-icon-btn"
                                onClick={() => setReplyTo(item)}
                              >
                                <RollbackOutlined style={{ fontSize: 14 }} />
                              </button>
                            </Tooltip>
                            <Tooltip
                              title={t('actions.convertToTask', { defaultValue: 'Convert to task' })}
                            >
                              <button
                                className="hover-icon-btn"
                                onClick={() => handleConvertToTask(item)}
                              >
                                <CheckSquareOutlined style={{ fontSize: 14 }} />
                              </button>
                            </Tooltip>
                            <Tooltip
                              title={
                                item.pinned_at
                                  ? t('actions.unpin', { defaultValue: 'Unpin message' })
                                  : t('actions.pin', { defaultValue: 'Pin message' })
                              }
                            >
                              <button
                                className="hover-icon-btn"
                                onClick={() => handlePinToggle(item)}
                              >
                                {item.pinned_at ? (
                                  <PushpinFilled style={{ fontSize: 14, color: '#1677ff' }} />
                                ) : (
                                  <PushpinOutlined style={{ fontSize: 14 }} />
                                )}
                              </button>
                            </Tooltip>
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
                                <Popconfirm
                                  title={t('deleteConfirmTitle', { defaultValue: 'Delete this update?' })}
                                  description={t('deleteConfirmContent', {
                                    defaultValue:
                                      'Are you sure you want to delete this update? This action cannot be undone.',
                                  })}
                                  okText={t('yes', { defaultValue: 'Yes' })}
                                  cancelText={t('no', { defaultValue: 'No' })}
                                  onConfirm={() => handleDelete(item.id!)}
                                >
                                  <Tooltip title={t('deleteButton', { defaultValue: 'Delete' })}>
                                    <Button
                                      type="text"
                                      size="small"
                                      danger
                                      icon={<DeleteOutlined />}
                                      className="hover-action-btn"
                                    />
                                  </Tooltip>
                                </Popconfirm>
                              </>
                            )}
                          </div>
                        </div>

                        {!isGrouped && !isUserComment && (
                          <div className="chat-msg-author">{item.created_by}</div>
                        )}

                        {item.is_deleted ? (
                          <div
                            className={`chat-msg-bubble ${isUserComment ? 'mine' : 'theirs'} deleted`}
                          >
                            <span style={{ fontStyle: 'italic', opacity: 0.65 }}>
                              {t('messageDeleted', { defaultValue: 'This message was deleted' })}
                            </span>
                          </div>
                        ) : editingCommentId === item.id ? (
                          <div>
                            <Input.TextArea
                              value={editContent}
                              onChange={e => setEditContent(e.target.value)}
                              autoSize={{ minRows: 2, maxRows: 6 }}
                              style={{ marginBottom: 8 }}
                            />
                            <Space>
                              <Button
                                size="small"
                                type="primary"
                                onClick={() => handleEdit(item.id!, item.content || '')}
                              >
                                {t('actions.save', { defaultValue: 'Save' })}
                              </Button>
                              <Button size="small" onClick={() => setEditingCommentId(null)}>
                                {t('cancelButton', { defaultValue: 'Cancel' })}
                              </Button>
                            </Space>
                          </div>
                        ) : (
                          <div className={`chat-msg-bubble ${isUserComment ? 'mine' : 'theirs'}`}>
                            {item.pinned_at && (
                              <div className="chat-msg-pin-indicator">
                                <PushpinFilled style={{ fontSize: 11 }} />
                                <span>
                                  {item.pinned_by_name
                                    ? `${t('pinnedBy', { defaultValue: 'Pinned by' })} ${item.pinned_by_name}`
                                    : t('pinned', { defaultValue: 'Pinned' })}
                                </span>
                              </div>
                            )}
                            {item.reply_to && (
                              <div className="chat-msg-reply-quote">
                                <span className="chat-msg-reply-author">
                                  {item.reply_to.is_deleted
                                    ? ''
                                    : item.reply_to.author_name || ''}
                                </span>
                                <span className="chat-msg-reply-snippet">
                                  {item.reply_to.is_deleted ? (
                                    <em>{t('messageDeleted', { defaultValue: 'This message was deleted' })}</em>
                                  ) : (
                                    item.reply_to.content_snippet
                                  )}
                                </span>
                              </div>
                            )}
                            {renderCommentContent(item.content || '', item.mentions)}
                            {item.attachments?.map(attachment => (
                              <a
                                key={attachment.id || attachment.url}
                                href={attachment.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="chat-msg-attachment"
                              >
                                <PaperClipOutlined />
                                <span className="chat-msg-attachment-name">
                                  {attachment.name || 'Attachment'}
                                </span>
                              </a>
                            ))}
                            {item.edited && (
                              <Tooltip
                                title={`Edited ${dayjs(item.last_edited_at).fromNow()} by ${item.last_edited_by_name || 'Unknown'}`}
                              >
                                <span
                                  style={{
                                    fontSize: 11,
                                    marginLeft: 8,
                                    fontStyle: 'italic',
                                    opacity: 0.7,
                                  }}
                                >
                                  (edited)
                                </span>
                              </Tooltip>
                            )}
                          </div>
                        )}

                        {item.reactions && item.reactions.length > 0 && (
                          <div style={{ marginTop: 6, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            {item.reactions.map((reaction: any) => {
                              const hasReacted = reaction.users?.some(
                                (u: any) => u.user_id === user.id
                              );
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

                        <div className="chat-msg-time">{dayjs(item.created_at).format('HH:mm')}</div>
                      </div>

                      {isUserComment && (
                        <div style={{ width: 28, flexShrink: 0 }}>
                          {!isGrouped && (
                            <SingleAvatar name={item.created_by} avatarUrl={item.avatar_url} size={28} />
                          )}
                        </div>
                      )}
                    </div>
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
        {replyTo && (
          <div
            className="chat-reply-bar"
            style={{
              maxWidth: '900px',
              margin: '0 auto 6px',
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 10px',
              borderRadius: 8,
              background: token.colorFillTertiary,
              borderLeft: `3px solid ${token.colorPrimary}`,
            }}
          >
            <RollbackOutlined style={{ fontSize: 13, color: token.colorTextSecondary }} />
            <div style={{ flex: 1, minWidth: 0, fontSize: 12 }}>
              <div style={{ fontWeight: 600 }}>
                {t('replyingTo', { defaultValue: 'Replying to' })} {replyTo.created_by}
              </div>
              <div
                style={{
                  color: token.colorTextSecondary,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {toPlainText(replyTo).slice(0, 150)}
              </div>
            </div>
            <button
              onClick={() => setReplyTo(null)}
              style={{
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                color: token.colorTextSecondary,
                flexShrink: 0,
              }}
            >
              <CloseOutlined style={{ fontSize: 12 }} />
            </button>
          </div>
        )}
        {pendingAttachment && (
          <Flex
            align="center"
            gap={8}
            style={{
              maxWidth: '900px',
              margin: '0 auto 6px',
              width: '100%',
              padding: '6px 20px',
              borderRadius: 8,
              background: token.colorFillTertiary,
              fontSize: 12,
            }}
          >
            <PaperClipOutlined />
            <Typography.Text style={{ fontSize: 12, flex: 1 }} ellipsis>
              {pendingAttachment.name}
            </Typography.Text>
            <Button
              type="text"
              size="small"
              onClick={() => setPendingAttachment(null)}
              style={{ fontSize: 11, height: 20, padding: '0 4px' }}
            >
              ✕
            </Button>
          </Flex>
        )}
        <Flex
          align={commentValue.trim() ? 'flex-end' : 'center'}
          gap={10}
          style={{ maxWidth: '900px', margin: '0 auto', width: '100%' }}
        >
          <input
            ref={fileInputRef}
            type="file"
            style={{ display: 'none' }}
            onChange={handleAttachmentSelect}
            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
          />
          <Tooltip title={t('attachFile', { defaultValue: 'Attach a file' })}>
            <button
              className="chat-attach-btn"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingAttachment}
              style={{ flexShrink: 0 }}
            >
              <PaperClipOutlined style={{ fontSize: 18 }} />
            </button>
          </Tooltip>
          <div style={{ flex: 1, minWidth: 0 }}>
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
                width: '100%',
                minHeight: 40,
                maxHeight: 120,
                borderRadius: 20,
                padding: '8px 16px',
              }}
              themeMode={themeMode}
            />
          </div>
          <Button
            type="primary"
            shape="round"
            onClick={onFinish}
            loading={submitting}
            disabled={submitting || uploadingAttachment || !commentValue.trim()}
            className="send-button"
            style={{
              height: 40,
              paddingInline: 24,
              flexShrink: 0,
              fontWeight: 500,
              backgroundColor: (submitting || uploadingAttachment || !commentValue.trim()) ? themeWiseColor('#d9d9d9', '#434343', themeMode) : '#1677ff',
              borderColor: (submitting || uploadingAttachment || !commentValue.trim()) ? themeWiseColor('#d9d9d9', '#434343', themeMode) : '#1677ff',
              color: (submitting || uploadingAttachment || !commentValue.trim()) ? themeWiseColor('rgba(0, 0, 0, 0.25)', '#ffffff', themeMode) : '#fff',
              opacity: 1,
              cursor: (submitting || uploadingAttachment || !commentValue.trim()) ? 'not-allowed' : 'pointer',
            }}
          >
            {t('addButton', { defaultValue: 'Send' })}
          </Button>
        </Flex>
      </div>
    </Card>
  );
};

export default ProjectViewUpdates;
