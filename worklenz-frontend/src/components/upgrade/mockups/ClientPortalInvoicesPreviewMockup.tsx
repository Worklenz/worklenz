import React from 'react';
import { useTranslation } from 'react-i18next';
import { Card, Flex, Typography, Table, Tag, Button, FileOutlined, PlusOutlined } from '@/shared/antd-imports';

const { Title, Text } = Typography;

// Fake client/amount data below stands in for real (untranslated) user data.
const INVOICES = [
  { key: '1', number: 'INV-1042', client: 'Nimbus Retail Co.', amount: '$12,400', status: 'Paid', due: 'Jul 05, 2026' },
  { key: '2', number: 'INV-1043', client: 'Beacon Logistics', amount: '$8,200', status: 'Pending', due: 'Jul 18, 2026' },
  { key: '3', number: 'INV-1044', client: 'Solace Health Group', amount: '$5,600', status: 'Overdue', due: 'Jun 30, 2026' },
  { key: '4', number: 'INV-1045', client: 'Vertex Manufacturing', amount: '$19,900', status: 'Paid', due: 'Jun 22, 2026' },
  { key: '5', number: 'INV-1046', client: 'Northwind Studio', amount: '$3,150', status: 'Pending', due: 'Aug 02, 2026' },
];

const statusColor: Record<string, string> = {
  Paid: 'green',
  Pending: 'gold',
  Overdue: 'red',
};

const ClientPortalInvoicesPreviewMockup: React.FC = () => {
  const { t } = useTranslation('client-portal-invoices');

  const statusLabel: Record<string, string> = {
    Paid: t('statusPaid', { defaultValue: 'Paid' }),
    Pending: t('statusPending', { defaultValue: 'Pending' }),
    Overdue: t('statusOverdue', { defaultValue: 'Overdue' }),
  };

  const columns = [
    { title: t('invoiceNoColumn', { defaultValue: 'Invoice #' }), dataIndex: 'number' },
    { title: t('clientColumn', { defaultValue: 'Client' }), dataIndex: 'client' },
    { title: t('amountColumn', { defaultValue: 'Amount' }), dataIndex: 'amount' },
    {
      title: t('statusColumn', { defaultValue: 'Status' }),
      dataIndex: 'status',
      render: (status: string) => <Tag color={statusColor[status]}>{statusLabel[status]}</Tag>,
    },
    { title: t('dueDateColumn', { defaultValue: 'Due Date' }), dataIndex: 'due' },
  ];

  return (
    <Flex vertical gap={16}>
      <Flex justify="space-between" align="flex-start" wrap="wrap" gap={12}>
        <Flex align="center" gap={10}>
          <FileOutlined style={{ fontSize: 18 }} />
          <div>
            <Title level={4} style={{ margin: 0 }}>
              {t('title', { defaultValue: 'Invoices' })}
            </Title>
            <Text type="secondary" style={{ fontSize: 13 }}>
              {t('description', { defaultValue: 'Manage and track your invoices' })}
            </Text>
          </div>
        </Flex>
        <Button type="primary" icon={<PlusOutlined />}>
          {t('addInvoiceButton', { defaultValue: 'Add Invoice' })}
        </Button>
      </Flex>

      <Card styles={{ body: { padding: 0 } }}>
        <Table columns={columns} dataSource={INVOICES} pagination={false} size="middle" />
      </Card>
    </Flex>
  );
};

export default ClientPortalInvoicesPreviewMockup;
