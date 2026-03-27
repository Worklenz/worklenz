// PPM-OVERRIDE: Phase 2 — Approval queue for incoming client-submitted tasks
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card, Table, Button, Typography, Flex, Spin, message, Modal, Form, Select, Input, Tag, Empty,
} from 'antd';
import { CheckOutlined, RollbackOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { adminApi, IApprovalItem, IFeedbackReason } from './admin-api';

const { Title, Text } = Typography;
const { TextArea } = Input;

const ApprovalQueue: React.FC = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState<IApprovalItem[]>([]);
  const [reasons, setReasons] = useState<IFeedbackReason[]>([]);
  const [loading, setLoading] = useState(true);
  const [returnModal, setReturnModal] = useState<IApprovalItem | null>(null);
  const [returning, setReturning] = useState(false);
  const [approving, setApproving] = useState<string | null>(null);
  const [form] = Form.useForm();

  const loadData = useCallback(async () => {
    try {
      const [itemsRes, reasonsRes] = await Promise.all([
        adminApi.getApprovals(),
        adminApi.getFeedbackReasons(),
      ]);
      if (itemsRes.done && itemsRes.body) setItems(itemsRes.body);
      if (reasonsRes.done && reasonsRes.body) setReasons(reasonsRes.body);
    } catch {
      message.error('Failed to load approval queue');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleApprove = async (item: IApprovalItem) => {
    setApproving(item.id);
    try {
      const res = await adminApi.approveTask(item.id);
      if (res.done) {
        setItems(prev => prev.filter(i => i.id !== item.id));
        message.success(`"${item.title}" approved and queued`);
      } else {
        message.error(res.message || 'Failed to approve');
      }
    } catch {
      message.error('Failed to approve task');
    } finally {
      setApproving(null);
    }
  };

  const handleReturn = async (values: { reason_id: string; comment?: string }) => {
    if (!returnModal) return;
    setReturning(true);
    try {
      const res = await adminApi.returnTask(returnModal.id, values);
      if (res.done) {
        message.success(`"${returnModal.title}" returned to client`);
        setReturnModal(null);
        form.resetFields();
        loadData(); // Refresh to update return_count
      } else {
        message.error(res.message || 'Failed to return task');
      }
    } catch {
      message.error('Failed to return task');
    } finally {
      setReturning(false);
    }
  };

  const columns = [
    {
      title: 'Task',
      dataIndex: 'title',
      key: 'title',
      render: (title: string, record: IApprovalItem) => (
        <div>
          <Text strong>{title}</Text>
          {record.description && (
            <Text type="secondary" style={{ display: 'block', fontSize: 12, marginTop: 2 }}>
              {record.description.slice(0, 100)}{record.description.length > 100 ? '...' : ''}
            </Text>
          )}
        </div>
      ),
    },
    {
      title: 'Client',
      dataIndex: 'client_name',
      key: 'client_name',
    },
    {
      title: 'Submitted',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (v: string) => new Date(v).toLocaleDateString(),
      sorter: (a: IApprovalItem, b: IApprovalItem) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    },
    {
      title: 'Returns',
      dataIndex: 'return_count',
      key: 'return_count',
      render: (v: number) => v > 0 ? <Tag color="orange">{v}</Tag> : <Text type="secondary">0</Text>,
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 200,
      render: (_: any, record: IApprovalItem) => (
        <Flex gap={8}>
          <Button
            type="primary"
            size="small"
            icon={<CheckOutlined />}
            onClick={() => handleApprove(record)}
            loading={approving === record.id}
          >
            Approve
          </Button>
          <Button
            size="small"
            icon={<RollbackOutlined />}
            onClick={() => setReturnModal(record)}
          >
            Return
          </Button>
        </Flex>
      ),
    },
  ];

  if (loading) {
    return <Flex justify="center" align="center" style={{ minHeight: 400 }}><Spin size="large" /></Flex>;
  }

  return (
    <div>
      <Flex align="center" gap={12} style={{ marginBottom: 24 }}>
        <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate('/taskflow/ppm')} />
        <Title level={3} style={{ margin: 0 }}>Approval Queue</Title>
        <Tag>{items.length} pending</Tag>
      </Flex>

      {items.length === 0 ? (
        <Card>
          <Empty description="No tasks awaiting approval" />
        </Card>
      ) : (
        <Table
          dataSource={items}
          columns={columns}
          rowKey="id"
          pagination={false}
          size="middle"
        />
      )}

      {/* Return to client modal */}
      <Modal
        title={`Return: ${returnModal?.title}`}
        open={!!returnModal}
        onCancel={() => { setReturnModal(null); form.resetFields(); }}
        footer={null}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleReturn}>
          <Form.Item name="reason_id" label="Reason" rules={[{ required: true, message: 'Select a reason' }]}>
            <Select placeholder="Why is this being returned?">
              {reasons.map(r => (
                <Select.Option key={r.id} value={r.id}>{r.label}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="comment" label="Additional Notes">
            <TextArea rows={3} placeholder="Optional notes for the client..." maxLength={2000} />
          </Form.Item>
          <Flex justify="end" gap={8}>
            <Button onClick={() => { setReturnModal(null); form.resetFields(); }}>Cancel</Button>
            <Button type="primary" danger htmlType="submit" loading={returning}>Return to Client</Button>
          </Flex>
        </Form>
      </Modal>
    </div>
  );
};

export default ApprovalQueue;
