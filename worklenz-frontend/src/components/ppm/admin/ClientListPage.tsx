// PPM-OVERRIDE: Phase 2 — Client list page for admin
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card, Table, Typography, Flex, Spin, message, Button, Modal, Form, Input, Tag,
} from 'antd';
import { PlusOutlined, ArrowLeftOutlined, SettingOutlined } from '@ant-design/icons';
import { adminApi, IPPMClient } from './admin-api';

const { Title } = Typography;

const ClientListPage: React.FC = () => {
  const navigate = useNavigate();
  const [clients, setClients] = useState<IPPMClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form] = Form.useForm();

  const load = useCallback(async () => {
    try {
      const res = await adminApi.getClients();
      if (res.done && res.body) setClients(res.body);
    } catch { message.error('Failed to load clients'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (values: { name: string }) => {
    setCreating(true);
    try {
      const res = await adminApi.createClient(values);
      if (res.done) {
        load();
        setCreateOpen(false);
        form.resetFields();
        message.success('Client created');
      } else {
        message.error(res.message || 'Failed to create client');
      }
    } catch { message.error('Failed to create client'); }
    finally { setCreating(false); }
  };

  const columns = [
    {
      title: 'Name', dataIndex: 'name', key: 'name',
      render: (name: string, r: IPPMClient) => (
        <Button type="link" onClick={() => navigate(`/taskflow/ppm/clients/${r.id}`)} style={{ padding: 0 }}>
          {name}
        </Button>
      ),
    },
    {
      title: 'Status', key: 'status',
      render: (_: any, r: IPPMClient) => r.is_active ? <Tag color="green">Active</Tag> : <Tag color="red">Inactive</Tag>,
    },
    {
      title: 'Created', dataIndex: 'created_at', key: 'created_at',
      render: (v: string) => new Date(v).toLocaleDateString(),
    },
    {
      title: '', key: 'actions', width: 60,
      render: (_: any, r: IPPMClient) => (
        <Button type="text" icon={<SettingOutlined />} size="small" onClick={() => navigate(`/taskflow/ppm/clients/${r.id}`)} />
      ),
    },
  ];

  return (
    <div>
      <Flex align="center" gap={12} style={{ marginBottom: 24 }}>
        <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate('/taskflow/ppm')} />
        <Title level={3} style={{ margin: 0 }}>Clients</Title>
      </Flex>

      <Card
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
            New Client
          </Button>
        }
      >
        <Table dataSource={clients} columns={columns} rowKey="id" pagination={false} size="middle" loading={loading} />
      </Card>

      <Modal title="Create Client" open={createOpen} onCancel={() => { setCreateOpen(false); form.resetFields(); }} footer={null} destroyOnClose>
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item name="name" label="Client Name" rules={[{ required: true, message: 'Enter a name' }]}>
            <Input placeholder="e.g. Acme Corp" />
          </Form.Item>
          <Flex justify="end" gap={8}>
            <Button onClick={() => { setCreateOpen(false); form.resetFields(); }}>Cancel</Button>
            <Button type="primary" htmlType="submit" loading={creating}>Create</Button>
          </Flex>
        </Form>
      </Modal>
    </div>
  );
};

export default ClientListPage;
