import {
  Button,
  Card,
  Flex,
  Table,
  Typography,
  Tag,
  Spin,
  Alert,
  Empty,
} from '@/shared/antd-imports';
import { TableProps } from 'antd/lib';
import { useTranslation } from 'react-i18next';
import { colors } from '../../../../styles/colors';
import { useNavigate } from 'react-router-dom';
import { useGetInvoicesQuery } from '../../../../api/client-portal/client-portal-api';
import { PlusOutlined } from '@ant-design/icons';

const InvoicesTable = () => {
  // localization
  const { t } = useTranslation('client-portal-invoices');
  const navigate = useNavigate();

  // Fetch invoices from API
  const {
    data: invoicesData,
    isLoading,
    error,
  } = useGetInvoicesQuery();

  // Function to get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'success';
      case 'pending':
        return 'warning';
      case 'overdue':
        return 'error';
      case 'cancelled':
        return 'default';
      default:
        return 'default';
    }
  };

  // Function to get status text
  const getStatusText = (status: string) => {
    switch (status) {
      case 'paid':
        return t('statusPaid');
      case 'pending':
        return t('statusPending');
      case 'overdue':
        return t('statusOverdue');
      case 'cancelled':
        return t('statusCancelled');
      default:
        return status;
    }
  };

  // Handle loading state
  if (isLoading) {
    return (
      <Card style={{ height: 'calc(100vh - 280px)' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '200px',
          }}
        >
          <Spin size="large" />
        </div>
      </Card>
    );
  }

  // Handle error state
  if (error) {
    return (
      <Card style={{ height: 'calc(100vh - 280px)' }}>
        <Alert
          message={t('errorLoadingInvoices')}
          description={t('errorLoadingInvoicesDescription')}
          type="error"
          showIcon
        />
      </Card>
    );
  }

  // Extract invoices from API response - backend returns IServerResponse with {total, data} structure
  const invoicesResponse =
    invoicesData?.body || {
      total: 0,
      page: 1,
      limit: 10,
      invoices: [],
    };
  const invoices = invoicesResponse.invoices || [];

  // Handle empty state
  if (!invoices || invoices.length === 0) {
    return (
      <Card style={{ height: 'calc(100vh - 280px)' }}>
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            <div>
              <Typography.Title level={4} style={{ marginBottom: 8 }}>
                {t('noInvoicesTitle')}
              </Typography.Title>
              <Typography.Text type="secondary">{t('noInvoicesDescription')}</Typography.Text>
            </div>
          }
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            height: 'calc(100vh - 320px)',
          }}
        >
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => navigate('/worklenz/client-portal/invoices/create')}
          >
            {t('addInvoiceButton')}
          </Button>
        </Empty>
      </Card>
    );
  }

  // Sort invoices by created date (newest first)
  const sortedInvoices = [...invoices].sort((a, b) => {
    const dateA = new Date(a.createdAt).getTime();
    const dateB = new Date(b.createdAt).getTime();
    return dateB - dateA;
  });

  // table columns
  const columns: TableProps['columns'] = [
    {
      key: 'invoice_no',
      title: t('invoiceNoColumn'),
      render: record => (
        <Typography.Text strong style={{ color: colors.skyBlue }}>
          {record.invoiceNumber}
        </Typography.Text>
      ),
      onCell: () => ({
        style: { minWidth: 150 },
      }),
    },
    {
      key: 'client',
      title: t('clientColumn'),
      render: record => <Typography.Text>{record.clientName || '-'}</Typography.Text>,
      onCell: () => ({
        style: { minWidth: 200 },
      }),
    },
    {
      key: 'service',
      title: t('serviceColumn'),
      render: record => <Typography.Text>{record.serviceName || '-'}</Typography.Text>,
      onCell: () => ({
        style: { minWidth: 200 },
      }),
    },
    {
      key: 'amount',
      title: t('amountColumn'),
      render: record => (
        <Typography.Text>
          {record.currency} {record.amount.toFixed(2)}
        </Typography.Text>
      ),
      onCell: () => ({
        style: { minWidth: 130 },
      }),
    },
    {
      key: 'status',
      title: t('statusColumn'),
      render: record => (
        <Tag color={getStatusColor(record.status)}>{getStatusText(record.status)}</Tag>
      ),
      width: 120,
    },
    {
      key: 'created_at',
      title: t('createdDateColumn'),
      render: record => (
        <Typography.Text>
          {record.createdAt ? new Date(record.createdAt).toLocaleDateString() : '-'}
        </Typography.Text>
      ),
      width: 130,
    },
    {
      key: 'due_date',
      title: t('dueDateColumn'),
      render: record => (
        <Typography.Text>
          {record.dueDate ? new Date(record.dueDate).toLocaleDateString() : '-'}
        </Typography.Text>
      ),
      width: 130,
    },
  ];

  return (
    <Card style={{ height: 'calc(100vh - 280px)' }}>
      <Table
        columns={columns}
        dataSource={sortedInvoices}
        pagination={{
          size: 'small',
          total: invoicesResponse.total || invoices.length,
          current: invoicesResponse.page || 1,
          pageSize: invoicesResponse.limit || 10,
        }}
        scroll={{
          x: 'max-content',
        }}
        onRow={record => ({
          onClick: () => navigate(`/worklenz/client-portal/invoices/${record.id}`),
          style: { cursor: 'pointer' },
        })}
      />
    </Card>
  );
};

export default InvoicesTable;
