import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Typography, Card, Flex, Spin, Button, Descriptions, Input, Divider,
  Modal, Alert, Empty, Timeline,
} from 'antd';
import {
  ArrowLeftOutlined, CheckCircleOutlined, UndoOutlined,
  LinkOutlined, SendOutlined,
} from '@ant-design/icons';
import { portalApi, IDeliverable, IComment } from './portal-api';
import { usePortal } from './portal-context';
import StatusBadge from './StatusBadge';
import { getClientLabel } from './status-labels';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

const PortalDeliverableDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = usePortal();

  const [deliverable, setDeliverable] = useState<IDeliverable | null>(null);
  const [comments, setComments] = useState<IComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectComment, setRejectComment] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate('/portal/login', { replace: true });
      return;
    }
    if (id) loadData();
  }, [id, user, navigate]);

  const loadData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [delRes, comRes] = await Promise.all([
        portalApi.getDeliverable(id),
        portalApi.getComments(id),
      ]);
      if (delRes.done && delRes.body) setDeliverable(delRes.body);
      if (comRes.done && comRes.body) setComments(comRes.body);
    } catch { /* handled */ }
    setLoading(false);
  }, [id]);

  const handleApprove = async () => {
    if (!id) return;
    setActionLoading(true);
    try {
      const res = await portalApi.approveDeliverable(id);
      if (res.done) {
        await loadData();
      }
    } catch { /* handled */ }
    setActionLoading(false);
  };

  const handleReject = async () => {
    if (!id || !rejectComment.trim()) return;
    setActionLoading(true);
    try {
      const res = await portalApi.rejectDeliverable(id, rejectComment.trim());
      if (res.done) {
        setRejectModalOpen(false);
        setRejectComment('');
        await loadData();
      }
    } catch { /* handled */ }
    setActionLoading(false);
  };

  const handleComment = async () => {
    if (!id || !comment.trim()) return;
    setSubmitting(true);
    try {
      const res = await portalApi.addComment(id, comment.trim());
      if (res.done) {
        setComment('');
        const comRes = await portalApi.getComments(id);
        if (comRes.done && comRes.body) setComments(comRes.body);
      }
    } catch { /* handled */ }
    setSubmitting(false);
  };

  if (loading) {
    return (
      <Flex align="center" justify="center" style={{ minHeight: 400 }}>
        <Spin size="large" />
      </Flex>
    );
  }

  if (!deliverable) {
    return <Empty description="Deliverable not found" />;
  }

  const d = deliverable;
  const canReview = d.status === 'client_review' && user?.role !== 'viewer';

  return (
    <div>
      <Button
        type="text"
        icon={<ArrowLeftOutlined />}
        onClick={() => navigate('/portal/deliverables')}
        style={{ marginBottom: 16, paddingLeft: 0 }}
      >
        Back to deliverables
      </Button>

      <Card style={{ borderRadius: 8, marginBottom: 24 }}>
        <Flex justify="space-between" align="start" style={{ marginBottom: 20 }}>
          <div>
            <Title level={4} style={{ margin: 0 }}>{d.title}</Title>
            <Flex gap={8} style={{ marginTop: 8 }}>
              <StatusBadge status={d.status} />
              {d.type && <Text type="secondary" style={{ fontSize: 13 }}>{d.type}</Text>}
              {d.channel && <Text type="secondary" style={{ fontSize: 13 }}>{d.channel}</Text>}
            </Flex>
          </div>

          {canReview && (
            <Flex gap={8}>
              <Button
                icon={<UndoOutlined />}
                onClick={() => setRejectModalOpen(true)}
              >
                Request Revision
              </Button>
              <Button
                type="primary"
                icon={<CheckCircleOutlined />}
                onClick={handleApprove}
                loading={actionLoading}
              >
                Approve
              </Button>
            </Flex>
          )}
        </Flex>

        {d.description && (
          <Paragraph type="secondary" style={{ marginBottom: 20 }}>
            {d.description}
          </Paragraph>
        )}

        <Descriptions
          size="small"
          column={{ xs: 1, sm: 2 }}
          labelStyle={{ fontSize: 13 }}
          contentStyle={{ fontSize: 13 }}
        >
          {d.priority && <Descriptions.Item label="Priority">{d.priority}</Descriptions.Item>}
          {d.send_date && (
            <Descriptions.Item label="Send Date">
              {new Date(d.send_date).toLocaleDateString()}
            </Descriptions.Item>
          )}
          {d.submission_date && (
            <Descriptions.Item label="Submission Date">
              {new Date(d.submission_date).toLocaleDateString()}
            </Descriptions.Item>
          )}
          {d.revisions_deadline && (
            <Descriptions.Item label="Revision Deadline">
              {new Date(d.revisions_deadline).toLocaleDateString()}
            </Descriptions.Item>
          )}
          {d.due_date && (
            <Descriptions.Item label="Due Date">
              {new Date(d.due_date).toLocaleDateString()}
            </Descriptions.Item>
          )}
          {d.month_completed && (
            <Descriptions.Item label="Completed">{d.month_completed}</Descriptions.Item>
          )}
        </Descriptions>

        {d.asset_review_link && (
          <div style={{ marginTop: 16 }}>
            <Button
              type="link"
              icon={<LinkOutlined />}
              href={d.asset_review_link}
              target="_blank"
              rel="noopener noreferrer"
              style={{ paddingLeft: 0 }}
            >
              View asset for review
            </Button>
          </div>
        )}
      </Card>

      {/* Comments section */}
      <Card
        title={<Text strong>Comments</Text>}
        style={{ borderRadius: 8 }}
      >
        {comments.length > 0 ? (
          <Timeline
            style={{ marginTop: 8 }}
            items={comments.map((c) => ({
              color: c.action === 'revision_requested' ? 'red' : 'blue',
              children: (
                <div>
                  <Flex justify="space-between" align="baseline">
                    <Text strong style={{ fontSize: 13 }}>
                      {c.details.author_email || 'Client'}
                      {c.action === 'revision_requested' && (
                        <Text type="danger" style={{ fontSize: 12, marginLeft: 8 }}>
                          Revision requested
                        </Text>
                      )}
                    </Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {new Date(c.created_at).toLocaleString()}
                    </Text>
                  </Flex>
                  <Paragraph style={{ margin: '4px 0 0', fontSize: 13 }}>
                    {c.details.comment}
                  </Paragraph>
                </div>
              ),
            }))}
          />
        ) : (
          <Text type="secondary" style={{ fontSize: 13 }}>No comments yet</Text>
        )}

        <Divider style={{ margin: '16px 0 12px' }} />

        <Flex gap={8}>
          <TextArea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Add a comment..."
            autoSize={{ minRows: 2, maxRows: 5 }}
            style={{ flex: 1 }}
          />
          <Button
            type="primary"
            icon={<SendOutlined />}
            onClick={handleComment}
            loading={submitting}
            disabled={!comment.trim()}
            style={{ alignSelf: 'flex-end' }}
          >
            Send
          </Button>
        </Flex>
      </Card>

      {/* Reject modal */}
      <Modal
        title="Request Revision"
        open={rejectModalOpen}
        onCancel={() => { setRejectModalOpen(false); setRejectComment(''); }}
        onOk={handleReject}
        okText="Submit Revision Request"
        okButtonProps={{ danger: true, loading: actionLoading, disabled: !rejectComment.trim() }}
      >
        <Alert
          type="info"
          message="Please describe what changes are needed. This feedback will be sent to the team."
          style={{ marginBottom: 16 }}
          showIcon
        />
        <TextArea
          value={rejectComment}
          onChange={(e) => setRejectComment(e.target.value)}
          placeholder="Describe the changes you'd like to see..."
          autoSize={{ minRows: 3, maxRows: 8 }}
          autoFocus
        />
      </Modal>
    </div>
  );
};

export default PortalDeliverableDetailPage;
