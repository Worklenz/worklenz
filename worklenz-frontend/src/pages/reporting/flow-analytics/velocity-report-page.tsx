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
import { Alert, Button, Card, Checkbox, Empty, Flex, Select, Skeleton, Table, Tag, Typography, theme } from '@/shared/antd-imports';
import type { TableColumnsType } from '@/shared/antd-imports';
import { useDocumentTitle } from '@/hooks/useDoumentTItle';
import { useMixpanelTracking } from '@/hooks/useMixpanelTracking';
import { evt_reporting_velocity } from '@/shared/worklenz-analytics-events';
import { type VelocitySprint, useGetVelocityQuery } from '@/api/reporting/progress-chart.api.service';
import type { OverviewWidgetConfig } from '@/api/reporting/overview-layout.api.service';
import { ReportShell, StatCard, useReportOptions } from './report-shell';

ChartJS.register(CategoryScale, LinearScale, BarElement, BarController, LineElement, LineController, PointElement, Legend, ChartTooltip);

const COMMITTED_COLOR = '#b7bdf0';
const COMPLETED_COLOR = '#4caf50';
const SPRINT_COUNT_OPTIONS = Array.from({ length: 10 }, (_, index) => ({ value: index + 3, label: String(index + 3) }));

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
  // Velocity needs sprints, so only projects that have started one are offered.
  const projects = useMemo(() => allProjects.filter(project => project.has_sprints), [allProjects]);
  const [projectId, setProjectId] = useState<string | undefined>();
  const [metric, setMetric] = useState<'story_points' | 'issue_count'>('story_points');
  const [sprintCount, setSprintCount] = useState(8);
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
      ? t('velocity.unitIssues', { defaultValue: 'issues' })
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

  const filters = (
    <>
      <Select
        showSearch
        optionFilterProp="label"
        style={{ minWidth: 220 }}
        loading={isLoadingOptions}
        placeholder={t('selectProject', { defaultValue: 'Select a project' })}
        aria-label={t('project', { defaultValue: 'Project' })}
        value={projectId}
        options={projects.map(project => ({ value: project.id, label: project.name }))}
        onChange={setProjectId}
      />
      <Select
        style={{ minWidth: 150 }}
        aria-label={t('velocity.metric', { defaultValue: 'Metric' })}
        value={metric}
        onChange={setMetric}
        options={[
          { value: 'story_points', label: t('velocity.metricStoryPoints', { defaultValue: 'Metric: Story points' }) },
          { value: 'issue_count', label: t('velocity.metricIssues', { defaultValue: 'Metric: Issues' }) },
        ]}
      />
      <Select
        style={{ minWidth: 130 }}
        aria-label={t('velocity.sprintsToShow', { defaultValue: 'Sprints to show' })}
        value={sprintCount}
        onChange={setSprintCount}
        options={SPRINT_COUNT_OPTIONS.map(option => ({
          value: option.value,
          label: t('velocity.lastSprints', { defaultValue: 'Last {{count}} sprints', count: option.value }),
        }))}
      />
      <Checkbox checked={includeSubtasks} onChange={event => setIncludeSubtasks(event.target.checked)}>
        {t('includeSubtasks', { defaultValue: 'Include sub-tasks' })}
      </Checkbox>
      <Checkbox checked={showTrend} onChange={event => setShowTrend(event.target.checked)}>
        {t('velocity.trendLine', { defaultValue: 'Trend line' })}
      </Checkbox>
    </>
  );

  let body: React.ReactNode;
  if (!projectId) {
    body = (
      <Card>
        <Empty description={
          isLoadingOptions
            ? undefined
            : projects.length
              ? t('velocity.pickProject', { defaultValue: 'Choose a project to see its velocity' })
              : t('velocity.noSprintProjects', { defaultValue: 'No project has a started sprint yet' })
        } />
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
                plugins: { legend: { position: 'bottom' } },
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
        defaultValue:
          'Track sprint velocity and compare committed versus completed work, so planning is based on what the team actually delivers.',
      })}
      filters={filters}
    >
      {body}
    </ReportShell>
  );
};

export default VelocityReportPage;
