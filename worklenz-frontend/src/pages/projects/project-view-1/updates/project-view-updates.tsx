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
  theme
} from '@/shared/antd-imports';
import {
  SendOutlined,
  UserOutlined,
  MessageOutlined
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
} from '@/features/projects/singleProject/updates/updatesSlice';
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
  const projectMembers = useAppSelector(state => state.projectMemberReducer.membersList);

  const [submitting, setSubmitting] = useState(false);

  // Initial fetch
  useEffect(() => {
    if (projectId) {
      dispatch(getProjectComments(projectId));
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

    const eventName = SocketEvents.NEW_PROJECT_COMMENT_RECEIVED.toString();
    socket.on(eventName, handleNewComment);

    return () => {
      socket.off(eventName, handleNewComment);
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
      .filter(member => member.name && content.includes(`@${member.name}`))
      .map(m => ({
        id: m.id,
        name: m.name,
        team_member_id: m.team_member_id
      }));

    try {
      await dispatch(createProjectComment({
        project_id: projectId,
        content: content,
        mentions: mentionedMembers
      })).unwrap();
      form.resetFields();
    } catch (error) {
      console.error('Failed to send comment', error);
    } finally {
      setSubmitting(false);
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

  const renderCommentContent = (htmlContent: string) => {
    return (
      <div
        dangerouslySetInnerHTML={{ __html: htmlContent }}
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

  const mentionsOptions = useMemo(() => projectMembers.map(member => ({
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

  return (
    <Card
      className={`project-view-updates theme-${themeMode}`}
      styles={{ body: { padding: 0 } }}
      style={{ height: 'calc(100vh - 260px)', display: 'flex', flexDirection: 'column' }}
    >
      <div
        className="updates-list-container"
        ref={listRef}
        style={{
          backgroundColor: token.colorBgContainer
        }}
      >
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

              // Render time separator logic
              const showTimeSeparator = index === 0 ||
                (index > 0 && isDifferentDay(item.created_at || '', updatesList[index - 1].created_at || ''));

              return (
                <div key={item.id || index}>
                  {showTimeSeparator && renderTimeSeparator(item.created_at || '')}

                  <Comment
                    author={<span style={authorStyle}>{item.created_by}</span>}
                    datetime={<span style={dateStyle}>{dayjs(item.created_at).fromNow()}</span>}
                    avatar={
                      <SingleAvatar
                        name={item.created_by}
                        avatarUrl={item.avatar_url}
                      />
                    }
                    content={
                      <div className={`comment-content-${themeMode}`}>
                        {renderCommentContent(item.content || '')}
                      </div>
                    }
                    className={isUserComment ? 'current-user-comment' : ''}
                    actions={
                      isUserComment ? [
                        <Popconfirm
                          title={t('deleteConfirmTitle')}
                          description={t('deleteConfirmContent')}
                          onConfirm={() => handleDelete(item.id!)}
                          okText={t('yes')}
                          cancelText={t('no')}
                          key="delete"
                        >
                          <span style={actionStyle}>{t('deleteButton')}</span>
                        </Popconfirm>
                      ] : undefined
                    }
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div
        className="updates-input-container"
        style={{
          borderTop: `1px solid ${token.colorBorderSecondary}`,
          backgroundColor: token.colorBgContainer
        }}
      >
        <Form form={form} onFinish={onFinish}>
          <Form.Item name="comment" style={{ marginBottom: 12 }}>
            <Mentions
              rows={3}
              placeholder={t('inputPlaceholder')}
              options={mentionsOptions}
              autoSize={{ minRows: 2, maxRows: 6 }}
              style={{ borderRadius: '8px' }}
            />
          </Form.Item>
          <Flex justify="flex-end">
            <Button
              type="primary"
              htmlType="submit"
              loading={submitting}
              icon={<SendOutlined />}
            >
              {t('addButton')}
            </Button>
          </Flex>
        </Form>
      </div>
    </Card>
  );
};

export default ProjectViewUpdates;