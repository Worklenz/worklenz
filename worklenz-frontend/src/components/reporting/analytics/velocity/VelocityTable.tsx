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
  /** Overrides the default empty-state copy (e.g. select-project prompt). */
  emptyText?: React.ReactNode;
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
  emptyText: emptyTextProp,
}) => {
  const { t } = useTranslation('reporting-analytics');
  const { token } = theme.useToken();
  const tableBorderColor = token.colorBorder;

  const cellBorderStyle: React.CSSProperties = {
    borderInlineEnd: `1px solid ${token.colorBorder}`,
    borderBottom: `1px solid ${token.colorBorder}`,
  };

  const defaultEmptyText =
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

  const emptyText = (
    <Text type="secondary">{emptyTextProp ?? defaultEmptyText}</Text>
  );

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
      title: t('colSprintOrPhase', { defaultValue: 'Sprint / Phase' }),
      dataIndex: 'sprint_name',
      key: 'sprint_name',
      width: 150,
      sorter: (a, b) => a.sprint_name.localeCompare(b.sprint_name),
      onCell: () => ({
        style: cellBorderStyle,
      }),
      onHeaderCell: () => ({
        style: cellBorderStyle,
      }),
    },
    {
      title: t('legendCommitted', { defaultValue: 'Committed' }),
      dataIndex: 'committed',
      width: 150,
      key: 'committed',
      align: 'right',
      sorter: (a, b) => a.committed - b.committed,
      onCell: () => ({
        style: cellBorderStyle,
      }),
      onHeaderCell: () => ({
        style: cellBorderStyle,
      }),
    },
    {
      title: t('legendCompleted', { defaultValue: 'Completed' }),
      dataIndex: 'completed',
      key: 'completed',
      width: 130,
      align: 'right',
      sorter: (a, b) => a.completed - b.completed,
      onCell: () => ({
        style: cellBorderStyle,
      }),
      onHeaderCell: () => ({
        style: cellBorderStyle,
      }),
    },
    {
      title: t('colCommitmentPct', { defaultValue: 'Commitment %' }),
      dataIndex: 'commitment_accuracy',
      key: 'commitment_accuracy',
      width: 80,
      align: 'right',
      sorter: (a, b) =>
        (a.commitment_accuracy ?? -1) -
        (b.commitment_accuracy ?? -1),
      onCell: () => ({
        style: cellBorderStyle,
      }),
      onHeaderCell: () => ({
        style: cellBorderStyle,
      }),
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
      className="velocity-table"
      size="middle"
      bordered
      rowKey="key"
      columns={columns}
      dataSource={data}
      pagination={false}
      showSorterTooltip={false}
      style={{
        borderRadius: token.borderRadiusLG,
        border: `1px solid ${tableBorderColor}`,
      }}
      locale={{
        emptyText,
      }}
    />
  );
};
