import { billingApiService, ILkrPayment } from '@/api/admin-center/billing.api.service';
import logger from '@/utils/errorLogger';
import { Button, Table, TableProps, Tag, notification } from '@/shared/antd-imports';
import { DownloadOutlined } from '@ant-design/icons';
import React, { useEffect, useState } from 'react';

const LkrPaymentHistoryTable: React.FC = () => {
  const [payments, setPayments] = useState<ILkrPayment[]>([]);
  const [loading, setLoading] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const fetchPayments = async () => {
    try {
      setLoading(true);
      const res = await billingApiService.getLkrPaymentHistory();
      if (res.done) {
        setPayments(res.body?.payments ?? []);
      }
    } catch (e) {
      logger.error('Error fetching LKR payment history', e);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (record: ILkrPayment) => {
    const receiptNumber = (record.order_id ?? record.transaction_id ?? record.id)
      .replace(/[^A-Z0-9]/gi, '')
      .slice(-12)
      .toUpperCase();
    try {
      setDownloadingId(record.id);
      await billingApiService.downloadLkrReceipt(record.id, receiptNumber);
    } catch (e) {
      logger.error('Receipt download failed', e);
      notification.error({ message: 'Download failed', description: 'Could not generate receipt. Please try again.' });
    } finally {
      setDownloadingId(null);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, []);

  const columns: TableProps<ILkrPayment>['columns'] = [
    {
      title: 'Date',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (v: string) =>
        new Date(v).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
    },
    {
      title: 'Amount',
      key: 'amount',
      render: (_, r) => {
        const amt = r.transaction_amount ?? r.amount;
        const cur = r.transaction_currency ?? 'LKR';
        return amt != null ? `${cur} ${Number(amt).toFixed(2)}` : '—';
      },
    },
    {
      title: 'Status',
      key: 'status',
      render: (_, r) => {
        const s = r.transaction_status ?? r.status ?? '';
        const color = s === 'SUCCESS' || s === '200' ? 'green' : 'red';
        return <Tag color={color}>{s === '200' ? 'SUCCESS' : s}</Tag>;
      },
    },
    {
      title: 'Transaction ID',
      dataIndex: 'transaction_id',
      key: 'transaction_id',
      render: (v: string | null) => v ?? '—',
    },
    {
      title: 'Card',
      dataIndex: 'card_number',
      key: 'card_number',
      render: (v: string | null) => (v ? `•••• ${v.slice(-4)}` : '—'),
    },
    {
      title: '',
      key: 'actions',
      align: 'right',
      render: (_, record) => (
        <Button
          type="text"
          size="small"
          icon={<DownloadOutlined />}
          loading={downloadingId === record.id}
          onClick={() => handleDownload(record)}
        >
          Receipt
        </Button>
      ),
    },
  ];

  return (
    <Table<ILkrPayment>
      columns={columns}
      dataSource={payments}
      pagination={false}
      loading={loading}
      rowKey="id"
      locale={{ emptyText: 'No payment history' }}
    />
  );
};

export default LkrPaymentHistoryTable;
