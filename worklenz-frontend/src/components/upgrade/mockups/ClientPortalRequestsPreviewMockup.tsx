import React from 'react';
import { useTranslation } from 'react-i18next';
import { Card, Flex, Typography, Table, Tag, FileOutlined } from '@/shared/antd-imports';

const { Title, Text } = Typography;

// Fake client/title data below stands in for real (untranslated) user data.
const REQUESTS = [
  { key: '1', no: 'REQ-BUSINE-0001', title: 'Create a web site', service: 'Business Website Development', client: 'Dean Browse', status: 'Accepted', created: '2 months ago' },
  { key: '2', no: 'REQ-GAMEDE-0001', title: 'Angry Bird', service: 'Game Design', client: 'Wushi', status: 'Pending', created: '2 months ago' },
  { key: '3', no: 'REQ-GAMEDE-0002', title: 'Test', service: 'Game Design', client: 'Wushi', status: 'Pending', created: '2 months ago' },
  { key: '4', no: 'REQ-GAMEDE-0003', title: 'Test 2', service: 'Game Design', client: 'Wushi', status: 'Pending', created: '2 months ago' },
];

const statusColor: Record<string, string> = {
  Accepted: 'blue',
  Pending: 'gold',
  Rejected: 'red',
};

const ClientPortalRequestsPreviewMockup: React.FC = () => {
  const { t } = useTranslation(['client-portal-requests', 'upgrade-preview']);
  const statusLabel: Record<string, string> = {
    Accepted: t('clientPortalMockups.requests.statusAccepted', { ns: 'upgrade-preview', defaultValue: 'Accepted' }),
    Pending: t('clientPortalMockups.requests.statusPending', { ns: 'upgrade-preview', defaultValue: 'Pending' }),
    Rejected: t('clientPortalMockups.requests.statusRejected', { ns: 'upgrade-preview', defaultValue: 'Rejected' }),
  };

  const columns = [
    { title: t('reqNoColumn', { defaultValue: 'Request No' }), dataIndex: 'no' },
    { title: t('titleLabel', { defaultValue: 'Title' }), dataIndex: 'title' },
    { title: t('serviceColumn', { defaultValue: 'Service' }), dataIndex: 'service' },
    { title: t('clientColumn', { defaultValue: 'Client' }), dataIndex: 'client' },
    {
      title: t('statusColumn', { defaultValue: 'Status' }),
      dataIndex: 'status',
      render: (status: string) => <Tag color={statusColor[status]}>{statusLabel[status]}</Tag>,
    },
    { title: t('createdAtLabel', { defaultValue: 'Created At' }), dataIndex: 'created' },
  ];

  return (
    <Flex vertical gap={16}>
      <Flex align="center" gap={10}>
        <FileOutlined style={{ fontSize: 18 }} />
        <div>
          <Title level={4} style={{ margin: 0 }}>
            {t('title', { defaultValue: 'Requests' })}
          </Title>
          <Text type="secondary" style={{ fontSize: 13 }}>
            {t('description', { defaultValue: 'Manage and track client requests' })}
          </Text>
        </div>
      </Flex>

      <Card styles={{ body: { padding: 0 } }}>
        <Table columns={columns} dataSource={REQUESTS} pagination={false} size="middle" />
      </Card>
    </Flex>
  );
};

export default ClientPortalRequestsPreviewMockup;
