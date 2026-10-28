import React, { useMemo } from 'react';
import { Table, Tag, Typography } from '@/shared/antd-imports';
import type { ColumnsType } from 'antd/es/table';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import type {
  ProjectHealthRow,
  ProjectHealthTone,
} from '@/types/reporting/analytics-project-health.types';

const { Text } = Typography;

interface ProjectHealthTableProps {
  projects: ProjectHealthRow[];
  loading?: boolean;
}

const TONE_TAG: Record<
  ProjectHealthTone,
  { color: string; labelKey: string; defaultLabel: string }
> = {
  on_track: { color: 'success', labelKey: 'statOnTrack', defaultLabel: 'On track' },
  at_risk: { color: 'warning', labelKey: 'statAtRisk', defaultLabel: 'At risk' },
  off_track: { color: 'error', labelKey: 'statOffTrack', defaultLabel: 'Off track' },
  not_set: { color: 'default', labelKey: 'phHealthNotSet', defaultLabel: 'Not set' },
};

export const ProjectHealthTable: React.FC<ProjectHealthTableProps> = ({
  projects,
  loading,
}) => {
  const { t } = useTranslation('reporting-analytics');

  const columns: ColumnsType<ProjectHealthRow> = useMemo(
    () => [
      {
        title: t('phColProject', { defaultValue: 'Project' }),
        dataIndex: 'project_name',
        key: 'project_name',
        ellipsis: true,
        sorter: (a, b) => a.project_name.localeCompare(b.project_name),
      },
      {
        title: t('phColHealth', { defaultValue: 'Health' }),
        key: 'health',
        width: 140,
        filters: [
          { text: t('statOnTrack', { defaultValue: 'On track' }), value: 'on_track' },
          { text: t('statAtRisk', { defaultValue: 'At risk' }), value: 'at_risk' },
          { text: t('statOffTrack', { defaultValue: 'Off track' }), value: 'off_track' },
          { text: t('phHealthNotSet', { defaultValue: 'Not set' }), value: 'not_set' },
        ],
        onFilter: (value, record) => record.health_tone === value,
        render: (_, row) => {
          const meta = TONE_TAG[row.health_tone];
          return (
            <Tag color={meta.color}>
              {t(meta.labelKey, { defaultValue: meta.defaultLabel })}
            </Tag>
          );
        },
      },
      {
        title: t('phColProgress', { defaultValue: 'Progress' }),
        dataIndex: 'progress_pct',
        key: 'progress_pct',
        width: 100,
        align: 'right',
        sorter: (a, b) => a.progress_pct - b.progress_pct,
        render: (value: number) => `${Math.round(value)}%`,
      },
      {
        title: t('phColDue', { defaultValue: 'Due' }),
        dataIndex: 'due_date',
        key: 'due_date',
        width: 120,
        sorter: (a, b) => (a.due_date || '').localeCompare(b.due_date || ''),
        render: (value: string | null) =>
          value ? dayjs(value).format('MMM D, YYYY') : <Text type="secondary">—</Text>,
      },
      {
        title: t('phColOpenTasks', { defaultValue: 'Open tasks' }),
        dataIndex: 'open_tasks',
        key: 'open_tasks',
        width: 110,
        align: 'right',
        sorter: (a, b) => a.open_tasks - b.open_tasks,
      },
      {
        title: t('phColOverdue', { defaultValue: 'Overdue' }),
        dataIndex: 'overdue_tasks',
        key: 'overdue_tasks',
        width: 100,
        align: 'right',
        sorter: (a, b) => a.overdue_tasks - b.overdue_tasks,
        render: (value: number) =>
          value > 0 ? (
            <Text type="danger">{value}</Text>
          ) : (
            <Text type="secondary">0</Text>
          ),
      },
      {
        title: t('phColBudgetUsed', { defaultValue: 'Budget used' }),
        dataIndex: 'budget_used_pct',
        key: 'budget_used_pct',
        width: 120,
        align: 'right',
        sorter: (a, b) => a.budget_used_pct - b.budget_used_pct,
        render: (value: number, row) =>
          row.budget > 0 ? `${Math.round(value)}%` : <Text type="secondary">—</Text>,
      },
      {
        title: t('phColLead', { defaultValue: 'Project lead' }),
        dataIndex: 'lead_name',
        key: 'lead_name',
        ellipsis: true,
        responsive: ['lg'],
        render: (value: string | null) => value || <Text type="secondary">—</Text>,
      },
    ],
    [t]
  );

  return (
    <Table<ProjectHealthRow>
      rowKey="project_id"
      columns={columns}
      dataSource={projects}
      loading={loading}
      pagination={{ pageSize: 20, showSizeChanger: true }}
      scroll={{ x: 900 }}
      size="middle"
    />
  );
};
