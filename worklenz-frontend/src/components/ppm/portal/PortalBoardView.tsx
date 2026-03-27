// PPM-OVERRIDE: Phase 2 — Portal board view with task creation and kanban-style columns
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card, Button, Input, Typography, Flex, Spin, Empty, Badge, Modal, Form, Select, message, Tag,
} from 'antd';
import { PlusOutlined, MessageOutlined, SearchOutlined } from '@ant-design/icons';
import { usePortal } from './portal-context';
import { portalApi, IPortalTask } from './portal-api';
import { getStatusConfig } from './status-labels';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

// PPM statuses visible to clients (hides queued, internal_review)
const CLIENT_COLUMNS = [
  { key: 'incoming', label: 'Submitted', statuses: ['incoming', 'queued'] },
  { key: 'in_progress', label: 'In Progress', statuses: ['in_progress', 'internal_review'] },
  { key: 'client_review', label: 'Awaiting Review', statuses: ['client_review'] },
  { key: 'revision', label: 'Revision', statuses: ['revision'] },
  { key: 'approved', label: 'Approved', statuses: ['approved', 'done'] },
];

const PortalBoardView: React.FC = () => {
  const { user } = usePortal();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<IPortalTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form] = Form.useForm();

  const loadTasks = useCallback(async () => {
    try {
      const res = await portalApi.getTasks();
      if (res.done && res.body) setTasks(res.body);
    } catch {
      message.error('Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) loadTasks();
  }, [user, loadTasks]);

  const handleCreate = async (values: { title: string; description?: string; priority?: string }) => {
    setCreating(true);
    try {
      const res = await portalApi.createTask(values);
      if (res.done && res.body) {
        setTasks(prev => [res.body!, ...prev]);
        setCreateOpen(false);
        form.resetFields();
        message.success('Task submitted');
      } else {
        message.error(res.message || 'Failed to create task');
      }
    } catch {
      message.error('Failed to create task');
    } finally {
      setCreating(false);
    }
  };

  const filtered = tasks.filter(t =>
    !search || t.title.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return <Flex justify="center" align="center" style={{ minHeight: 300 }}><Spin size="large" /></Flex>;
  }

  return (
    <div>
      <Flex justify="space-between" align="center" style={{ marginBottom: 24 }}>
        <Title level={3} style={{ margin: 0 }}>Tasks</Title>
        <Flex gap={12}>
          <Input
            prefix={<SearchOutlined />}
            placeholder="Search tasks..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width: 240 }}
            allowClear
          />
          {user?.role !== 'viewer' && (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
              New Task
            </Button>
          )}
        </Flex>
      </Flex>

      {/* Kanban columns */}
      <div style={{ display: 'flex', gap: 16, overflowX: 'auto', paddingBottom: 16 }}>
        {CLIENT_COLUMNS.map(col => {
          const colTasks = filtered.filter(t => col.statuses.includes(t.status));
          const statusCfg = getStatusConfig(col.statuses[0]);
          return (
            <div key={col.key} style={{ minWidth: 260, flex: 1 }}>
              <Flex align="center" gap={8} style={{ marginBottom: 12, padding: '0 4px' }}>
                <Badge color={statusCfg.color} />
                <Text strong>{col.label}</Text>
                <Text type="secondary" style={{ fontSize: 12 }}>({colTasks.length})</Text>
              </Flex>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {colTasks.length === 0 ? (
                  <Card size="small" style={{ opacity: 0.5 }}>
                    <Text type="secondary" style={{ fontSize: 13 }}>No tasks</Text>
                  </Card>
                ) : (
                  colTasks.map(task => (
                    <Card
                      key={task.id}
                      size="small"
                      hoverable
                      onClick={() => navigate(`/portal/tasks/${task.deliverable_id || task.id}`)}
                      style={{ cursor: 'pointer' }}
                    >
                      <Text strong style={{ fontSize: 14, display: 'block', marginBottom: 4 }}>
                        {task.title}
                      </Text>
                      <Flex justify="space-between" align="center">
                        <Flex gap={4}>
                          {task.priority && (
                            <Tag style={{ fontSize: 11, margin: 0 }}>{task.priority}</Tag>
                          )}
                          {task.type && (
                            <Tag style={{ fontSize: 11, margin: 0 }}>{task.type}</Tag>
                          )}
                        </Flex>
                        {task.comment_count > 0 && (
                          <Flex align="center" gap={2}>
                            <MessageOutlined style={{ fontSize: 12, color: '#8c8c8c' }} />
                            <Text type="secondary" style={{ fontSize: 12 }}>{task.comment_count}</Text>
                          </Flex>
                        )}
                      </Flex>
                    </Card>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Create task modal */}
      <Modal
        title="Submit New Task"
        open={createOpen}
        onCancel={() => { setCreateOpen(false); form.resetFields(); }}
        footer={null}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item name="title" label="Task Title" rules={[{ required: true, message: 'Please enter a title' }]}>
            <Input placeholder="What do you need?" maxLength={255} />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <TextArea rows={4} placeholder="Describe what you need in detail..." maxLength={5000} />
          </Form.Item>
          <Form.Item name="priority" label="Priority">
            <Select placeholder="Select priority" allowClear>
              <Select.Option value="low">Low</Select.Option>
              <Select.Option value="medium">Medium</Select.Option>
              <Select.Option value="high">High</Select.Option>
              <Select.Option value="urgent">Urgent</Select.Option>
            </Select>
          </Form.Item>
          <Flex justify="end" gap={8}>
            <Button onClick={() => { setCreateOpen(false); form.resetFields(); }}>Cancel</Button>
            <Button type="primary" htmlType="submit" loading={creating}>Submit Task</Button>
          </Flex>
        </Form>
      </Modal>
    </div>
  );
};

export default PortalBoardView;
