import { adminCenterApiService } from '@/api/admin-center/admin-center.api.service';
import { IBillingCharge, IBillingChargesResponse } from '@/types/admin-center/admin-center.types';
import logger from '@/utils/errorLogger';
import { formatDate } from '@/utils/timeUtils';
import { Table, TableProps, Tag } from 'antd';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

const ChargesTable: React.FC = () => {
  const { t } = useTranslation('admin-center/current-bill');
  const [charges, setCharges] = useState<IBillingChargesResponse>({});
  const [loadingCharges, setLoadingCharges] = useState(false);

  const fetchCharges = async () => {
    try {
      setLoadingCharges(true);
      const res = await adminCenterApiService.getCharges();
      if (res.done) {
        setCharges(res.body);
      }
    } catch (error) {
      logger.error('Error fetching charges:', error);
    } finally {
      setLoadingCharges(false);
    }
  };

  const columns: TableProps<IBillingCharge>['columns'] = [
    {
      title: t('description'),
      key: 'name',
      dataIndex: 'name',
    },
    {
      title: t('billingPeriod'),
      key: 'billingPeriod',
      render: record => {
        return `${formatDate(new Date(record.start_date))} - ${formatDate(new Date(record.end_date))}`;
      },
    },
    {
      title: t('billStatus'),
      key: 'status',
      dataIndex: 'status',
      render: (_, record) => {
        return (
          <Tag
            color={
              record.status === 'success' ? 'green' : record.status === 'deleted' ? 'red' : 'blue'
            }
          >
            {record.status?.toUpperCase()}
          </Tag>
        );
      },
    },
    {
      title: t('perUserValue'),
      key: 'perUserValue',
      dataIndex: 'perUserValue',
      render: (_, record) => (
        <span>
          {record.currency} {record.unit_price}
        </span>
      ),
    },
    {
      title: t('users'),
      key: 'quantity',
      dataIndex: 'quantity',
    },
    {
      title: t('amount'),
      key: 'amount',
      dataIndex: 'amount',
      render: (_, record) => (
        <span>
          {record.currency} {record.amount}
        </span>
      ),
    },
  ];

  useEffect(() => {
    fetchCharges();
  }, []);

  return (
    <Table<IBillingCharge>
      columns={columns}
      dataSource={charges.plan_charges}
      pagination={false}
      loading={loadingCharges}
      rowKey="id"
    />
  );
};

export default ChargesTable;
