import React from 'react';
import { useTranslation } from 'react-i18next';
import { Card, Flex, Typography, Table, Tag, Button, AppstoreOutlined, PlusOutlined, MoreOutlined } from '@/shared/antd-imports';

const { Title, Text } = Typography;

// Fake service/creator names below stand in for real (untranslated) user data.
const SERVICES = [
  { key: '1', name: 'Business Website Development', createdBy: 'Ushani', status: 'Active', visibility: 'Visible', requests: 1 },
  { key: '2', name: 'Custom Logo Design', createdBy: 'Ushani', status: 'Active', visibility: 'Visible', requests: 0 },
  { key: '3', name: 'Game Design', createdBy: 'Chirath', status: 'Active', visibility: 'Visible', requests: 3 },
  { key: '4', name: 'Mobile App UI/UX Design', createdBy: 'Ushani', status: 'Active', visibility: 'Visible', requests: 0 },
  { key: '5', name: 'Monthly Bookkeeping Service', createdBy: 'Ushani', status: 'Active', visibility: 'Visible', requests: 0 },
  { key: '6', name: 'Personalized Travel Itinerary Planning', createdBy: 'Ushani', status: 'Active', visibility: 'Visible', requests: 0 },
];

const ClientPortalServicesPreviewMockup: React.FC = () => {
  const { t } = useTranslation(['client-portal-services', 'upgrade-preview']);

  const columns = [
    {
      title: t('nameColumn', { defaultValue: 'Name', ns: 'client-portal-services' }),
      dataIndex: 'name',
      render: (name: string) => <Text style={{ color: '#1677ff' }}>{name}</Text>,
    },
    { title: t('createdByColumn', { defaultValue: 'Created By', ns: 'client-portal-services' }), dataIndex: 'createdBy' },
    {
      title: t('statusColumn', { defaultValue: 'Status', ns: 'client-portal-services' }),
      dataIndex: 'status',
      render: () => (
        <Tag color="blue">{t('clientPortalMockups.services.statusActive', { ns: 'upgrade-preview', defaultValue: 'Active' })}</Tag>
      ),
    },
    {
      title: t('visibilityColumn', { defaultValue: 'Visibility', ns: 'client-portal-services' }),
      dataIndex: 'visibility',
      render: () => (
        <Tag color="green">{t('visibilityVisible', { defaultValue: 'Visible', ns: 'client-portal-services' })}</Tag>
      ),
    },
    { title: t('noOfRequestsColumn', { defaultValue: 'No. of Requests', ns: 'client-portal-services' }), dataIndex: 'requests' },
    {
      title: t('actionsColumn', { defaultValue: 'Actions', ns: 'client-portal-services' }),
      dataIndex: 'actions',
      render: () => <MoreOutlined />,
    },
  ];

  return (
    <Flex vertical gap={16}>
      <Flex justify="space-between" align="flex-start" wrap="wrap" gap={12}>
        <Flex align="center" gap={10}>
          <AppstoreOutlined style={{ fontSize: 18 }} />
          <div>
            <Title level={4} style={{ margin: 0 }}>
              {t('title', { defaultValue: 'Services', ns: 'client-portal-services' })}
            </Title>
            <Text type="secondary" style={{ fontSize: 13 }}>
              {t('description', { defaultValue: 'Manage your services and offerings', ns: 'client-portal-services' })}
            </Text>
          </div>
        </Flex>
        <Button type="primary" icon={<PlusOutlined />}>
          {t('addServiceButton', { defaultValue: 'Add Service', ns: 'client-portal-services' })}
        </Button>
      </Flex>

      <Card styles={{ body: { padding: 0 } }}>
        <Table columns={columns} dataSource={SERVICES} pagination={false} size="middle" />
      </Card>
    </Flex>
  );
};

export default ClientPortalServicesPreviewMockup;
