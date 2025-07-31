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
} from 'antd';
import { TableProps } from 'antd/lib';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { colors } from '../../../../styles/colors';
import { useAppSelector } from '../../../../hooks/useAppSelector';
import { useAppDispatch } from '../../../../hooks/useAppDispatch';
import { useNavigate } from 'react-router-dom';

// Temporary type for invoice data - replace with actual type when available
interface TempInvoiceType {
  id: string;
  invoice_no: string;
  client_name: string;
  service: string;
  status: 'paid' | 'pending' | 'overdue' | 'cancelled';
  issued_time: string;
}

const InvoicesTable = () => {
  // localization
  const { t } = useTranslation('client-view/client-view-invoices');

  // Get invoices list from invoices reducer
  const invoicesList: TempInvoiceType[] = useAppSelector(
    (state) => state.clientsPortalReducer.invoicesReducer.invoices
  );

  const dispatch = useAppDispatch();
  const navigate = useNavigate();

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

  // table columns
  const columns: TableProps['columns'] = [
    {
      key: 'order_no',
      title: t('invoiceNoColumn'),
      render: (record) => (
        <Typography.Text strong style={{ color: colors.skyBlue }}>
          {record.invoice_no}
        </Typography.Text>
      ),
      onCell: () => ({
        style: { minWidth: 200 },
      }),
    },
    {
      key: 'service',
      title: t('serviceColumn'),
      render: (record) => (
        <Typography.Text>{record.service}</Typography.Text>
      ),
      onCell: () => ({
        style: { minWidth: 250 },
      }),
    },
    {
      key: 'status',
      title: t('statusColumn'),
      render: (record) => (
        <Tag color={getStatusColor(record.status)}>
          {getStatusText(record.status)}
        </Tag>
      ),
      width: 120,
    },
    {
      key: 'issued_time',
      title: t('issuedTimeColumn'),
      render: (record) => (
        <Typography.Text>
          {new Date(record.issued_time).toLocaleDateString()}
        </Typography.Text>
      ),
      width: 150,
    },
  ];

  return (
    <Card style={{ height: 'calc(100vh - 280px)' }}>
      <Table
        columns={columns}
        dataSource={invoicesList}
        pagination={{
          size: 'small',
        }}
        scroll={{
          x: 'max-content',
        }}
        onRow={(record) => ({
          onClick: () => navigate(`/client-portal/invoices/${record.id}`),
          style: { cursor: 'pointer' },
        })}
      />
    </Card>
  );
};

export default InvoicesTable; 