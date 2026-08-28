import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Card,
  Col,
  Row,
  Statistic,
  Table,
  Progress,
  Flex,
  Typography,
  ClockCircleOutlined,
  FieldTimeOutlined,
  DollarOutlined,
} from '@/shared/antd-imports';

const { Text } = Typography;

// Fake team-member names below stand in for real (untranslated) user data.
const FAKE_MEMBERS = [
  { key: '1', name: 'Amara Okafor', billable: 132, total: 160 },
  { key: '2', name: 'Daniel Reyes', billable: 98, total: 152 },
  { key: '3', name: 'Priya Nair', billable: 121, total: 148 },
  { key: '4', name: 'Liam Carter', billable: 74, total: 140 },
];

const BillableTimePreviewMockup: React.FC = () => {
  const { t } = useTranslation('upgrade-preview');
  const tp = (key: string, defaultValue: string) => t(`financeMockups.billableTime.${key}`, { defaultValue });

  const columns = [
    { title: tp('teamMemberColumn', 'Team Member'), dataIndex: 'name' },
    {
      title: tp('billableHoursColumn', 'Billable Hours'),
      dataIndex: 'billable',
      render: (billable: number, row: (typeof FAKE_MEMBERS)[number]) =>
        `${billable}h / ${row.total}h`,
    },
    {
      title: tp('billablePercent', 'Billable %'),
      dataIndex: 'billable',
      render: (billable: number, row: (typeof FAKE_MEMBERS)[number]) => {
        const pct = Math.round((billable / row.total) * 100);
        return (
          <Flex align="center" gap={8}>
            <Progress percent={pct} size="small" showInfo={false} style={{ width: 90 }} />
            <Text>{pct}%</Text>
          </Flex>
        );
      },
    },
  ];

  return (
    <Flex vertical gap={24}>
      <Row gutter={16}>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title={tp('billableHours', 'Billable Hours')} value={425} suffix="h" prefix={<ClockCircleOutlined />} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title={tp('nonBillableHours', 'Non-Billable Hours')} value={175} suffix="h" prefix={<FieldTimeOutlined />} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic
              title={tp('billablePercent', 'Billable %')}
              value={71}
              suffix="%"
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title={tp('billableRevenue', 'Billable Revenue')} value={53400} prefix={<DollarOutlined />} />
          </Card>
        </Col>
      </Row>

      <Card title={tp('byTeamMemberCard', 'Billable Time by Team Member')}>
        <Table columns={columns} dataSource={FAKE_MEMBERS} pagination={false} size="middle" />
      </Card>
    </Flex>
  );
};

export default BillableTimePreviewMockup;
