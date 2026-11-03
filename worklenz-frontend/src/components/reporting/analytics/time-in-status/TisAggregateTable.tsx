import React, { useMemo } from 'react';
import { Table, Tag } from '@/shared/antd-imports';
import type { ColumnsType } from 'antd/es/table';
import { useTranslation } from 'react-i18next';
import type { TimeInStatusAggregateRow } from '@/types/reporting/analytics-time-in-status.types';

interface TisAggregateTableProps {
  rows: TimeInStatusAggregateRow[];
}

export const TisAggregateTable: React.FC<TisAggregateTableProps> = ({ rows }) => {
  const { t } = useTranslation('reporting-analytics');

  const data = useMemo(
    () =>
      rows.map(r => ({
        key: r.status_id,
        ...r,
      })),
    [rows]
  );

  const columns: ColumnsType<(typeof data)[number]> = [
    {
      title: t('tisColStatus', { defaultValue: 'Status' }),
      dataIndex: 'status_name',
      key: 'status_name',
      render: (name: string, row) => (
        <Tag color={row.color || undefined} style={{ marginInlineEnd: 0 }}>
          {name}
        </Tag>
      ),
    },
    {
      title: t('tisColAvgDays', { defaultValue: 'Avg days' }),
      dataIndex: 'avg_days',
      key: 'avg_days',
      align: 'right',
      sorter: (a, b) => a.avg_days - b.avg_days,
    },
    {
      title: t('tisColMedianDays', { defaultValue: 'Median days' }),
      dataIndex: 'median_days',
      key: 'median_days',
      align: 'right',
      sorter: (a, b) => a.median_days - b.median_days,
    },
    {
      title: t('tisColMinDays', { defaultValue: 'Min' }),
      dataIndex: 'min_days',
      key: 'min_days',
      align: 'right',
    },
    {
      title: t('tisColMaxDays', { defaultValue: 'Max' }),
      dataIndex: 'max_days',
      key: 'max_days',
      align: 'right',
    },
    {
      title: t('tisColCount', { defaultValue: 'Count' }),
      dataIndex: 'count',
      key: 'count',
      align: 'right',
      sorter: (a, b) => a.count - b.count,
    },
    {
      title: t('tisColPctCycle', { defaultValue: '% cycle time' }),
      dataIndex: 'pct_cycle_time',
      key: 'pct_cycle_time',
      align: 'right',
      render: (v: number) => `${v}%`,
      sorter: (a, b) => a.pct_cycle_time - b.pct_cycle_time,
    },
  ];

  return (
    <Table
      size="small"
      pagination={false}
      columns={columns}
      dataSource={data}
      scroll={{ x: true }}
    />
  );
};
