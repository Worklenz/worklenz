import React, { useMemo } from 'react';
import { Table, Typography } from '@/shared/antd-imports';
import type { ColumnsType } from 'antd/es/table';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import type { PlannedVsActualMilestonesRow } from '@/types/reporting/analytics-planned-vs-actual-milestones.types';

const { Text } = Typography;

interface PvaMilestonesTableProps {
  milestones: PlannedVsActualMilestonesRow[];
  loading?: boolean;
}

const formatVariance = (days: number): string => {
  if (days > 0) return `+${days}`;
  return String(days);
};

export const PvaMilestonesTable: React.FC<PvaMilestonesTableProps> = ({
  milestones,
  loading,
}) => {
  const { t } = useTranslation('reporting-analytics');

  const columns: ColumnsType<PlannedVsActualMilestonesRow> = useMemo(
    () => [
      {
        title: t('pvaMsColMilestone', { defaultValue: 'Milestone' }),
        dataIndex: 'milestone_name',
        key: 'milestone_name',
        ellipsis: true,
        sorter: (a, b) => a.milestone_name.localeCompare(b.milestone_name),
      },
      {
        title: t('pvaMsColProject', { defaultValue: 'Project' }),
        dataIndex: 'project_name',
        key: 'project_name',
        ellipsis: true,
        sorter: (a, b) => a.project_name.localeCompare(b.project_name),
      },
      {
        title: t('pvaMsColPlanned', { defaultValue: 'Planned date' }),
        dataIndex: 'planned_date',
        key: 'planned_date',
        width: 140,
        sorter: (a, b) => a.planned_date.localeCompare(b.planned_date),
        render: (value: string) => dayjs(value).format('MMM D, YYYY'),
      },
      {
        title: t('pvaMsColActual', { defaultValue: 'Actual date' }),
        dataIndex: 'actual_date',
        key: 'actual_date',
        width: 140,
        sorter: (a, b) => (a.actual_date || '').localeCompare(b.actual_date || ''),
        render: (value: string | null) =>
          value ? dayjs(value).format('MMM D, YYYY') : <Text type="secondary">—</Text>,
      },
      {
        title: t('pvaMsColVariance', { defaultValue: 'Variance' }),
        dataIndex: 'variance_days',
        key: 'variance_days',
        width: 120,
        align: 'right',
        sorter: (a, b) => a.variance_days - b.variance_days,
        render: (value: number) => {
          if (value > 0) {
            return (
              <Text type="danger">
                {formatVariance(value)} {t('pvaMsDaysUnit', { defaultValue: 'days' })}
              </Text>
            );
          }
          if (value < 0) {
            return (
              <Text type="success">
                {formatVariance(value)} {t('pvaMsDaysUnit', { defaultValue: 'days' })}
              </Text>
            );
          }
          return (
            <Text type="secondary">
              0 {t('pvaMsDaysUnit', { defaultValue: 'days' })}
            </Text>
          );
        },
      },
    ],
    [t]
  );

  return (
    <Table<PlannedVsActualMilestonesRow>
      rowKey="milestone_id"
      columns={columns}
      dataSource={milestones}
      loading={loading}
      pagination={{ pageSize: 20, showSizeChanger: true }}
      scroll={{ x: 720 }}
      size="middle"
    />
  );
};
