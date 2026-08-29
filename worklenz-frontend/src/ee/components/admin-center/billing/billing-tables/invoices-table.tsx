import { adminCenterApiService } from '@/api/admin-center/admin-center.api.service';
import { IBillingTransaction } from '@/types/admin-center/admin-center.types';
import logger from '@/utils/errorLogger';
import { formatDate } from '@/utils/timeUtils';
import { ContainerOutlined } from '@/shared/antd-imports';
import { Button, Table, TableProps, Tag, Tooltip } from '@/shared/antd-imports';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

const InvoicesTable: React.FC = () => {
  const { t } = useTranslation('admin-center/current-bill');

  const [transactions, setTransactions] = useState<IBillingTransaction[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(false);

  const fetchTransactions = async () => {
    try {
      setLoadingTransactions(true);
      const res = await adminCenterApiService.getTransactions();
      if (res.done) {
        setTransactions(res.body);
      }
    } catch (error) {
      logger.error('Error fetching transactions:', error);
    } finally {
      setLoadingTransactions(false);
    }
  };

  const handleInvoiceViewClick = (record: IBillingTransaction) => {
    if (!record.receipt_url) return;
    window.open(record.receipt_url, '_blank');
  };

  useEffect(() => {
    fetchTransactions();
  }, []);

  const columns: TableProps<IBillingTransaction>['columns'] = [
    {
      title: t('transactionId'),
      key: 'transactionId',
      dataIndex: 'subscription_payment_id',
    },
    {
      title: t('transactionDate'),
      key: 'transactionDate',
      render: record => `${formatDate(new Date(record.event_time))}`,
    },

    {
      title: t('billingPeriod'),
      key: 'billingPeriod',
      render: record => {
        return `${formatDate(new Date(record.event_time))} - ${formatDate(new Date(record.next_bill_date))}`;
      },
    },

    {
      title: t('paymentMethod'),
      key: 'paymentMethod',
      dataIndex: 'payment_method',
    },
    {
      title: t('status'),
      key: 'status',
      dataIndex: 'status',
      render: (_, record) => (
        <Tag
          color={
            record.payment_status === 'success'
              ? 'green'
              : record.payment_status === 'failed'
                ? 'red'
                : 'blue'
          }
        >
          {record.payment_status?.toUpperCase()}
        </Tag>
      ),
    },
    {
      key: 'button',
      render: (_, record) => (
        <Tooltip title={t('viewInvoice')}>
          <Button size="small">
            <ContainerOutlined onClick={() => handleInvoiceViewClick(record)} />
          </Button>
        </Tooltip>
      ),
    },
  ];

  return (
    <Table
      columns={columns}
      dataSource={transactions}
      pagination={false}
      loading={loadingTransactions}
      rowKey="id"
    />
  );
};

export default InvoicesTable;
