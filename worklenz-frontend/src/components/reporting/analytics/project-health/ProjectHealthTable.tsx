import React, { useMemo } from 'react';
import { Flex, Table, Tag, Typography, theme } from '@/shared/antd-imports';
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

/** Ant Design presets keep tag text readable in light and dark themes. */
const TONE_FALLBACK: Record<
  ProjectHealthTone,
  { color: string; labelKey: string; defaultLabel: string; swatch: string }
> = {
  on_track: {
    color: 'success',
    labelKey: 'statOnTrack',
    defaultLabel: 'On track',
    swatch: '#52c41a',
  },
  at_risk: {
    color: 'warning',
    labelKey: 'statAtRisk',
    defaultLabel: 'At risk',
    swatch: '#faad14',
  },
  off_track: {
    color: 'error',
    labelKey: 'statOffTrack',
    defaultLabel: 'Off track',
    swatch: '#ff4d4f',
  },
  not_set: {
    color: 'default',
    labelKey: 'phHealthNotSet',
    defaultLabel: 'Not set',
    swatch: '#8c8c8c',
  },
};

const budgetUsedColor = (pct: number): string | undefined => {
  if (pct > 100) return '#ff4d4f';
  if (pct > 85) return '#faad14';
  return undefined;
};

export const ProjectHealthTable: React.FC<ProjectHealthTableProps> = ({
  projects,
  loading,
}) => {
  const { t } = useTranslation('reporting-analytics');
  const { token } = theme.useToken();

  const columns: ColumnsType<ProjectHealthRow> = useMemo(
    () => [
      {
        title: t('phColProject', { defaultValue: 'Project' }),
        dataIndex: 'project_name',
        key: 'project_name',
        width: '22%',
        ellipsis: true,
        sorter: (a, b) => a.project_name.localeCompare(b.project_name),
        render: (name: string, record) => {
          const fallback = TONE_FALLBACK[record.health_tone];
          return (
            <Flex align="center" gap={8}>
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 2,
                  background:
                    record.health_tone === 'not_set'
                      ? fallback.swatch
                      : record.health_color || fallback.swatch,
                  flexShrink: 0,
                }}
              />
              <Text strong ellipsis style={{ color: token.colorText }}>
                {name}
              </Text>
            </Flex>
          );
        },
      },
      {
        title: t('phColHealth', { defaultValue: 'Health' }),
        key: 'health',
        width: '12%',
        filters: [
          { text: t('statOnTrack', { defaultValue: 'On track' }), value: 'on_track' },
          { text: t('statAtRisk', { defaultValue: 'At risk' }), value: 'at_risk' },
          { text: t('statOffTrack', { defaultValue: 'Off track' }), value: 'off_track' },
          { text: t('phHealthNotSet', { defaultValue: 'Not set' }), value: 'not_set' },
        ],
        onFilter: (value, record) => record.health_tone === value,
        render: (_: unknown, row) => {
          const fallback = TONE_FALLBACK[row.health_tone];
          const label =
            row.health_name ||
            t(fallback.labelKey, { defaultValue: fallback.defaultLabel });
          // Tone presets (not raw DB hex) — custom light grays render white-on-pale in light mode.
          return <Tag color={fallback.color}>{label}</Tag>;
        },
      },
      {
        title: t('phColProgress', { defaultValue: 'Progress' }),
        dataIndex: 'progress_pct',
        key: 'progress_pct',
        width: '10%',
        align: 'right',
        sorter: (a, b) => a.progress_pct - b.progress_pct,
        render: (value: number) => (
          <Text strong={value >= 100}>{`${Math.round(value)}%`}</Text>
        ),
      },
      {
        title: t('phColDue', { defaultValue: 'Due' }),
        dataIndex: 'due_date',
        key: 'due_date',
        width: '12%',
        align: 'right',
        sorter: (a, b) => (a.due_date || '').localeCompare(b.due_date || ''),
        render: (value: string | null) =>
          value ? dayjs(value).format('MMM D, YYYY') : <Text type="secondary">—</Text>,
      },
      {
        title: t('phColOpenTasks', { defaultValue: 'Open tasks' }),
        dataIndex: 'open_tasks',
        key: 'open_tasks',
        width: '10%',
        align: 'right',
        sorter: (a, b) => a.open_tasks - b.open_tasks,
      },
      {
        title: t('phColOverdue', { defaultValue: 'Overdue' }),
        dataIndex: 'overdue_tasks',
        key: 'overdue_tasks',
        width: '9%',
        align: 'right',
        sorter: (a, b) => a.overdue_tasks - b.overdue_tasks,
        render: (value: number) =>
          value > 0 ? (
            <Text type="danger" strong>
              {value}
            </Text>
          ) : (
            <Text type="secondary">0</Text>
          ),
      },
      {
        title: t('phColBudgetUsed', { defaultValue: 'Budget used' }),
        dataIndex: 'budget_used_pct',
        key: 'budget_used_pct',
        width: '11%',
        align: 'right',
        sorter: (a, b) => a.budget_used_pct - b.budget_used_pct,
        render: (value: number, row) =>
          row.budget > 0 ? (
            <Text style={{ color: budgetUsedColor(value) }}>{`${Math.round(value)}%`}</Text>
          ) : (
            <Text type="secondary">—</Text>
          ),
      },
      {
        title: t('phColLead', { defaultValue: 'Project lead' }),
        dataIndex: 'lead_name',
        key: 'lead_name',
        width: '14%',
        ellipsis: true,
        render: (value: string | null) =>
          value ? (
            <Text ellipsis>{value}</Text>
          ) : (
            <Text type="secondary">—</Text>
          ),
      },
    ],
    [t, token.colorText]
  );

  return (
    <Table<ProjectHealthRow>
      rowKey="project_id"
      columns={columns}
      dataSource={projects}
      loading={loading}
      pagination={{ pageSize: 20, showSizeChanger: true }}
      size="middle"
      tableLayout="fixed"
      style={{ width: '100%' }}
      showSorterTooltip={false}
      locale={{
        emptyText: t('phChartEmpty', {
          defaultValue: 'No projects match these filters.',
        }),
      }}
    />
  );
};
