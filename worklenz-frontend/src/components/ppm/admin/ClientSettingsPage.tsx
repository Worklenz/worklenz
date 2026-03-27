// PPM-OVERRIDE: Phase 2 — Client settings page with tabs for users, partners, projects
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card, Typography, Tabs, Flex, Spin, message, Button, Table, Modal, Form, Input, Select, Popconfirm, Tag, Empty,
} from 'antd';
import {
  ArrowLeftOutlined, PlusOutlined, DeleteOutlined, StarOutlined, StarFilled,
} from '@ant-design/icons';
import {
  adminApi, IPPMClient, IPPMClientUser, IPPMPartner, IPPMClientProject,
} from './admin-api';

const { Title, Text } = Typography;

// ─── Users Tab ───
const ClientUsersTab: React.FC<{ clientId: string }> = ({ clientId }) => {
  const [users, setUsers] = useState<IPPMClientUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [form] = Form.useForm();

  const load = useCallback(async () => {
    try {
      const res = await adminApi.getClientUsers(clientId);
      if (res.done && res.body) setUsers(res.body);
    } catch { message.error('Failed to load users'); }
    finally { setLoading(false); }
  }, [clientId]);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async (values: { email: string; display_name?: string; role?: string }) => {
    setAdding(true);
    try {
      const res = await adminApi.addClientUser(clientId, values);
      if (res.done) { load(); setAddOpen(false); form.resetFields(); message.success('User added'); }
      else message.error(res.message || 'Failed to add user');
    } catch { message.error('Failed to add user'); }
    finally { setAdding(false); }
  };

  const handleRemove = async (userId: string) => {
    try {
      const res = await adminApi.removeClientUser(clientId, userId);
      if (res.done) { setUsers(prev => prev.filter(u => u.id !== userId)); message.success('User removed'); }
    } catch { message.error('Failed to remove user'); }
  };

  const columns = [
    { title: 'Email', dataIndex: 'email', key: 'email' },
    { title: 'Name', dataIndex: 'display_name', key: 'display_name', render: (v: string | null) => v || '—' },
    {
      title: 'Role', dataIndex: 'role', key: 'role',
      render: (v: string) => <Tag>{v}</Tag>,
    },
    {
      title: 'Status', key: 'status',
      render: (_: any, r: IPPMClientUser) => r.deactivated_at ? <Tag color="red">Deactivated</Tag> : <Tag color="green">Active</Tag>,
    },
    {
      title: '', key: 'actions', width: 60,
      render: (_: any, r: IPPMClientUser) => (
        <Popconfirm title="Remove this user?" onConfirm={() => handleRemove(r.id)}>
          <Button type="text" danger icon={<DeleteOutlined />} size="small" />
        </Popconfirm>
      ),
    },
  ];

  return (
    <div>
      <Flex justify="end" style={{ marginBottom: 12 }}>
        <Button type="primary" icon={<PlusOutlined />} size="small" onClick={() => setAddOpen(true)}>Add User</Button>
      </Flex>
      <Table dataSource={users} columns={columns} rowKey="id" pagination={false} size="small" loading={loading} />
      <Modal title="Add Client User" open={addOpen} onCancel={() => { setAddOpen(false); form.resetFields(); }} footer={null} destroyOnClose>
        <Form form={form} layout="vertical" onFinish={handleAdd}>
          <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email' }]}>
            <Input placeholder="user@client.com" />
          </Form.Item>
          <Form.Item name="display_name" label="Display Name">
            <Input placeholder="Optional" />
          </Form.Item>
          <Form.Item name="role" label="Role" initialValue="viewer">
            <Select>
              <Select.Option value="viewer">Viewer</Select.Option>
              <Select.Option value="reviewer">Reviewer</Select.Option>
              <Select.Option value="admin">Admin</Select.Option>
            </Select>
          </Form.Item>
          <Flex justify="end" gap={8}>
            <Button onClick={() => { setAddOpen(false); form.resetFields(); }}>Cancel</Button>
            <Button type="primary" htmlType="submit" loading={adding}>Add</Button>
          </Flex>
        </Form>
      </Modal>
    </div>
  );
};

// ─── Partners Tab ───
const ClientPartnersTab: React.FC<{ clientId: string }> = ({ clientId }) => {
  const [partners, setPartners] = useState<IPPMPartner[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await adminApi.getClientPartners(clientId);
      if (res.done && res.body) setPartners(res.body);
    } catch { message.error('Failed to load partners'); }
    finally { setLoading(false); }
  }, [clientId]);

  useEffect(() => { load(); }, [load]);

  const handleRemove = async (partnerId: string) => {
    try {
      const res = await adminApi.removeClientPartner(clientId, partnerId);
      if (res.done) { setPartners(prev => prev.filter(p => p.partner_id !== partnerId)); message.success('Partner removed'); }
    } catch { message.error('Failed to remove partner'); }
  };

  const columns = [
    { title: 'Name', dataIndex: 'name', key: 'name' },
    { title: 'Email', dataIndex: 'email', key: 'email' },
    { title: 'Role', dataIndex: 'role', key: 'role', render: (v: string) => <Tag>{v}</Tag> },
    {
      title: '', key: 'actions', width: 60,
      render: (_: any, r: IPPMPartner) => (
        <Popconfirm title="Remove this partner?" onConfirm={() => handleRemove(r.partner_id)}>
          <Button type="text" danger icon={<DeleteOutlined />} size="small" />
        </Popconfirm>
      ),
    },
  ];

  return (
    <Table dataSource={partners} columns={columns} rowKey="partner_id" pagination={false} size="small" loading={loading} />
  );
};

// ─── Projects Tab ───
const ClientProjectsTab: React.FC<{ clientId: string }> = ({ clientId }) => {
  const [projects, setProjects] = useState<IPPMClientProject[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await adminApi.getClientProjects(clientId);
      if (res.done && res.body) setProjects(res.body);
    } catch { message.error('Failed to load projects'); }
    finally { setLoading(false); }
  }, [clientId]);

  useEffect(() => { load(); }, [load]);

  const handleSetPrimary = async (projectId: string) => {
    try {
      const res = await adminApi.setPrimaryProject(clientId, projectId);
      if (res.done) { load(); message.success('Primary project updated'); }
    } catch { message.error('Failed to set primary'); }
  };

  const handleUnlink = async (projectId: string) => {
    try {
      const res = await adminApi.unlinkProject(clientId, projectId);
      if (res.done) { setProjects(prev => prev.filter(p => p.project_id !== projectId)); message.success('Project unlinked'); }
    } catch { message.error('Failed to unlink project'); }
  };

  const columns = [
    { title: 'Project', dataIndex: 'project_name', key: 'project_name' },
    {
      title: 'Primary', key: 'primary', width: 80,
      render: (_: any, r: IPPMClientProject) =>
        r.is_primary
          ? <StarFilled style={{ color: '#faad14' }} />
          : <Button type="text" icon={<StarOutlined />} size="small" onClick={() => handleSetPrimary(r.project_id)} />,
    },
    {
      title: '', key: 'actions', width: 60,
      render: (_: any, r: IPPMClientProject) => (
        <Popconfirm title="Unlink this project?" onConfirm={() => handleUnlink(r.project_id)}>
          <Button type="text" danger icon={<DeleteOutlined />} size="small" />
        </Popconfirm>
      ),
    },
  ];

  return (
    <Table dataSource={projects} columns={columns} rowKey="project_id" pagination={false} size="small" loading={loading} />
  );
};

// ─── Main Page ───
const ClientSettingsPage: React.FC = () => {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const [client, setClient] = useState<IPPMClient | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!clientId) return;
    adminApi.getClient(clientId)
      .then(res => { if (res.done && res.body) setClient(res.body); })
      .catch(() => message.error('Failed to load client'))
      .finally(() => setLoading(false));
  }, [clientId]);

  if (loading) {
    return <Flex justify="center" align="center" style={{ minHeight: 400 }}><Spin size="large" /></Flex>;
  }

  if (!client || !clientId) {
    return <Empty description="Client not found" />;
  }

  return (
    <div>
      <Flex align="center" gap={12} style={{ marginBottom: 24 }}>
        <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate('/taskflow/ppm')} />
        <Title level={3} style={{ margin: 0 }}>{client.name}</Title>
        {client.is_active ? <Tag color="green">Active</Tag> : <Tag color="red">Inactive</Tag>}
      </Flex>

      <Card>
        <Tabs
          defaultActiveKey="users"
          items={[
            { key: 'users', label: 'Users', children: <ClientUsersTab clientId={clientId} /> },
            { key: 'partners', label: 'Partners', children: <ClientPartnersTab clientId={clientId} /> },
            { key: 'projects', label: 'Projects', children: <ClientProjectsTab clientId={clientId} /> },
          ]}
        />
      </Card>
    </div>
  );
};

export default ClientSettingsPage;
