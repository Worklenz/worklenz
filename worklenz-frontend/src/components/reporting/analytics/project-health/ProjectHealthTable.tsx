import React, { useMemo } from 'react';
import { Flex, Table, Tag, Typography, theme } from '@/shared/antd-imports';
import type { ColumnsType } from 'antd/es/table';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import { getClientTablePagination } from '@/lib/reporting/analytics-table-pagination';
import type {
  DeliveryConfidenceStatus,
  ProjectHealthRow,
} from '@/types/reporting/analytics-project-health.types';
import { decodeHtmlEntities } from '@/utils/html-entities';
import { MetricCalcHint } from '../MetricCalcHint';
import { PROJECT_HEALTH_TONE_COLORS } from './project-health-colors';

const { Text } = Typography;

const ColumnTitleWithHint: React.FC<{
  label: string;
  hint: string;
  hintColor: string;
  alignEnd?: boolean;
}> = ({ label, hint, hintColor, alignEnd = false }) => (
  <Flex
    align="center"
    gap={4}
    justify={alignEnd ? 'flex-end' : 'flex-start'}
    style={{ width: '100%' }}
  >
    <span>{label}</span>
    <MetricCalcHint title={hint} color={hintColor} />
  </Flex>
);

interface ProjectHealthTableProps {
  projects: ProjectHealthRow[];
  loading?: boolean;
}

type ConfidenceTone = DeliveryConfidenceStatus | 'not_set';

/** Ant Design presets keep tag text readable in light and dark themes. */
const CONFIDENCE_FALLBACK: Record<
  ConfidenceTone,
  { color: string; labelKey: string; defaultLabel: string; swatch: string }
> = {
  green: {
    color: 'success',
    labelKey: 'statOnTrack',
    defaultLabel: 'On track',
    swatch: PROJECT_HEALTH_TONE_COLORS.on_track,
  },
  amber: {
    color: 'warning',
    labelKey: 'statAtRisk',
    defaultLabel: 'At risk',
    swatch: PROJECT_HEALTH_TONE_COLORS.at_risk,
  },
  red: {
    color: 'error',
    labelKey: 'statOffTrack',
    defaultLabel: 'Off track',
    swatch: PROJECT_HEALTH_TONE_COLORS.off_track,
  },
  not_set: {
    color: 'default',
    labelKey: 'phHealthNotSet',
    defaultLabel: 'Not set',
    swatch: PROJECT_HEALTH_TONE_COLORS.not_set,
  },
};

const confidenceTone = (
  status: DeliveryConfidenceStatus | null | undefined
): ConfidenceTone => status ?? 'not_set';

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
          const fallback = CONFIDENCE_FALLBACK[confidenceTone(record.delivery_confidence)];
          return (
            <Flex align="center" gap={8}>
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 2,
                  background: fallback.swatch,
                  flexShrink: 0,
                }}
              />
              <Text strong ellipsis style={{ color: token.colorText }}>
                {decodeHtmlEntities(name)}
              </Text>
            </Flex>
          );
        },
      },
      {
        title: (
          <ColumnTitleWithHint
            label={t('phColDeliveryConfidence', {
              defaultValue: 'Delivery confidence',
            })}
            hint={t('phCalcColDeliveryConfidence', {
              defaultValue:
                'Delivery confidence set on the project (or Progress Tracking): On track, At risk, Off track, or Not set.',
            })}
            hintColor={token.colorTextSecondary}
          />
        ),
        key: 'delivery_confidence',
        width: '14%',
        filters: [
          { text: t('statOnTrack', { defaultValue: 'On track' }), value: 'green' },
          { text: t('statAtRisk', { defaultValue: 'At risk' }), value: 'amber' },
          { text: t('statOffTrack', { defaultValue: 'Off track' }), value: 'red' },
          { text: t('phHealthNotSet', { defaultValue: 'Not set' }), value: 'not_set' },
        ],
        onFilter: (value, record) => confidenceTone(record.delivery_confidence) === value,
        render: (_: unknown, row) => {
          const confidence = CONFIDENCE_FALLBACK[confidenceTone(row.delivery_confidence)];
          return (
            <Flex vertical gap={4}>
              <Tag color={confidence.color}>
                {t(confidence.labelKey, { defaultValue: confidence.defaultLabel })}
              </Tag>
              {row.delivery_confidence_note && (
                <Text type="secondary">
                  {decodeHtmlEntities(row.delivery_confidence_note)}
                </Text>
              )}
            </Flex>
          );
        },
      },
      {
        title: (
          <ColumnTitleWithHint
            label={t('phColProgress', { defaultValue: 'Progress' })}
            hint={t('phCalcColProgress', {
              defaultValue: 'Completed tasks ÷ total non-archived tasks × 100.',
            })}
            hintColor={token.colorTextSecondary}
            alignEnd
          />
        ),
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
          value ? dayjs(value).format('MMM D, YYYY') : <Text type="secondary">-</Text>,
      },
      {
        title: (
          <ColumnTitleWithHint
            label={t('phColOpenTasks', { defaultValue: 'Open tasks' })}
            hint={t('phCalcColOpenTasks', {
              defaultValue: 'Incomplete, non-archived tasks in the project.',
            })}
            hintColor={token.colorTextSecondary}
            alignEnd
          />
        ),
        dataIndex: 'open_tasks',
        key: 'open_tasks',
        width: '10%',
        align: 'right',
        sorter: (a, b) => a.open_tasks - b.open_tasks,
      },
      {
        title: (
          <ColumnTitleWithHint
            label={t('phColOverdue', { defaultValue: 'Overdue' })}
            hint={t('phCalcColOverdue', {
              defaultValue:
                'Incomplete, non-archived tasks whose due date is before today.',
            })}
            hintColor={token.colorTextSecondary}
            alignEnd
          />
        ),
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
        title: (
          <ColumnTitleWithHint
            label={t('phColBudgetUsed', { defaultValue: 'Budget used' })}
            hint={t('phCalcColBudgetUsed', {
              defaultValue:
                '(Task fixed costs + logged time cost) ÷ project budget × 100. Shown as — when budget is 0.',
            })}
            hintColor={token.colorTextSecondary}
            alignEnd
          />
        ),
        dataIndex: 'budget_used_pct',
        key: 'budget_used_pct',
        width: '11%',
        align: 'right',
        sorter: (a, b) => a.budget_used_pct - b.budget_used_pct,
        render: (value: number, row) =>
          row.budget > 0 ? (
            <Text style={{ color: budgetUsedColor(value) }}>{`${Math.round(value)}%`}</Text>
          ) : (
            <Text type="secondary">-</Text>
          ),
      },
      {
        title: t('phColLead', { defaultValue: 'Project lead' }),
        dataIndex: 'lead_name',
        key: 'lead_name',
        width: '12%',
        ellipsis: true,
        render: (value: string | null) =>
          value ? (
            <Text ellipsis>{decodeHtmlEntities(value)}</Text>
          ) : (
            <Text type="secondary">-</Text>
          ),
      },
    ],
    [t, token.colorText, token.colorTextSecondary]
  );
  const borderedColumns: ColumnsType<ProjectHealthRow> = useMemo(
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
    <Table<ProjectHealthRow>
      bordered
      rowKey="project_id"
      columns={borderedColumns}
      dataSource={projects}
      loading={loading}
      pagination={getClientTablePagination(20)}
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
