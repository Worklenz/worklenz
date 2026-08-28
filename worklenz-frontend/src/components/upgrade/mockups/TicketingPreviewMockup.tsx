import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Card,
  Col,
  Row,
  Statistic,
  Table,
  Tag,
  Flex,
  TagOutlined,
  SyncOutlined,
  CheckCircleOutlined,
  FieldTimeOutlined,
} from '@/shared/antd-imports';

// Fake client/subject data below stands in for real (untranslated) user data.
const FAKE_TICKETS = [
  { key: '1', number: 'TCK-201', client: 'Nimbus Retail Co.', subject: 'Checkout page error', priority: 'High', status: 'Open' },
  { key: '2', number: 'TCK-202', client: 'Beacon Logistics', subject: 'Add new team member', priority: 'Low', status: 'In Progress' },
  { key: '3', number: 'TCK-203', client: 'Solace Health Group', subject: 'Invoice discrepancy', priority: 'Medium', status: 'Open' },
  { key: '4', number: 'TCK-204', client: 'Vertex Manufacturing', subject: 'Portal access request', priority: 'Low', status: 'Resolved' },
];

const priorityColor: Record<string, string> = {
  High: 'red',
  Medium: 'gold',
  Low: 'blue',
};

const statusColor: Record<string, string> = {
  Open: 'orange',
  'In Progress': 'geekblue',
  Resolved: 'green',
};

const TicketingPreviewMockup: React.FC = () => {
  const { t } = useTranslation('upgrade-preview');
  const tk = (key: string, defaultValue: string) => t(`ticketingMockup.${key}`, { defaultValue });

  const priorityLabel: Record<string, string> = {
    High: tk('priorityHigh', 'High'),
    Medium: tk('priorityMedium', 'Medium'),
    Low: tk('priorityLow', 'Low'),
  };
  const statusLabel: Record<string, string> = {
    Open: tk('statusOpen', 'Open'),
    'In Progress': tk('inProgress', 'In Progress'),
    Resolved: tk('statusResolved', 'Resolved'),
  };

  const columns = [
    { title: tk('ticketNoColumn', 'Ticket #'), dataIndex: 'number' },
    { title: tk('clientColumn', 'Client'), dataIndex: 'client' },
    { title: tk('subjectColumn', 'Subject'), dataIndex: 'subject' },
    {
      title: tk('priorityColumn', 'Priority'),
      dataIndex: 'priority',
      render: (priority: string) => <Tag color={priorityColor[priority]}>{priorityLabel[priority]}</Tag>,
    },
    {
      title: tk('statusColumn', 'Status'),
      dataIndex: 'status',
      render: (status: string) => <Tag color={statusColor[status]}>{statusLabel[status]}</Tag>,
    },
  ];

  return (
    <Flex vertical gap={24}>
      <Row gutter={16}>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title={tk('openTickets', 'Open Tickets')} value={7} prefix={<TagOutlined />} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title={tk('inProgress', 'In Progress')} value={3} prefix={<SyncOutlined />} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic
              title={tk('resolvedToday', 'Resolved Today')}
              value={5}
              valueStyle={{ color: '#52c41a' }}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title={tk('avgResponseTime', 'Avg. Response Time')} value={2.4} suffix="h" prefix={<FieldTimeOutlined />} />
          </Card>
        </Col>
      </Row>

      <Card title={tk('ticketsCard', 'Tickets')}>
        <Table columns={columns} dataSource={FAKE_TICKETS} pagination={false} size="middle" />
      </Card>
    </Flex>
  );
};

export default TicketingPreviewMockup;
