import {
  DeleteOutlined,
  ExclamationCircleFilled,
  EditOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import {
  Button,
  Card,
  Flex,
  Popconfirm,
  Table,
  Tooltip,
  Typography,
  Tag,
  Spin,
  Alert,
  Empty,
} from '@/shared/antd-imports';
import { TableProps } from 'antd/lib';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { colors } from '../../../../styles/colors';
import { useAppDispatch } from '../../../../hooks/useAppDispatch';
import { useNavigate } from 'react-router-dom';
import { useGetInvoicesQuery } from '../../../../api/client-portal/client-portal-api';
import { PlusOutlined } from '@ant-design/icons';
import AddInvoiceDrawer from '@/components/client-portal/AddInvoiceDrawer';

const InvoicesTable = () => {
  // localization
  const { t } = useTranslation('client-portal-invoices');
  const [isAddDrawerOpen, setIsAddDrawerOpen] = useState(false);

  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  // Fetch invoices from API
  const { data: invoicesData, isLoading, error, refetch } = useGetInvoicesQuery();

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
  const invoicesResponse = (invoicesData as any)?.body || { total: 0, data: [] };
  const invoices = invoicesResponse.data || [];

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
            onClick={() => {
              setIsAddDrawerOpen(true);
            }}
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
        <Typography.Text strong style={{ color: colors.skyBlue }}>
          {record.invoice_no}
        </Typography.Text>
      ),
      onCell: () => ({
        style: { minWidth: 200 },
      }),
    },
    {
      key: 'client',
      title: t('clientColumn'),
      render: record => (
        <Typography.Text style={{ textTransform: 'capitalize' }}>
          {record.client_name}
        </Typography.Text>
      ),
      onCell: () => ({
        style: { minWidth: 200 },
      }),
    },
    {
      key: 'service',
      title: t('serviceColumn'),
      render: record => <Typography.Text>{record.service}</Typography.Text>,
      onCell: () => ({
        style: { minWidth: 250 },
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
      key: 'issued_time',
      title: t('issuedTimeColumn'),
      render: record => (
        <Typography.Text>{new Date(record.issued_time).toLocaleDateString()}</Typography.Text>
      ),
      width: 150,
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
          current: 1, // Backend doesn't return current page info
          pageSize: 10, // Default page size
        }}
        scroll={{
          x: 'max-content',
        }}
        onRow={record => ({
          onClick: () => navigate(`/worklenz/client-portal/invoices/${record.id}`),
          style: { cursor: 'pointer' },
        })}
      />
      
      <AddInvoiceDrawer
        open={isAddDrawerOpen}
        onClose={() => setIsAddDrawerOpen(false)}
        onSuccess={() => {
          setIsAddDrawerOpen(false);
          refetch();
        }}
      />
    </Card>
  );
};

export default InvoicesTable;
