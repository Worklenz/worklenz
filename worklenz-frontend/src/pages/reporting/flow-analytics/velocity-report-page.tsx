import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Chart } from 'react-chartjs-2';
import {
  BarController,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  type ChartData,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Tooltip as ChartTooltip,
} from 'chart.js';
import { Alert, Button, Card, Dropdown, Empty, Flex, Skeleton, Table, Tag, Tooltip, Typography, theme } from '@/shared/antd-imports';
import { DownOutlined, InfoCircleOutlined } from '@/shared/antd-imports';
import type { TableColumnsType } from '@/shared/antd-imports';
import { useDocumentTitle } from '@/hooks/useDoumentTItle';
import { reportingExportApiService } from '@/api/reporting/reporting-export.api.service';
import { useMixpanelTracking } from '@/hooks/useMixpanelTracking';
import { evt_reporting_velocity } from '@/shared/worklenz-analytics-events';
import { type VelocitySprint, useGetVelocityQuery } from '@/api/reporting/progress-chart.api.service';
import type { OverviewWidgetConfig } from '@/api/reporting/overview-layout.api.service';
import { ReportShell, StatCard, useReportOptions } from './report-shell';
import VelocityFilterPanel, {
  DEFAULT_SPRINT_COUNT,
  DEFAULT_VELOCITY_METRIC,
  type VelocityFilters,
  type VelocityMetric,
} from './velocity/velocity-filter-panel';

ChartJS.register(CategoryScale, LinearScale, BarElement, BarController, LineElement, LineController, PointElement, Legend, ChartTooltip);

const COMMITTED_COLOR = '#b7bdf0';
const COMPLETED_COLOR = '#4caf50';

const formatValue = (value: number): string => (Number.isInteger(value) ? String(value) : value.toFixed(1));
const formatDate = (value: string | null): string =>
  value ? new Date(`${value}T00:00:00Z`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' }) : '–';

/** Least-squares line through the completed values, one point per sprint. */
const trendLine = (values: number[]): number[] => {
  const n = values.length;
  if (n < 2) return values;
  const meanX = (n - 1) / 2;
  const meanY = values.reduce((sum, value) => sum + value, 0) / n;
  let numerator = 0;
  let denominator = 0;
  values.forEach((value, index) => {
    numerator += (index - meanX) * (value - meanY);
    denominator += (index - meanX) ** 2;
  });
  const slope = denominator === 0 ? 0 : numerator / denominator;
  return values.map((_, index) => Math.round((meanY + slope * (index - meanX)) * 100) / 100);
};

const accuracyTone = (rate: number | null): 'success' | 'warning' | 'error' | 'default' =>
  rate === null ? 'default' : rate >= 90 ? 'success' : rate >= 75 ? 'warning' : 'error';

export const VelocityReportPage = () => {
  const { t } = useTranslation('reporting-flow');
  const { token } = theme.useToken();
  const { trackMixpanelEvent } = useMixpanelTracking();
  useDocumentTitle(t('velocity.title', { defaultValue: 'Velocity Charts' }));

  const { projects: allProjects, isFetching: isLoadingOptions } = useReportOptions();
  // Velocity needs sprints, so only Software projects that have started one are offered.
  const projects = useMemo(
    () => allProjects.filter(project => project.project_type === 'software' && project.has_sprints),
    [allProjects]
  );
  const [projectId, setProjectId] = useState<string | undefined>();
  const [metric, setMetric] = useState<VelocityMetric>(DEFAULT_VELOCITY_METRIC);
  const [sprintCount, setSprintCount] = useState(DEFAULT_SPRINT_COUNT);
  const [includeSubtasks, setIncludeSubtasks] = useState(false);
  const [showTrend, setShowTrend] = useState(false);

  useEffect(() => {
    trackMixpanelEvent(evt_reporting_velocity);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!projectId && projects.length) setProjectId(projects[0].id);
  }, [projects, projectId]);

  const config = useMemo<OverviewWidgetConfig>(
    () => ({ projectId, progressMetric: metric, sprintCount, includeSubtasks }),
    [projectId, metric, sprintCount, includeSubtasks]
  );
  const { data, isLoading, isFetching, isError, refetch } = useGetVelocityQuery({ config }, { skip: !projectId });
  const velocity = data?.body;

  const unit =
    metric === 'issue_count'
      ? t('velocity.unitIssues', { defaultValue: 'tasks' })
      : t('velocity.unitPoints', { defaultValue: 'pts' });

  const chartData = useMemo<ChartData<'bar' | 'line', (number | null)[], string> | null>(() => {
    if (!velocity?.sprints.length) return null;
    const sprints = velocity.sprints;
    const labels = sprints.map(sprint => sprint.name);
    const datasets: ChartData<'bar' | 'line', (number | null)[], string>['datasets'] = [
      { type: 'bar', label: t('velocity.committed', { defaultValue: 'Committed' }), data: sprints.map(sprint => sprint.committed), backgroundColor: COMMITTED_COLOR, borderRadius: 4 },
      { type: 'bar', label: t('velocity.completed', { defaultValue: 'Completed' }), data: sprints.map(sprint => sprint.completed), backgroundColor: COMPLETED_COLOR, borderRadius: 4 },
    ];
    if (velocity.average_velocity !== null) {
      datasets.push({
        type: 'line',
        label: t('velocity.average', { defaultValue: 'Average velocity ({{value}})', value: formatValue(velocity.average_velocity) }),
        data: sprints.map(() => velocity.average_velocity),
        borderColor: token.colorWarning,
        backgroundColor: token.colorWarning,
        borderDash: [6, 4],
        pointRadius: 0,
        borderWidth: 2,
      });
    }
    if (showTrend) {
      datasets.push({
        type: 'line',
        label: t('velocity.trend', { defaultValue: 'Trend' }),
        data: trendLine(sprints.map(sprint => sprint.completed)),
        borderColor: token.colorPrimary,
        backgroundColor: token.colorPrimary,
        pointRadius: 0,
        borderWidth: 2,
      });
    }
    return { labels, datasets };
  }, [velocity, showTrend, token.colorWarning, token.colorPrimary, t]);

  const columns: TableColumnsType<VelocitySprint> = [
    {
      title: t('velocity.sprint', { defaultValue: 'Sprint' }),
      dataIndex: 'name',
      render: (name: string, sprint) => (
        <Flex gap={6} align="center">
          <Typography.Text strong>{name}</Typography.Text>
          {sprint.sprint_status === 'active' && <Tag color="processing">{t('velocity.active', { defaultValue: 'Active' })}</Tag>}
        </Flex>
      ),
    },
    { title: t('velocity.start', { defaultValue: 'Start' }), dataIndex: 'start_date', render: formatDate },
    { title: t('velocity.end', { defaultValue: 'End' }), dataIndex: 'end_date', render: formatDate },
    {
      title: t('velocity.committed', { defaultValue: 'Committed' }),
      dataIndex: 'committed',
      align: 'right',
      render: (value: number | null) => (value === null ? '–' : formatValue(value)),
    },
    { title: t('velocity.completed', { defaultValue: 'Completed' }), dataIndex: 'completed', align: 'right', render: formatValue },
    {
      title: t('velocity.accuracy', { defaultValue: 'Accuracy' }),
      dataIndex: 'completion_rate',
      align: 'right',
      render: (rate: number | null) => (rate === null ? '–' : <Tag color={accuracyTone(rate)}>{rate}%</Tag>),
    },
    {
      title: t('velocity.delta', { defaultValue: 'Delta' }),
      key: 'delta',
      align: 'right',
      render: (_: unknown, sprint) => {
        if (sprint.committed === null) return '–';
        const delta = Math.round((sprint.completed - sprint.committed) * 100) / 100;
        return (
          <Typography.Text type={delta < 0 ? 'danger' : delta > 0 ? 'success' : undefined}>
            {delta > 0 ? '+' : ''}
            {formatValue(delta)}
          </Typography.Text>
        );
      },
    },
  ];

  const filters: VelocityFilters = { projectId, metric, sprintCount, includeSubtasks, showTrend };
  const updateFilters = (patch: Partial<VelocityFilters>) => {
    if ('projectId' in patch) setProjectId(patch.projectId);
    if (patch.metric !== undefined) setMetric(patch.metric);
    if (patch.sprintCount !== undefined) setSprintCount(patch.sprintCount);
    if (patch.includeSubtasks !== undefined) setIncludeSubtasks(patch.includeSubtasks);
    if (patch.showTrend !== undefined) setShowTrend(patch.showTrend);
  };
  // Clear keeps the chosen project: the report cannot render without one.
  const resetFilters = () =>
    updateFilters({ metric: DEFAULT_VELOCITY_METRIC, sprintCount: DEFAULT_SPRINT_COUNT, includeSubtasks: false, showTrend: false });

  const exportReport = () => {
    if (!projectId) return;
    reportingExportApiService.exportVelocity({ projectId, metric, sprintCount, includeSubtasks, trend: showTrend });
  };
  const exportItems = [
    {
      key: 'excel',
      label: t('velocity.exportExcel', { defaultValue: 'Excel' }),
      onClick: exportReport,
    },
  ];

  const legendItems: { key: string; label: string; hint: string; swatch: string; isLine?: boolean }[] = [
    {
      key: 'committed',
      label: t('velocity.committed', { defaultValue: 'Committed' }),
      hint: t('velocity.committedHint', {
        defaultValue: 'Work in the sprint when it started. Anything added later does not count.',
      }),
      swatch: COMMITTED_COLOR,
    },
    {
      key: 'completed',
      label: t('velocity.completed', { defaultValue: 'Completed' }),
      hint: t('velocity.completedHint', {
        defaultValue: 'Work finished (moved to a done status) by the time the sprint ended, or so far for an active sprint.',
      }),
      swatch: COMPLETED_COLOR,
    },
    ...(velocity?.average_velocity != null
      ? [
          {
            key: 'average',
            label: t('velocity.average', { defaultValue: 'Average velocity ({{value}})', value: formatValue(velocity.average_velocity) }),
            hint: t('velocity.averageHint', {
              defaultValue: 'The mean of completed work across finished sprints. Use it to size the next sprint.',
            }),
            swatch: token.colorWarning,
            isLine: true,
          },
        ]
      : []),
    ...(showTrend
      ? [
          {
            key: 'trend',
            label: t('velocity.trend', { defaultValue: 'Trend' }),
            hint: t('velocity.trendHint', {
              defaultValue: 'A best-fit line through completed work per sprint. Rising means the team is delivering more over time.',
            }),
            swatch: token.colorPrimary,
            isLine: true,
          },
        ]
      : []),
  ];

  let body: React.ReactNode;
  // Options still loading, or the first project is about to be picked: show the loader, not an empty state.
  if (isLoadingOptions || (!projectId && projects.length > 0)) {
    body = <Skeleton active paragraph={{ rows: 10 }} />;
  } else if (!projectId) {
    body = (
      <Card>
        <Empty description={t('velocity.noSprintProjects', { defaultValue: 'No Software project has a started sprint yet' })} />
      </Card>
    );
  } else if (isLoading) {
    body = <Skeleton active paragraph={{ rows: 10 }} />;
  } else if (isError) {
    body = (
      <Alert
        type="error"
        showIcon
        message={t('loadFailed', { defaultValue: 'Could not load this report' })}
        action={<Button size="small" onClick={() => refetch()}>{t('retry', { defaultValue: 'Retry' })}</Button>}
      />
    );
  } else if (!velocity?.sprints.length || !chartData) {
    body = (
      <Card>
        <Empty description={t('velocity.noSprints', { defaultValue: 'This project has no started sprints yet' })} />
      </Card>
    );
  } else {
    body = (
      <>
        <Flex gap={12} wrap="wrap">
          <StatCard
            label={t('velocity.avgVelocity', { defaultValue: 'Avg velocity' })}
            value={velocity.average_velocity === null ? '–' : `${formatValue(velocity.average_velocity)} ${unit}`}
            caption={t('velocity.perSprint', { defaultValue: 'Per completed sprint' })}
            tone="colorPrimary"
          />
          <StatCard
            label={t('velocity.bestSprint', { defaultValue: 'Best sprint' })}
            value={velocity.best_sprint ? `${formatValue(velocity.best_sprint.completed)} ${unit}` : '–'}
            caption={velocity.best_sprint?.name}
            tone="colorSuccess"
          />
          <StatCard
            label={t('velocity.worstSprint', { defaultValue: 'Worst sprint' })}
            value={velocity.worst_sprint ? `${formatValue(velocity.worst_sprint.completed)} ${unit}` : '–'}
            caption={velocity.worst_sprint?.name}
            tone="colorError"
          />
          <StatCard
            label={t('velocity.commitmentAccuracy', { defaultValue: 'Commitment accuracy' })}
            value={velocity.commitment_accuracy === null ? '–' : `${velocity.commitment_accuracy}%`}
            caption={t('velocity.committedVsCompleted', { defaultValue: 'Committed vs completed' })}
            tone="colorWarning"
          />
        </Flex>
        <Card
          title={t('velocity.chartTitle', { defaultValue: 'Sprint velocity: committed vs completed' })}
          loading={isFetching && !velocity}
        >
          <Flex gap={16} wrap="wrap" justify="center" style={{ marginBottom: 12 }}>
            {legendItems.map(item => (
              <Tooltip key={item.key} title={item.hint}>
                <Flex gap={6} align="center" tabIndex={0} style={{ cursor: 'help' }}>
                  <span
                    aria-hidden
                    style={{
                      width: item.isLine ? 16 : 12,
                      height: item.isLine ? 3 : 12,
                      borderRadius: item.isLine ? 2 : 3,
                      background: item.swatch,
                    }}
                  />
                  <Typography.Text style={{ fontSize: 13 }}>{item.label}</Typography.Text>
                  <InfoCircleOutlined aria-label={item.hint} style={{ fontSize: 12, color: token.colorTextTertiary }} />
                </Flex>
              </Tooltip>
            ))}
          </Flex>
          <div
            role="img"
            aria-label={t('velocity.chartAria', {
              defaultValue: 'Committed and completed {{unit}} for the last {{count}} sprints',
              unit,
              count: velocity.sprints.length,
            })}
            style={{ height: 340 }}
          >
            <Chart
              type="bar"
              data={chartData}
              options={{
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                color: token.colorTextSecondary,
                plugins: { legend: { display: false } },
                scales: {
                  x: { ticks: { color: token.colorTextSecondary }, grid: { display: false } },
                  y: { beginAtZero: true, ticks: { color: token.colorTextSecondary }, grid: { color: token.colorBorderSecondary } },
                },
              }}
            />
          </div>
        </Card>
        <Card title={t('velocity.sprintData', { defaultValue: 'Sprint data' })}>
          <Table<VelocitySprint>
            size="small"
            rowKey="sprint_id"
            columns={columns}
            dataSource={velocity.sprints}
            pagination={false}
            scroll={{ x: 'max-content' }}
          />
        </Card>
      </>
    );
  }

  return (
    <ReportShell
      title={t('velocity.title', { defaultValue: 'Velocity Charts' })}
      subtitle={t('velocity.subtitle', {
        defaultValue: 'Compare committed and completed work per sprint. Software project type only.',
      })}
      actions={
        <Flex gap={8} align="center">
          <VelocityFilterPanel
            filters={filters}
            projectOptions={projects}
            isLoadingProjects={isLoadingOptions}
            onChange={updateFilters}
            onReset={resetFilters}
          />
          <Dropdown menu={{ items: exportItems }} trigger={['click']} disabled={!projectId}>
            <Button icon={<DownOutlined />} iconPosition="end">
              {t('velocity.exportButton', { defaultValue: 'Export' })}
            </Button>
          </Dropdown>
        </Flex>
      }
    >
      {body}
    </ReportShell>
  );
};

export default VelocityReportPage;
