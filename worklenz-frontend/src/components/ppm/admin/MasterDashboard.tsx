// PPM-OVERRIDE: Phase 2 — Master dashboard with stats, client health, and approval badge
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Row, Col, Statistic, Typography, Table, Badge, Flex, Spin, message, Button, Tag } from 'antd';
import {
  TeamOutlined, CheckCircleOutlined, ClockCircleOutlined, ExclamationCircleOutlined,
  ArrowRightOutlined,
} from '@ant-design/icons';
import { adminApi, IDashboardStats, IClientHealth } from './admin-api';

const { Title, Text } = Typography;

const MasterDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<IDashboardStats | null>(null);
  const [clients, setClients] = useState<IClientHealth[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const [statsRes, clientsRes] = await Promise.all([
        adminApi.getStats(),
        adminApi.getClientHealth(),
      ]);
      if (statsRes.done && statsRes.body) setStats(statsRes.body);
      if (clientsRes.done && clientsRes.body) setClients(clientsRes.body);
    } catch {
      message.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return <Flex justify="center" align="center" style={{ minHeight: 400 }}><Spin size="large" /></Flex>;
  }

  const columns = [
    {
      title: 'Client',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: IClientHealth) => (
        <Button type="link" onClick={() => navigate(`/taskflow/ppm/clients/${record.id}`)} style={{ padding: 0 }}>
          {name}
        </Button>
      ),
    },
    {
      title: 'Primary Partner',
      dataIndex: 'primary_partner',
      key: 'primary_partner',
      render: (v: string | null) => v || <Text type="secondary">—</Text>,
    },
    {
      title: 'Active Tasks',
      dataIndex: 'active_tasks',
      key: 'active_tasks',
      sorter: (a: IClientHealth, b: IClientHealth) => a.active_tasks - b.active_tasks,
    },
    {
      title: 'Utilization',
      dataIndex: 'utilization',
      key: 'utilization',
      render: (v: number | null) => {
        if (v == null) return <Text type="secondary">—</Text>;
        const color = v > 100 ? '#f5222d' : v > 80 ? '#fa8c16' : '#52c41a';
        return <Tag color={color}>{v}%</Tag>;
      },
      sorter: (a: IClientHealth, b: IClientHealth) => (a.utilization ?? 0) - (b.utilization ?? 0),
    },
  ];

  return (
    <div>
      <Flex justify="space-between" align="center" style={{ marginBottom: 24 }}>
        <Title level={3} style={{ margin: 0 }}>PPM Dashboard</Title>
        <Flex gap={8}>
          <Button onClick={() => navigate('/taskflow/ppm/approvals')}>
            Approval Queue
            {stats && stats.pending_approvals > 0 && (
              <Badge count={stats.pending_approvals} size="small" style={{ marginLeft: 8 }} />
            )}
          </Button>
          <Button onClick={() => navigate('/taskflow/ppm/pipeline')}>Pipeline</Button>
        </Flex>
      </Flex>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="Total Clients"
              value={stats?.total_clients ?? 0}
              prefix={<TeamOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="Active Deliverables"
              value={stats?.active_deliverables ?? 0}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="Pending Approvals"
              value={stats?.pending_approvals ?? 0}
              prefix={<ClockCircleOutlined />}
              valueStyle={stats?.pending_approvals ? { color: '#fa8c16' } : undefined}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="Overdue Items"
              value={stats?.overdue_items ?? 0}
              prefix={<ExclamationCircleOutlined />}
              valueStyle={stats?.overdue_items ? { color: '#f5222d' } : undefined}
            />
          </Card>
        </Col>
      </Row>

      <Card
        title="Client Health"
        extra={
          <Button type="link" onClick={() => navigate('/taskflow/ppm/clients')} icon={<ArrowRightOutlined />}>
            Manage Clients
          </Button>
        }
      >
        <Table
          dataSource={clients}
          columns={columns}
          rowKey="id"
          pagination={false}
          size="small"
        />
      </Card>
    </div>
  );
};

export default MasterDashboard;
