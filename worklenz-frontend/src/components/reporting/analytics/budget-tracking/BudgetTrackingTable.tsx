import React, { useMemo } from 'react';
import { Flex, Table, Tag, Typography } from '@/shared/antd-imports';
import type { ColumnsType } from 'antd/es/table';
import { useTranslation } from 'react-i18next';
import type {
  BudgetAlert,
  BudgetTrackingRow,
} from '@/types/reporting/analytics-budget-tracking.types';

const { Text } = Typography;

interface BudgetTrackingTableProps {
  projects: BudgetTrackingRow[];
  loading?: boolean;
}

const fmtMoney = (value: number, currency = 'USD'): string =>
  `${currency.toUpperCase()} ${new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)}`;

const burnColor = (pct: number): string => {
  if (pct > 85) return '#ff4d4f';
  if (pct > 65) return '#faad14';
  return '#52c41a';
};

const alertColor = (alert: BudgetAlert): string => {
  if (alert === 'high') return '#ff4d4f';
  if (alert === 'watch') return '#faad14';
  if (alert === 'ok') return '#52c41a';
  return 'default';
};

export const BudgetTrackingTable: React.FC<BudgetTrackingTableProps> = ({
  projects,
  loading,
}) => {
  const { t } = useTranslation('reporting-analytics');

  const columns: ColumnsType<BudgetTrackingRow> = useMemo(
    () => [
      {
        title: t('btColProject', { defaultValue: 'Project' }),
        dataIndex: 'project_name',
        key: 'project_name',
        ellipsis: true,
        sorter: (a, b) => a.project_name.localeCompare(b.project_name),
        render: (name: string, record) => (
          <Flex align="center" gap={8}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: 2,
                background: record.color_code || '#1890ff',
                flexShrink: 0,
              }}
            />
            <Text strong>{name}</Text>
          </Flex>
        ),
      },
      {
        title: t('btColClient', { defaultValue: 'Client' }),
        dataIndex: 'client_name',
        key: 'client_name',
        ellipsis: true,
        sorter: (a, b) => (a.client_name || '').localeCompare(b.client_name || ''),
        render: (value: string | null) =>
          value ? <Text>{value}</Text> : <Text type="secondary">—</Text>,
      },
      {
        title: t('btColBudget', { defaultValue: 'Budget' }),
        dataIndex: 'budget',
        key: 'budget',
        width: 130,
        align: 'right',
        sorter: (a, b) => a.budget - b.budget,
        render: (value: number, record) =>
          record.has_budget ? (
            fmtMoney(value, record.currency)
          ) : (
            <Text type="secondary">
              {t('btNoBudgetSet', { defaultValue: 'No budget set' })}
            </Text>
          ),
      },
      {
        title: t('btColSpent', { defaultValue: 'Spent' }),
        dataIndex: 'spent',
        key: 'spent',
        width: 130,
        align: 'right',
        sorter: (a, b) => a.spent - b.spent,
        render: (value: number, record) => (
          <Text strong style={{ color: record.burn_pct > 85 ? '#ff4d4f' : undefined }}>
            {fmtMoney(value, record.currency)}
          </Text>
        ),
      },
      {
        title: t('btColRemaining', { defaultValue: 'Remaining' }),
        dataIndex: 'remaining',
        key: 'remaining',
        width: 130,
        align: 'right',
        sorter: (a, b) => a.remaining - b.remaining,
        render: (value: number, record) =>
          record.has_budget ? (
            <Text strong style={{ color: value < 0 ? '#ff4d4f' : '#52c41a' }}>
              {fmtMoney(value, record.currency)}
            </Text>
          ) : (
            <Text type="secondary">—</Text>
          ),
      },
      {
        title: t('btColBurn', { defaultValue: 'Burn rate' }),
        key: 'burn',
        width: 110,
        align: 'right',
        sorter: (a, b) => a.burn_pct - b.burn_pct,
        render: (_: unknown, record) =>
          record.has_budget ? (
            <Text style={{ color: burnColor(record.burn_pct) }}>{record.burn_pct}%</Text>
          ) : (
            <Text type="secondary">—</Text>
          ),
      },
      {
        title: t('btColAlert', { defaultValue: 'Alert' }),
        dataIndex: 'alert',
        key: 'alert',
        width: 110,
        filters: [
          { text: t('btAlertHigh', { defaultValue: 'High' }), value: 'high' },
          { text: t('btAlertWatch', { defaultValue: 'Watch' }), value: 'watch' },
          { text: t('btAlertOk', { defaultValue: 'OK' }), value: 'ok' },
          { text: t('btAlertNone', { defaultValue: 'None' }), value: 'none' },
        ],
        onFilter: (value, record) => record.alert === value,
        render: (alert: BudgetAlert) => {
          const alertLabel =
            alert === 'high'
              ? t('btAlertHigh', { defaultValue: 'High' })
              : alert === 'watch'
                ? t('btAlertWatch', { defaultValue: 'Watch' })
                : alert === 'ok'
                  ? t('btAlertOk', { defaultValue: 'OK' })
                  : t('btAlertNone', { defaultValue: 'None' });
          return <Tag color={alertColor(alert)}>{alertLabel}</Tag>;
        },
      },
    ],
    [t]
  );

  return (
    <Table<BudgetTrackingRow>
      rowKey={row => row.project_id}
      columns={columns}
      dataSource={projects}
      loading={loading}
      pagination={{ pageSize: 20, showSizeChanger: true }}
      scroll={{ x: 960 }}
      size="middle"
    />
  );
};
