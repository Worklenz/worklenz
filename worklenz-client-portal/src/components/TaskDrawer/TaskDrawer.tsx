import React, { useState, useEffect, useRef } from 'react';
import {
  Drawer,
  Tabs,
  Typography,
  Tag,
  Descriptions,
  Skeleton,
  Empty,
  Avatar,
  Space,
  Input,
  Button,
  message,
  Collapse,
  theme,
  Form,
  Flex,
  CalendarOutlined,
  UserOutlined,
  SendOutlined,
  DownloadOutlined,
  FlagOutlined,
} from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import clientPortalAPI from '@/services/api';
import { TaskDetails, TaskComment } from '@/types';
import './TaskDrawer.css';

const { Title, Text } = Typography;
const { TextArea } = Input;
const { Panel } = Collapse;

interface TaskDrawerProps {
  open: boolean;
  taskId: string | null;
  unseenCommentsCount?: number;
  onClose: () => void;
  onTaskUpdated?: () => void;
}

const TaskDrawer: React.FC<TaskDrawerProps> = ({
  open,
  taskId,
  unseenCommentsCount = 0,
  onClose,
  onTaskUpdated
}) => {
  const { t } = useTranslation();
  const { token } = theme.useToken();
  const [form] = Form.useForm();
  const [taskDetails, setTaskDetails] = useState<TaskDetails | null>(null);
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCommentsLoading, setIsCommentsLoading] = useState(false);
  const [isAddingComment, setIsAddingComment] = useState(false);
  const [activeTab, setActiveTab] = useState('details');
  const [unseenCount, setUnseenCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Sync unseen count from props
  useEffect(() => {
    setUnseenCount(unseenCommentsCount);
  }, [unseenCommentsCount]);

  // Fetch task details when drawer opens
  useEffect(() => {
    if (open && taskId) {
      fetchTaskDetails();
      fetchComments();
      setActiveTab('details');
    }
  }, [open, taskId]);

  // Auto-scroll to bottom when comments change
  useEffect(() => {
    if (activeTab === 'comments') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [comments, activeTab]);

  // Mark comments as viewed when switching to comments tab
  useEffect(() => {
    if (activeTab === 'comments' && taskId && unseenCount > 0) {
      const markAsViewed = async () => {
        try {
          await clientPortalAPI.markTaskCommentsAsViewed(taskId);
          setUnseenCount(0);
          // Notify parent to refresh tasks list
          if (onTaskUpdated) {
            onTaskUpdated();
          }
        } catch (error) {
          console.error('Error marking comments as viewed:', error);
        }
      };
      markAsViewed();
    }
  }, [activeTab, taskId, unseenCount, onTaskUpdated]);

  const fetchTaskDetails = async () => {
    if (!taskId) return;

    try {
      setIsLoading(true);
      const response = await clientPortalAPI.getTaskDetails(taskId);
      if (response.done) {
        setTaskDetails(response.body as TaskDetails);
      } else {
        message.error(t('tasks.failedToLoad'));
      }
    } catch (error) {
      console.error('Error fetching task details:', error);
      message.error(t('tasks.failedToLoad'));
    } finally {
      setIsLoading(false);
    }
  };

  const fetchComments = async () => {
    if (!taskId) return;

    try {
      setIsCommentsLoading(true);
      const response = await clientPortalAPI.getTaskComments(taskId);
      if (response.done) {
        setComments((response.body as TaskComment[]) || []);
      }
    } catch (error) {
      console.error('Error fetching comments:', error);
    } finally {
      setIsCommentsLoading(false);
    }
  };

  const handleAddComment = async (values: { comment: string }) => {
    if (!taskId) return;

    try {
      setIsAddingComment(true);
      const response = await clientPortalAPI.addTaskComment(taskId, values.comment.trim());
      if (response.done) {
        message.success(t('tasks.commentAdded'));
        form.resetFields();
        await fetchComments();
      } else {
        message.error(t('tasks.commentError'));
      }
    } catch (error) {
      console.error('Error adding comment:', error);
      message.error(t('tasks.commentError'));
    } finally {
      setIsAddingComment(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const getFileIcon = (fileType: string) => {
    const type = fileType.toLowerCase();
    if (type.includes('image')) return '🖼️';
    if (type.includes('pdf')) return '📄';
    if (type.includes('doc') || type.includes('word')) return '📝';
    if (type.includes('xls') || type.includes('excel') || type.includes('sheet')) return '📊';
    if (type.includes('zip') || type.includes('rar')) return '📦';
    return '📎';
  };

  const renderDetailsTab = () => {
    if (isLoading) {
      return (
        <div style={{ padding: 24 }}>
          <Skeleton active />
          <Skeleton active style={{ marginTop: 16 }} />
        </div>
      );
    }

    if (!taskDetails) {
      return (
        <Empty description={t('tasks.taskNotAvailable')} style={{ marginTop: 50 }} />
      );
    }

    return (
      <Collapse
        defaultActiveKey={['info', 'description', 'team', 'attachments']}
        bordered={false}
        style={{ background: 'transparent' }}
      >
        <Panel 
          header={<Typography.Text strong>{t('tasks.taskInformation')}</Typography.Text>} 
          key="info"
          style={{ border: 'none', paddingBlock: 0 }}
        >
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>{t('tasks.status')}</Text>
              <div style={{ marginTop: 4 }}>
                <Tag color={taskDetails.statusColor}>{taskDetails.statusName}</Tag>
              </div>
            </div>

            <Descriptions column={2} size="small">
              <Descriptions.Item label={t('tasks.startDate')}>
                <Space>
                  <CalendarOutlined />
                  {formatDate(taskDetails.startDate)}
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label={t('tasks.endDate')}>
                <Space>
                  <CalendarOutlined />
                  {formatDate(taskDetails.endDate)}
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label={t('tasks.created')}>
                {formatDate(taskDetails.createdAt)}
              </Descriptions.Item>
              <Descriptions.Item label={t('tasks.lastUpdated')}>
                {formatDate(taskDetails.updatedAt)}
              </Descriptions.Item>
            </Descriptions>
          </Space>
        </Panel>

        {taskDetails.description && (
          <Panel 
            header={<Typography.Text strong>{t('tasks.description')}</Typography.Text>} 
            key="description"
            style={{ border: 'none', paddingBlock: 0 }}
          >
            <div style={{ padding: '8px 0' }}>
              <Text>{taskDetails.description}</Text>
            </div>
          </Panel>
        )}

        <Panel
          header={<Typography.Text strong>{t('tasks.teamAndPriority')}</Typography.Text>}
          key="team"
          style={{ border: 'none', paddingBlock: 0 }}
        >
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            {taskDetails.priorityName && (
              <div>
                <Text type="secondary" style={{ fontSize: 12 }}>{t('tasks.priority')}</Text>
                <div style={{ marginTop: 4 }}>
                  <Tag
                    color={taskDetails.priorityColor || 'default'}
                    icon={<FlagOutlined />}
                  >
                    {taskDetails.priorityName}
                  </Tag>
                </div>
              </div>
            )}

            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>{t('tasks.assignedTo')}</Text>
              <div style={{ marginTop: 8 }}>
                {taskDetails.assignees && taskDetails.assignees.length > 0 ? (
                  <Space wrap>
                    {taskDetails.assignees.map((assignee) => (
                      <div
                        key={assignee.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          padding: '4px 12px',
                          background: token.colorBgContainer,
                          border: `1px solid ${token.colorBorder}`,
                          borderRadius: 16,
                        }}
                      >
                        <Avatar
                          size="small"
                          src={assignee.avatar_url}
                          icon={<UserOutlined />}
                        >
                          {assignee.name.charAt(0).toUpperCase()}
                        </Avatar>
                        <Text style={{ fontSize: 13 }}>{assignee.name}</Text>
                      </div>
                    ))}
                  </Space>
                ) : (
                  <Text type="secondary" style={{ fontSize: 13 }}>{t('tasks.noAssignees')}</Text>
                )}
              </div>
            </div>
          </Space>
        </Panel>

        <Panel
          header={<Typography.Text strong>{t('tasks.attachments')} ({taskDetails.attachments?.length || 0})</Typography.Text>}
          key="attachments"
          style={{ border: 'none', paddingBlock: 0 }}
        >
          {taskDetails.attachments && taskDetails.attachments.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
              {taskDetails.attachments.map((file) => (
                <div
                  key={file.id}
                  style={{
                    padding: 12,
                    border: `1px solid ${token.colorBorder}`,
                    borderRadius: 8,
                    background: token.colorBgContainer,
                  }}
                >
                  <Space direction="vertical" size={4} style={{ width: '100%' }}>
                    <div style={{ fontSize: 24 }}>{getFileIcon(file.type)}</div>
                    <Text
                      strong
                      style={{ fontSize: 13 }}
                      ellipsis={{ tooltip: file.name }}
                    >
                      {file.name}
                    </Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {formatFileSize(file.size)}
                    </Text>
                    <Button
                      type="link"
                      size="small"
                      icon={<DownloadOutlined />}
                      href={file.url}
                      target="_blank"
                      style={{ padding: 0, height: 'auto' }}
                    >
                      {t('tasks.download')}
                    </Button>
                  </Space>
                </div>
              ))}
            </div>
          ) : (
            <Empty description={t('tasks.noAttachments')} image={Empty.PRESENTED_IMAGE_SIMPLE} />
          )}
        </Panel>
      </Collapse>
    );
  };

  const renderCommentsTab = () => {
    return (
      <div style={{ padding: '16px 24px', overflowY: 'auto', height: '100%' }}>
        {isCommentsLoading ? (
          <div>
            <Skeleton avatar active style={{ marginBottom: 16 }} />
            <Skeleton avatar active />
          </div>
        ) : comments.length > 0 ? (
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            {comments.map((comment) => {
              const isClient = comment.sender_type === 'client';
              return (
                <div
                  key={comment.id}
                  style={{
                    display: 'flex',
                    gap: 12,
                    flexDirection: isClient ? 'row-reverse' : 'row',
                  }}
                >
                  <Avatar
                    icon={<UserOutlined />}
                    style={{
                      backgroundColor: isClient ? token.colorPrimary : token.colorSuccess,
                    }}
                  >
                    {comment.sender_name.charAt(0).toUpperCase()}
                  </Avatar>
                  <div
                    style={{
                      flex: 1,
                      maxWidth: '70%',
                    }}
                  >
                    <div
                      style={{
                        padding: '8px 12px',
                        borderRadius: 8,
                        background: isClient
                          ? token.colorPrimaryBg
                          : token.colorBgElevated,
                        border: `1px solid ${isClient ? token.colorPrimaryBorder : token.colorBorder}`,
                      }}
                    >
                      <Space direction="vertical" size={4} style={{ width: '100%' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Text strong style={{ fontSize: 13 }}>
                            {comment.sender_name}
                          </Text>
                          <Text type="secondary" style={{ fontSize: 11 }}>
                            {formatDateTime(comment.created_at)}
                          </Text>
                        </div>
                        <Text style={{ fontSize: 14 }}>{comment.comment}</Text>
                      </Space>
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </Space>
        ) : (
          <Empty
            description={t('tasks.noComments')}
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            style={{ marginTop: 50 }}
          />
        )}
      </div>
    );
  };

  const renderCommentInput = () => {
    return (
      <Form form={form} onFinish={handleAddComment}>
        <Flex gap={12} align="flex-end">
          <Form.Item
            name="comment"
            rules={[{ required: true, message: t('tasks.commentRequired') }]}
            style={{ marginBottom: 0, flex: 1 }}
          >
            <TextArea
              rows={2}
              placeholder={t('tasks.commentPlaceholder')}
              maxLength={5000}
              showCount
              style={{
                borderRadius: 8,
                resize: 'none',
              }}
              onPressEnter={(e) => {
                if (!e.shiftKey) {
                  e.preventDefault();
                  form.submit();
                }
              }}
            />
          </Form.Item>
          <Button
            type="primary"
            shape="circle"
            htmlType="submit"
            icon={<SendOutlined />}
            loading={isAddingComment}
            size="large"
            style={{ marginBottom: 0 }}
          />
        </Flex>
      </Form>
    );
  };

  const tabItems = [
    {
      key: 'details',
      label: t('tasks.detailsTab'),
      children: renderDetailsTab(),
    },
    {
      key: 'comments',
      label: (
        <Space>
          {t('tasks.commentsTab')}
          {unseenCount > 0 && (
            <Tag color="blue" style={{ margin: 0 }}>
              {unseenCount}
            </Tag>
          )}
        </Space>
      ),
      children: renderCommentsTab(),
    },
  ];

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width={720}
      destroyOnClose
      rootClassName="task-drawer-root"
      getContainer={() => document.body}
      title={
        isLoading ? (
          <Skeleton.Input active size="small" style={{ width: 300 }} />
        ) : (
          <Title level={4} style={{ margin: 0 }}>
            {taskDetails?.name || t('tasks.taskDetails')}
          </Title>
        )
      }
      footer={renderCommentInput()}
      styles={{
        body: { padding: 0 },
        footer: {
          padding: '12px 24px',
          borderTop: `1px solid ${token.colorBorderSecondary}`,
        },
      }}
    >
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={tabItems}
        style={{ height: '100%' }}
        tabBarStyle={{ padding: '0 24px', margin: 0 }}
      />
    </Drawer>
  );
};

export default TaskDrawer;
