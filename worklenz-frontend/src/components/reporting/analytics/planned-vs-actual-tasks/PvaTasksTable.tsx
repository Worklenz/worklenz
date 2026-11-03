import React, { useMemo } from 'react';
import { Table, Typography, theme } from '@/shared/antd-imports';
import type { ColumnsType } from 'antd/es/table';
import { useTranslation } from 'react-i18next';
import { getClientTablePagination } from '@/lib/reporting/analytics-table-pagination';
import type { PlannedVsActualTasksRow } from '@/types/reporting/analytics-planned-vs-actual-tasks.types';

const { Text } = Typography;

interface PvaTasksTableProps {
  projects: PlannedVsActualTasksRow[];
  loading?: boolean;
}

const formatVariance = (days: number): string => {
  if (days > 0) return `+${days}`;
  return String(days);
};

export const PvaTasksTable: React.FC<PvaTasksTableProps> = ({ projects, loading }) => {
  const { t } = useTranslation('reporting-analytics');
  const { token } = theme.useToken();

  const columns: ColumnsType<PlannedVsActualTasksRow> = useMemo(
    () => [
      {
        title: t('pvaTasksColProject', { defaultValue: 'Project' }),
        dataIndex: 'project_name',
        key: 'project_name',
        width: 200,
        ellipsis: true,
        sorter: (a, b) => a.project_name.localeCompare(b.project_name),
      },
      {
        title: t('pvaTasksColPlanned', { defaultValue: 'Planned tasks' }),
        dataIndex: 'planned',
        key: 'planned',
        width: 130,
        align: 'right',
        sorter: (a, b) => a.planned - b.planned,
      },
      {
        title: t('pvaTasksColCompleted', { defaultValue: 'Completed' }),
        dataIndex: 'completed',
        key: 'completed',
        width: 120,
        align: 'right',
        sorter: (a, b) => a.completed - b.completed,
      },
      {
        title: t('pvaTasksColOverdue', { defaultValue: 'Overdue' }),
        dataIndex: 'overdue',
        key: 'overdue',
        width: 110,
        align: 'right',
        sorter: (a, b) => a.overdue - b.overdue,
        render: (value: number) =>
          value > 0 ? <Text type="danger">{value}</Text> : <Text type="secondary">0</Text>,
      },
      {
        title: t('pvaTasksColVariance', { defaultValue: 'Variance' }),
        dataIndex: 'variance_days',
        key: 'variance_days',
        width: 120,
        align: 'right',
        sorter: (a, b) => a.variance_days - b.variance_days,
        render: (value: number) => {
          if (value > 0) {
            return (
              <Text type="danger">
                {formatVariance(value)}{' '}
                {t('pvaTasksDaysUnit', { defaultValue: 'days' })}
              </Text>
            );
          }
          if (value < 0) {
            return (
              <Text type="success">
                {formatVariance(value)}{' '}
                {t('pvaTasksDaysUnit', { defaultValue: 'days' })}
              </Text>
            );
          }
          return (
            <Text type="secondary">
              0 {t('pvaTasksDaysUnit', { defaultValue: 'days' })}
            </Text>
          );
        },
      },
    ],
    [t]
  );

  const borderedColumns: ColumnsType<PlannedVsActualTasksRow> = useMemo(
    () =>
      columns.map((column) => ({
        ...column,
        onCell: () => ({
          style: {
            borderInlineEnd: `1px solid ${token.colorBorder}`,
            borderBottom: `1px solid ${token.colorBorder}`,
          },
        }),
        onHeaderCell: () => ({
          style: {
            borderInlineEnd: `1px solid ${token.colorBorder}`,
            borderBottom: `1px solid ${token.colorBorder}`,
          },
        }),
      })),
    [columns, token.colorBorder]
  );

  return (
    <Table<PlannedVsActualTasksRow>
      bordered
      rowKey="project_id"
      columns={borderedColumns}
      dataSource={projects}
      loading={loading}
      pagination={getClientTablePagination(20)}
      scroll={{ x: 700 }}
      size="middle"
    />
  );
};
