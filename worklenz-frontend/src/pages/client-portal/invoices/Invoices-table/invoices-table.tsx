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
  theme,
} from '@/shared/antd-imports';
import { useState } from 'react';
import { TableProps } from 'antd/lib';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useGetInvoicesQuery } from '../../../../api/client-portal/client-portal-api';
import { PlusOutlined } from '@ant-design/icons';
import { formatDate } from '../../../../utils/dateUtils';

export const InvoicesTable = () => {
  // localization
  const { t } = useTranslation('client-portal-invoices');
  const navigate = useNavigate();
  const { token } = theme.useToken();
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Fetch invoices from API
  const { data: invoicesData, isLoading, error } = useGetInvoicesQuery({
    page: currentPage,
    limit: pageSize,
  });

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
  const invoicesResponse = invoicesData?.body || {
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

  // table columns
  const columns: TableProps['columns'] = [
    {
      key: 'invoice_no',
      title: t('invoiceNoColumn'),
      render: record => (
        <Typography.Text strong style={{ color: token.colorPrimary }}>
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
          {record.createdAt ? formatDate(record.createdAt, 'MMM D, YYYY') : '-'}
        </Typography.Text>
      ),
      width: 130,
    },
    {
      key: 'due_date',
      title: t('dueDateColumn'),
      render: record => (
        <Typography.Text>
          {record.dueDate ? formatDate(record.dueDate, 'MMM D, YYYY') : '-'}
        </Typography.Text>
      ),
      width: 130,
    },
  ];

  return (
    <Card style={{ height: 'calc(100vh - 280px)' }}>
      <Table
        columns={columns}
        dataSource={invoices}
        pagination={{
          size: 'small',
          total: invoicesResponse.total || invoices.length,
          current: currentPage,
          pageSize,
          showSizeChanger: true,
          onChange: (page, size) => {
            setCurrentPage(page);
            setPageSize(size);
          },
        }}
        scroll={{
          x: 'max-content',
        }}
        rowKey={record => record.id}
        onRow={record => ({
          onClick: () => navigate(`/worklenz/client-portal/invoices/${record.id}`),
          style: { cursor: 'pointer' },
        })}
      />
    </Card>
  );
};
