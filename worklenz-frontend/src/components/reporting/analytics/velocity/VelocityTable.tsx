import React, { useMemo } from 'react';
import { Table, Tooltip, Typography, theme } from '@/shared/antd-imports';
import type { ColumnsType } from 'antd/es/table';
import { useTranslation } from 'react-i18next';
import type {
  VelocityBucket,
  VelocitySeriesPoint,
} from '@/types/reporting/analytics-velocity.types';

const { Text } = Typography;

interface VelocityTableProps {
  series: VelocitySeriesPoint[];
  bucket?: VelocityBucket;
}

interface VelocityRow {
  key: string;
  sprint_name: string;
  committed: number;
  completed: number;
  commitment_accuracy: number | null;
}

export const VelocityTable: React.FC<VelocityTableProps> = ({
  series,
  bucket = 'sprint',
}) => {
  const { t } = useTranslation('reporting-analytics');
  const { token } = theme.useToken();

  const bucketColumnTitle =
    bucket === 'phase'
      ? t('colPhase', { defaultValue: 'Phase' })
      : bucket === 'mixed'
        ? t('colSprintOrPhase', { defaultValue: 'Sprint / Phase' })
        : t('colSprint', { defaultValue: 'Sprint' });

  const emptyText =
    bucket === 'phase'
      ? t('velocityChartEmptyPhases', {
          defaultValue: 'No phases with tasks match these filters.',
        })
      : bucket === 'mixed'
        ? t('velocityChartEmptyMixed', {
            defaultValue: 'No completed sprints or phases match these filters.',
          })
        : t('velocityChartEmpty', {
            defaultValue: 'No completed sprints match these filters.',
          });

  const data: VelocityRow[] = useMemo(
    () =>
      series.map(point => ({
        key: point.sprint_id,
        sprint_name: point.sprint_name,
        committed: point.committed,
        completed: point.completed,
        commitment_accuracy: point.commitment_accuracy,
      })),
    [series]
  );

  const columns: ColumnsType<VelocityRow> = [
    {
      title: bucketColumnTitle,
      dataIndex: 'sprint_name',
      key: 'sprint_name',
      sorter: (a, b) => a.sprint_name.localeCompare(b.sprint_name),
    },
    {
      title: t('legendCommitted', { defaultValue: 'Committed' }),
      dataIndex: 'committed',
      key: 'committed',
      align: 'right',
      sorter: (a, b) => a.committed - b.committed,
    },
    {
      title: t('legendCompleted', { defaultValue: 'Completed' }),
      dataIndex: 'completed',
      key: 'completed',
      align: 'right',
      sorter: (a, b) => a.completed - b.completed,
    },
    {
      title: t('colCommitmentPct', { defaultValue: 'Commitment %' }),
      dataIndex: 'commitment_accuracy',
      key: 'commitment_accuracy',
      align: 'right',
      sorter: (a, b) => (a.commitment_accuracy ?? -1) - (b.commitment_accuracy ?? -1),
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
      size="middle"
      rowKey="key"
      columns={columns}
      dataSource={data}
      pagination={false}
      showSorterTooltip={false}
      style={{
        borderRadius: token.borderRadiusLG,
      }}
      locale={{
        emptyText,
      }}
    />
  );
};
