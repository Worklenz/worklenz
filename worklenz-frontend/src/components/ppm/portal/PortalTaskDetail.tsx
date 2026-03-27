// PPM-OVERRIDE: Phase 2 — Portal task detail with comments, attachments, and feedback
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card, Typography, Flex, Spin, Button, Input, Upload, message, Tag, Divider, List, Avatar, Empty,
} from 'antd';
import {
  ArrowLeftOutlined, SendOutlined, PaperClipOutlined, UploadOutlined,
  UserOutlined, RobotOutlined, TeamOutlined,
} from '@ant-design/icons';
import { portalApi, IPortalTask, IPortalComment, IPortalAttachment, IPortalFeedback } from './portal-api';
import { getStatusConfig } from './status-labels';
import { usePortal } from './portal-context';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

const AUTHOR_ICONS: Record<string, React.ReactNode> = {
  client: <UserOutlined />,
  partner: <TeamOutlined />,
  system: <RobotOutlined />,
};

const PortalTaskDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = usePortal();
  const [task, setTask] = useState<IPortalTask | null>(null);
  const [comments, setComments] = useState<IPortalComment[]>([]);
  const [feedback, setFeedback] = useState<IPortalFeedback[]>([]);
  const [attachments, setAttachments] = useState<IPortalAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);

  const loadTask = useCallback(async () => {
    if (!id) return;
    try {
      const res = await portalApi.getTask(id);
      if (res.done && res.body) {
        const { comments: taskComments, feedback: taskFeedback, ...taskData } = res.body;
        setTask(taskData as IPortalTask);
        setComments(taskComments || []);
        setFeedback(taskFeedback || []);
        // Load attachments if task has a worklenz_task_id
        if (taskData.worklenz_task_id) {
          const attRes = await portalApi.getAttachments(taskData.worklenz_task_id);
          if (attRes.done && attRes.body) setAttachments(attRes.body);
        }
      }
    } catch {
      message.error('Failed to load task');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadTask();
  }, [loadTask]);

  const handleComment = async () => {
    if (!commentText.trim() || !id) return;
    setSending(true);
    try {
      const res = await portalApi.addTaskComment(id, commentText.trim());
      if (res.done && res.body) {
        setComments(prev => [...prev, res.body!]);
        setCommentText('');
      } else {
        message.error(res.message || 'Failed to send comment');
      }
    } catch {
      message.error('Failed to send comment');
    } finally {
      setSending(false);
    }
  };

  const handleUpload = async (file: File) => {
    if (!task?.worklenz_task_id) {
      message.warning('Task is still being processed. Try again shortly.');
      return false;
    }
    if (file.size > 50 * 1024 * 1024) {
      message.error('File exceeds 50MB limit');
      return false;
    }
    setUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64DataUrl = reader.result as string; // full data:...;base64,... URL
        const ext = file.name.split('.').pop() || 'unknown';
        const res = await portalApi.uploadAttachment({
          file: base64DataUrl,
          file_name: file.name,
          task_id: task!.worklenz_task_id!,
          size: file.size,
          type: ext,
        });
        if (res.done && res.body) {
          setAttachments(prev => [...prev, res.body!]);
          message.success('File uploaded');
        } else {
          message.error(res.message || 'Upload failed');
        }
        setUploading(false);
      };
      reader.readAsDataURL(file);
    } catch {
      message.error('Upload failed');
      setUploading(false);
    }
    return false; // prevent antd auto-upload
  };

  const handleDownload = async (att: IPortalAttachment) => {
    try {
      const res = await portalApi.getDownloadUrl(att.id);
      if (res.done && res.body?.url) {
        window.open(res.body.url, '_blank');
      }
    } catch {
      message.error('Failed to get download link');
    }
  };

  if (loading) {
    return <Flex justify="center" align="center" style={{ minHeight: 300 }}><Spin size="large" /></Flex>;
  }

  if (!task) {
    return <Empty description="Task not found" />;
  }

  const statusCfg = getStatusConfig(task.status);

  return (
    <div style={{ maxWidth: 800 }}>
      <Button
        type="text"
        icon={<ArrowLeftOutlined />}
        onClick={() => navigate('/portal/tasks')}
        style={{ marginBottom: 16, padding: '4px 0' }}
      >
        Back to tasks
      </Button>

      <Card>
        <Flex justify="space-between" align="start" style={{ marginBottom: 16 }}>
          <div>
            <Title level={4} style={{ margin: 0 }}>{task.title}</Title>
            <Flex gap={8} style={{ marginTop: 8 }}>
              <Tag color={statusCfg.color} style={{ background: statusCfg.bgColor, borderColor: statusCfg.color }}>
                {statusCfg.label}
              </Tag>
              {task.priority && <Tag>{task.priority}</Tag>}
              {task.type && <Tag>{task.type}</Tag>}
            </Flex>
          </div>
          <Text type="secondary" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
            {new Date(task.created_at).toLocaleDateString()}
          </Text>
        </Flex>

        {task.description && (
          <Paragraph style={{ marginBottom: 16, whiteSpace: 'pre-wrap' }}>
            {task.description}
          </Paragraph>
        )}

        {/* Feedback from admin (returned tasks) */}
        {feedback.length > 0 && (
          <>
            <Divider orientation="left" style={{ fontSize: 13 }}>Feedback</Divider>
            {feedback.map((fb, i) => (
              <Card key={i} size="small" style={{ marginBottom: 8, background: '#fff7e6', borderColor: '#ffd591' }}>
                {fb.details?.comment && <Paragraph style={{ margin: '0 0 4px', fontSize: 13 }}>{fb.details.comment}</Paragraph>}
                <Text type="secondary" style={{ fontSize: 11 }}>
                  {fb.returned_by && <>{fb.returned_by} · </>}
                  {new Date(fb.created_at).toLocaleString()}
                </Text>
              </Card>
            ))}
          </>
        )}

        {/* Attachments */}
        <Divider orientation="left" style={{ fontSize: 13 }}>
          Attachments ({attachments.length})
        </Divider>
        {attachments.length > 0 ? (
          <List
            size="small"
            dataSource={attachments}
            renderItem={att => (
              <List.Item
                actions={[
                  <Button type="link" size="small" onClick={() => handleDownload(att)}>
                    Download
                  </Button>,
                ]}
              >
                <Flex align="center" gap={8}>
                  <PaperClipOutlined />
                  <Text style={{ fontSize: 13 }}>{att.name}</Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>({att.size})</Text>
                </Flex>
              </List.Item>
            )}
          />
        ) : (
          <Text type="secondary" style={{ fontSize: 13 }}>No attachments</Text>
        )}
        {user?.role !== 'viewer' && (
          <Upload
            beforeUpload={handleUpload}
            showUploadList={false}
            accept="*"
          >
            <Button icon={<UploadOutlined />} size="small" loading={uploading} style={{ marginTop: 8 }}>
              Upload File
            </Button>
          </Upload>
        )}

        {/* Comments */}
        <Divider orientation="left" style={{ fontSize: 13 }}>
          Comments ({comments.length})
        </Divider>
        {comments.length > 0 ? (
          <List
            dataSource={comments}
            renderItem={comment => (
              <List.Item style={{ padding: '8px 0' }}>
                <Flex gap={12} style={{ width: '100%' }}>
                  <Avatar size={32} icon={AUTHOR_ICONS[comment.author_type] || <UserOutlined />} />
                  <div style={{ flex: 1 }}>
                    <Flex justify="space-between" align="center">
                      <Text strong style={{ fontSize: 13 }}>
                        {comment.author_name || comment.author_type}
                      </Text>
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        {new Date(comment.created_at).toLocaleString()}
                      </Text>
                    </Flex>
                    <Paragraph style={{ margin: '4px 0 0', fontSize: 13, whiteSpace: 'pre-wrap' }}>
                      {comment.body}
                    </Paragraph>
                  </div>
                </Flex>
              </List.Item>
            )}
          />
        ) : (
          <Text type="secondary" style={{ fontSize: 13 }}>No comments yet</Text>
        )}

        {user?.role !== 'viewer' && (
          <Flex gap={8} style={{ marginTop: 12 }}>
            <TextArea
              value={commentText}
              onChange={e => setCommentText(e.target.value)}
              placeholder="Write a comment..."
              autoSize={{ minRows: 2, maxRows: 4 }}
              maxLength={5000}
              style={{ flex: 1 }}
            />
            <Button
              type="primary"
              icon={<SendOutlined />}
              onClick={handleComment}
              loading={sending}
              disabled={!commentText.trim()}
              style={{ alignSelf: 'flex-end' }}
            >
              Send
            </Button>
          </Flex>
        )}
      </Card>
    </div>
  );
};

export default PortalTaskDetail;
