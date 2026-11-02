import React, { useMemo } from 'react';
import { Table, Tag, Typography } from '@/shared/antd-imports';
import type { ColumnsType } from 'antd/es/table';
import { useTranslation } from 'react-i18next';
import { TisMiniBar } from './TisMiniBar';
import type { TimeInStatusIssueRow } from '@/types/reporting/analytics-time-in-status.types';

const { Text } = Typography;

const OUTLIER_BG = 'rgba(255, 77, 79, 0.08)';

interface TisPerIssueTableProps {
  issues: TimeInStatusIssueRow[];
}

export const TisPerIssueTable: React.FC<TisPerIssueTableProps> = ({ issues }) => {
  const { t } = useTranslation('reporting-analytics');

  const data = useMemo(
    () =>
      issues.map(issue => ({
        key: issue.task_id,
        ...issue,
      })),
    [issues]
  );

  const columns: ColumnsType<(typeof data)[number]> = [
    {
      title: t('tisColTaskKey', { defaultValue: 'Key' }),
      dataIndex: 'task_key',
      key: 'task_key',
      width: 120,
      sorter: (a, b) => a.task_key.localeCompare(b.task_key),
      render: (key: string, row) => (
        <Text strong={row.is_outlier} style={{ color: row.is_outlier ? '#ff4d4f' : undefined }}>
          {key}
        </Text>
      ),
    },
    {
      title: t('tisColTaskName', { defaultValue: 'Task' }),
      dataIndex: 'task_name',
      key: 'task_name',
      ellipsis: true,
      sorter: (a, b) => a.task_name.localeCompare(b.task_name),
    },
    {
      title: t('tisColType', { defaultValue: 'Type' }),
      dataIndex: 'issue_type',
      key: 'issue_type',
      width: 90,
      render: (type: string) => <Tag>{type}</Tag>,
    },
    {
      title: t('tisColAssignee', { defaultValue: 'Assignee' }),
      dataIndex: 'assignee_name',
      key: 'assignee_name',
      width: 140,
      render: (name: string | null) => name || '—',
    },
    {
      title: t('tisColTotalDays', { defaultValue: 'Total days' }),
      dataIndex: 'total_days',
      key: 'total_days',
      align: 'right',
      width: 110,
      sorter: (a, b) => a.total_days - b.total_days,
      defaultSortOrder: 'descend',
      render: (days: number, row) => (
        <Text style={{ color: row.is_outlier ? '#ff4d4f' : undefined }}>{days}</Text>
      ),
    },
    {
      title: t('tisColBreakdown', { defaultValue: 'Breakdown' }),
      key: 'breakdown',
      width: 160,
      render: (_, row) => (
        <TisMiniBar
          segments={row.segments}
          totalDays={row.total_days}
          isOutlier={row.is_outlier}
        />
      ),
    },
    {
      title: t('tisColOutlier', { defaultValue: 'Outlier' }),
      dataIndex: 'is_outlier',
      key: 'is_outlier',
      width: 90,
      filters: [
        { text: t('tisOutlierYes', { defaultValue: 'Yes' }), value: true },
        { text: t('tisOutlierNo', { defaultValue: 'No' }), value: false },
      ],
      onFilter: (value, record) => record.is_outlier === value,
      render: (flag: boolean) =>
        flag ? (
          <Tag color="error">{t('tisOutlierYes', { defaultValue: 'Yes' })}</Tag>
        ) : (
          <Text type="secondary">—</Text>
        ),
    },
  ];

  return (
    <Table
      size="small"
      pagination={{ pageSize: 25, showSizeChanger: true }}
      columns={columns}
      dataSource={data}
      scroll={{ x: 900 }}
      onRow={record =>
        record.is_outlier
          ? {
              style: { background: OUTLIER_BG },
            }
          : {}
      }
    />
  );
};
