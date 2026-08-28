import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Card,
  Col,
  Row,
  Statistic,
  Table,
  Tag,
  Avatar,
  Button,
  Input,
  Flex,
  Typography,
  UserOutlined,
  TeamOutlined,
  ProjectOutlined,
  ShareAltOutlined,
  PlusOutlined,
  SearchOutlined,
  SyncOutlined,
  FilterOutlined,
  MoreOutlined,
} from '@/shared/antd-imports';

const { Title, Text } = Typography;

// Fake client/contact names below stand in for real (untranslated) user data.
const FAKE_CLIENTS = [
  { key: '1', name: 'Nimbus Retail Co.', email: undefined, contact: 'Amara Okafor', status: 'active', projects: 4 },
  { key: '2', name: 'Beacon Logistics', email: undefined, contact: 'Daniel Reyes', status: 'not_invited', projects: 2 },
  { key: '3', name: 'Solace Health Group', email: 'priya@solace.com', contact: 'Priya Nair', status: 'not_invited', projects: 1 },
  { key: '4', name: 'Vertex Manufacturing', email: undefined, contact: 'Liam Carter', status: 'expired', projects: 6 },
  { key: '5', name: 'Northwind Studio', email: undefined, contact: 'Sofia Marchetti', status: 'not_invited', projects: 0 },
];

const statusColor: Record<string, string> = {
  active: 'green',
  not_invited: 'default',
  expired: 'red',
};

const ClientsPreviewMockup: React.FC = () => {
  const { t } = useTranslation('client-portal-clients');
  const statusLabel: Record<string, string> = {
    active: t('portalStatus.active', { defaultValue: 'Active' }),
    not_invited: t('portalStatus.not_invited', { defaultValue: 'Not Invited' }),
    expired: t('portalStatus.expired', { defaultValue: 'Expired' }),
  };

  const columns = [
    {
      title: t('clientColumn', { defaultValue: 'Client' }),
      dataIndex: 'name',
      render: (name: string, row: (typeof FAKE_CLIENTS)[number]) => (
        <Flex align="center" gap={8}>
          <Avatar size={28} icon={<UserOutlined />} />
          <div>
            <Text style={{ fontWeight: 500 }}>{name}</Text>
            {row.email && <div style={{ fontSize: 11, opacity: 0.6 }}>{row.email}</div>}
          </div>
        </Flex>
      ),
    },
    { title: t('contactColumn', { defaultValue: 'Contact' }), dataIndex: 'contact' },
    {
      title: t('portalStatusColumn', { defaultValue: 'Portal Status' }),
      dataIndex: 'status',
      render: (status: string) => <Tag color={statusColor[status]}>{statusLabel[status]}</Tag>,
    },
    { title: t('assignedProjectsColumn', { defaultValue: 'Assigned Projects' }), dataIndex: 'projects' },
    {
      title: t('actionBtnsColumn', { defaultValue: 'Actions' }),
      dataIndex: 'actions',
      render: () => <MoreOutlined />,
    },
  ];

  return (
    <Flex vertical gap={16}>
      <Flex justify="space-between" align="flex-start" wrap="wrap" gap={12}>
        <Flex align="center" gap={10}>
          <UserOutlined style={{ fontSize: 18 }} />
          <div>
            <Title level={4} style={{ margin: 0 }}>
              {t('pageTitle', { defaultValue: 'Clients' })}
            </Title>
            <Text type="secondary" style={{ fontSize: 13 }}>
              {t('pageDescription', { defaultValue: 'Manage your clients and their access to the portal' })}
            </Text>
          </div>
        </Flex>
        <Flex gap={8}>
          <Button icon={<ShareAltOutlined />}>{t('inviteButton', { defaultValue: 'Send Invitation' })}</Button>
          <Button type="primary" icon={<PlusOutlined />}>
            {t('addClientButton', { defaultValue: 'Add Client' })}
          </Button>
        </Flex>
      </Flex>

      <Row gutter={16}>
        <Col xs={12} md={6}>
          <Card>
            <Statistic
              title={t('totalClientsLabel', { defaultValue: 'Total Clients' })}
              value={13}
              prefix={<UserOutlined />}
              valueStyle={{ color: '#1677ff' }}
            />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic
              title={t('activeClientsLabel', { defaultValue: 'Active Clients' })}
              value={2}
              prefix={<TeamOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic
              title={t('totalProjectsLabel', { defaultValue: 'Total Projects' })}
              value={16}
              prefix={<ProjectOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic
              title={t('totalTeamMembersLabel', { defaultValue: 'Team Members' })}
              value={0}
              prefix={<TeamOutlined />}
              valueStyle={{ color: '#eb2f96' }}
            />
          </Card>
        </Col>
      </Row>

      <Card styles={{ body: { padding: 16 } }}>
        <Flex gap={8} wrap="wrap" style={{ marginBottom: 12 }}>
          <Input
            placeholder={t('searchClientsPlaceholder', { defaultValue: 'Search clients...' })}
            prefix={<SearchOutlined />}
            style={{ width: 220 }}
          />
          <Button icon={<FilterOutlined />}>{t('statusAll', { defaultValue: 'All' })}</Button>
          <Button icon={<SyncOutlined />}>{t('refreshButton', { defaultValue: 'Refresh' })}</Button>
          <Button icon={<FilterOutlined />}>{t('clearFiltersButton', { defaultValue: 'Clear Filters' })}</Button>
        </Flex>
        <Table columns={columns} dataSource={FAKE_CLIENTS} pagination={false} size="middle" />
      </Card>
    </Flex>
  );
};

export default ClientsPreviewMockup;
