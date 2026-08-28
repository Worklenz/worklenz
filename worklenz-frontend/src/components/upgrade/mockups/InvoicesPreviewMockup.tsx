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
  DollarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
} from '@/shared/antd-imports';

// Fake client/invoice-number data below stands in for real (untranslated)
// user data — only the surrounding UI chrome (labels, headers) is translated.
const FAKE_INVOICES = [
  { key: '1', number: 'INV-1042', client: 'Nimbus Retail Co.', amount: '$12,400', status: 'Paid' },
  { key: '2', number: 'INV-1043', client: 'Beacon Logistics', amount: '$8,200', status: 'Pending' },
  { key: '3', number: 'INV-1044', client: 'Solace Health Group', amount: '$5,600', status: 'Overdue' },
  { key: '4', number: 'INV-1045', client: 'Vertex Manufacturing', amount: '$19,900', status: 'Paid' },
];

const statusColor: Record<string, string> = {
  Paid: 'green',
  Pending: 'gold',
  Overdue: 'red',
};

const InvoicesPreviewMockup: React.FC = () => {
  const { t } = useTranslation('upgrade-preview');
  const tp = (key: string, defaultValue: string) => t(`financeMockups.invoices.${key}`, { defaultValue });

  const statusLabel: Record<string, string> = {
    Paid: tp('paid', 'Paid'),
    Pending: tp('pending', 'Pending'),
    Overdue: tp('overdue', 'Overdue'),
  };

  const columns = [
    { title: tp('invoiceNoColumn', 'Invoice #'), dataIndex: 'number' },
    { title: tp('clientColumn', 'Client'), dataIndex: 'client' },
    { title: tp('amountColumn', 'Amount'), dataIndex: 'amount' },
    {
      title: tp('statusColumn', 'Status'),
      dataIndex: 'status',
      render: (status: string) => <Tag color={statusColor[status]}>{statusLabel[status]}</Tag>,
    },
  ];

  return (
    <Flex vertical gap={24}>
      <Row gutter={16}>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title={tp('totalInvoiced', 'Total Invoiced')} value={46100} prefix={<DollarOutlined />} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic
              title={statusLabel.Paid}
              value={32300}
              valueStyle={{ color: '#52c41a' }}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic
              title={statusLabel.Pending}
              value={8200}
              valueStyle={{ color: '#faad14' }}
              prefix={<ClockCircleOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic
              title={statusLabel.Overdue}
              value={5600}
              valueStyle={{ color: '#ff4d4f' }}
              prefix={<ExclamationCircleOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <Card title={tp('invoicesCard', 'Invoices')}>
        <Table columns={columns} dataSource={FAKE_INVOICES} pagination={false} size="middle" />
      </Card>
    </Flex>
  );
};

export default InvoicesPreviewMockup;
