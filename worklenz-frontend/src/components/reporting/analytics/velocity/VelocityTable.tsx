import React, { useMemo } from 'react';
import { Table, Tooltip, Typography } from '@/shared/antd-imports';
import type { ColumnsType } from 'antd/es/table';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import type { VelocitySeriesPoint } from '@/types/reporting/analytics-velocity.types';

const { Text } = Typography;

interface VelocityTableProps {
  series: VelocitySeriesPoint[];
}

interface VelocityRow {
  key: string;
  sprint_name: string;
  completed_at: string | null;
  committed: number;
  completed: number;
  commitment_accuracy: number | null;
}

export const VelocityTable: React.FC<VelocityTableProps> = ({ series }) => {
  const { t } = useTranslation('reporting-analytics');

  const data: VelocityRow[] = useMemo(
    () =>
      series.map(point => ({
        key: point.sprint_id,
        sprint_name: point.sprint_name,
        completed_at: point.completed_at,
        committed: point.committed,
        completed: point.completed,
        commitment_accuracy: point.commitment_accuracy,
      })),
    [series]
  );

  const columns: ColumnsType<VelocityRow> = [
    {
      title: t('colSprint', { defaultValue: 'Sprint' }),
      dataIndex: 'sprint_name',
      key: 'sprint_name',
    },
    {
      title: t('colCompletedAt', { defaultValue: 'Completed' }),
      dataIndex: 'completed_at',
      key: 'completed_at',
      render: (value: string | null) =>
        value ? dayjs(value).format('MMM D, YYYY') : '—',
    },
    {
      title: t('legendCommitted', { defaultValue: 'Committed' }),
      dataIndex: 'committed',
      key: 'committed',
      align: 'right',
    },
    {
      title: t('legendCompleted', { defaultValue: 'Completed' }),
      dataIndex: 'completed',
      key: 'completed',
      align: 'right',
    },
    {
      title: t('colCommitmentPct', { defaultValue: 'Commitment %' }),
      dataIndex: 'commitment_accuracy',
      key: 'commitment_accuracy',
      align: 'right',
      render: (value: number | null, row) => {
        if (value === null || value === undefined) {
          return (
            <Tooltip
              title={t('commitmentUnavailable', {
                defaultValue: 'Commitment % needs a non-zero committed value.',
              })}
            >
              <Text type="secondary">—</Text>
            </Tooltip>
          );
        }
        return (
          <Tooltip
            title={t('tooltipCommitmentDetail', {
              defaultValue: '{{completed}} completed of {{committed}} committed',
              completed: row.completed,
              committed: row.committed,
            })}
          >
            <span>{`${Math.round(value)}%`}</span>
          </Tooltip>
        );
      },
    },
  ];

  return (
    <Table
      size="small"
      rowKey="key"
      columns={columns}
      dataSource={data}
      pagination={false}
      locale={{
        emptyText: t('velocityChartEmpty', {
          defaultValue: 'No completed sprints match these filters.',
        }),
      }}
    />
  );
};
