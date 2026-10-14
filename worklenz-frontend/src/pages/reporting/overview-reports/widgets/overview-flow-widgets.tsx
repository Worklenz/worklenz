import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Bar, Line } from 'react-chartjs-2';
import {
  BarElement,
  CategoryScale,
  Chart,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip as ChartTooltip,
} from 'chart.js';
import { Button, Empty, Flex, Tag, Typography, theme } from '@/shared/antd-imports';
import type { OverviewWidgetConfig, OverviewWidgetKey } from '@/api/reporting/overview-layout.api.service';
import {
  useGetCumulativeFlowQuery,
  useGetTimeInStatusQuery,
  useGetVelocityQuery,
} from '@/api/reporting/progress-chart.api.service';
import { useOptionalOverviewData } from './OverviewDataContext';
import { useOverviewWidgetFilterSummary } from './overview-widget-filter-settings';
import { useElementSize, WidgetFrame } from './overview-stats-widgets';

Chart.register(CategoryScale, LinearScale, LineElement, PointElement, BarElement, Filler, Legend, ChartTooltip);

interface FlowWidgetProps {
  title: string;
  description?: string;
  config?: OverviewWidgetConfig;
  /** Set by the standalone report pages; on the Overview these come from the page toolbar. */
  dateRange?: { from: string; to: string } | null;
  includeArchived?: boolean;
}

const COMMITTED_COLOR = '#b7bdf0';
const COMPLETED_COLOR = '#4caf50';
const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/i;

const formatDay = (date: string): string =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });

const formatValue = (value: number): string => (Number.isInteger(value) ? String(value) : value.toFixed(1));

/** Hours below two days, days above: keeps the axis and tooltips readable for both fast and slow boards. */
const useDurationFormatter = () => {
  const { t } = useTranslation('reporting-overview');
  return (hours: number): string =>
    hours < 48
      ? t('widgetStats.hoursShort', { defaultValue: '{{value}} h', value: formatValue(Math.round(hours * 10) / 10) })
      : t('widgetStats.daysShort', { defaultValue: '{{value}} d', value: formatValue(Math.round((hours / 24) * 10) / 10) });
};

const withAlpha = (color: string, alpha: string): string => (HEX_COLOR_PATTERN.test(color) ? `${color}${alpha}` : color);

interface FlowFrameProps extends FlowWidgetProps {
  widgetType: OverviewWidgetKey;
  isIncomplete: boolean;
  needsProject: boolean;
  isError: boolean;
  isFetching: boolean;
  hasData: boolean;
  emptyMessage: string;
  onRetry: () => void;
  children: React.ReactNode;
}

/** Shared frame: picks the empty / error / "choose a project" state, otherwise renders the chart. */
const FlowFrame: React.FC<FlowFrameProps> = ({
  title,
  description,
  config,
  widgetType,
  isIncomplete,
  needsProject,
  isError,
  isFetching,
  hasData,
  emptyMessage,
  onRetry,
  children,
}) => {
  const { t } = useTranslation('reporting-overview');
  const filtersSummary = useOverviewWidgetFilterSummary(widgetType, config);

  const emptyContent = isIncomplete ? (
    <Empty
      description={
        needsProject
          ? t('widgetStats.pickProject', { defaultValue: 'Choose a project in this widget’s settings' })
          : emptyMessage
      }
    />
  ) : isError ? (
    <Empty description={t('widgetStats.loadFailed', { defaultValue: 'Could not load this chart' })}>
      <Button size="small" onClick={onRetry}>
        {t('widgetStats.retry', { defaultValue: 'Retry' })}
      </Button>
    </Empty>
  ) : (
    <Empty description={emptyMessage} />
  );

  return (
    <WidgetFrame
      title={title}
      loading={isFetching && !isIncomplete}
      empty={isIncomplete || isError || !hasData}
      emptyContent={emptyContent}
      description={description}
      filtersSummary={filtersSummary}
    >
      {children}
    </WidgetFrame>
  );
};

const Stat: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <Flex vertical>
    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
      {label}
    </Typography.Text>
    <Typography.Text strong>{value}</Typography.Text>
  </Flex>
);

/* -------------------------------------------------------------------------------------------- */
/* Velocity                                                                                      */
/* -------------------------------------------------------------------------------------------- */

export const VelocityChartWidget: React.FC<FlowWidgetProps> = ({ title, description, config }) => {
  const { t } = useTranslation('reporting-overview');
  const { token } = theme.useToken();
  const [containerRef] = useElementSize<HTMLDivElement>();

  const needsProject = !config?.projectId;
  const metric = config?.progressMetric === 'issue_count' ? 'issue_count' : 'story_points';
  const { data, isFetching, isError, refetch } = useGetVelocityQuery({ config }, { skip: needsProject });
  const velocity = data?.body;

  const metricLabel =
    metric === 'issue_count'
      ? t('widgetFilters.metricIssueCount', { defaultValue: 'Issues' })
      : t('widgetFilters.metricStoryPoints', { defaultValue: 'Story points' });

  const chartData = useMemo(() => {
    if (!velocity) return null;
    return {
      labels: velocity.sprints.map(sprint => sprint.name),
      datasets: [
        {
          label: t('widgetStats.committedText', { defaultValue: 'Committed' }),
          data: velocity.sprints.map(sprint => sprint.committed),
          backgroundColor: COMMITTED_COLOR,
          borderRadius: 4,
        },
        {
          label: t('widgetStats.completedText', { defaultValue: 'Completed' }),
          data: velocity.sprints.map(sprint => sprint.completed),
          backgroundColor: COMPLETED_COLOR,
          borderRadius: 4,
        },
      ],
    };
  }, [velocity, t]);

  const latest = velocity?.sprints[velocity.sprints.length - 1];
  const ariaLabel = velocity
    ? t('widgetStats.velocityAriaLabel', {
        defaultValue: '{{title}}: average velocity {{average}} {{metric}} per sprint over {{count}} sprints',
        title,
        average: velocity.average_velocity === null ? '0' : formatValue(velocity.average_velocity),
        metric: metricLabel.toLowerCase(),
        count: velocity.sprints.length,
      })
    : title;

  return (
    <FlowFrame
      title={title}
      description={description}
      config={config}
      widgetType="velocity_chart"
      isIncomplete={needsProject}
      needsProject={needsProject}
      isError={isError}
      isFetching={isFetching}
      hasData={Boolean(velocity?.sprints.length)}
      emptyMessage={t('widgetStats.noSprintsStarted', { defaultValue: 'No started sprints in this project yet' })}
      onRetry={refetch}
    >
      {velocity && chartData && (
        <Flex vertical gap={8} style={{ height: '100%' }}>
          <Flex gap={16} wrap="wrap" align="center">
            <Stat
              label={t('widgetStats.averageVelocity', { defaultValue: 'Average velocity' })}
              value={velocity.average_velocity === null ? '–' : formatValue(velocity.average_velocity)}
            />
            {latest && (
              <Stat
                label={t('widgetStats.latestSprint', { defaultValue: 'Latest sprint' })}
                value={`${formatValue(latest.completed)}${latest.committed !== null ? ` / ${formatValue(latest.committed)}` : ''}`}
              />
            )}
            {latest?.completion_rate != null && (
              <Tag color={latest.completion_rate >= 80 ? 'success' : latest.completion_rate >= 50 ? 'warning' : 'error'}>
                {t('widgetStats.completionRate', { defaultValue: '{{rate}}% delivered', rate: latest.completion_rate })}
              </Tag>
            )}
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {metricLabel}
            </Typography.Text>
          </Flex>
          <div ref={containerRef} role="img" aria-label={ariaLabel} style={{ flex: 1, minHeight: 0, width: '100%' }}>
            <Bar
              data={chartData}
              options={{
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                color: token.colorTextSecondary,
                plugins: { legend: { display: true, position: 'bottom' } },
                scales: {
                  x: { ticks: { color: token.colorTextSecondary }, grid: { display: false } },
                  y: { beginAtZero: true, ticks: { color: token.colorTextSecondary }, grid: { color: token.colorBorderSecondary } },
                },
              }}
            />
          </div>
        </Flex>
      )}
    </FlowFrame>
  );
};

/* -------------------------------------------------------------------------------------------- */
/* Cumulative flow                                                                               */
/* -------------------------------------------------------------------------------------------- */

export const CumulativeFlowWidget: React.FC<FlowWidgetProps> = ({ title, description, config, dateRange: dateRangeProp, includeArchived: includeArchivedProp }) => {
  const { t } = useTranslation('reporting-overview');
  const { token } = theme.useToken();
  const overview = useOptionalOverviewData();
  const dateRange = dateRangeProp ?? overview?.dateRange;
  const includeArchivedProjects = includeArchivedProp ?? overview?.includeArchivedProjects ?? false;
  const [containerRef, size] = useElementSize<HTMLDivElement>();

  const needsProject = (config?.progressScope ?? 'team') === 'project' && !config?.projectId;
  const { data, isFetching, isError, refetch } = useGetCumulativeFlowQuery(
    { config, includeArchived: includeArchivedProjects, dateRange },
    { skip: needsProject }
  );
  const flow = data?.body;

  const chartData = useMemo(() => {
    if (!flow) return null;
    // Done at the bottom, the rest stacked above it in board order: the classic CFD reading order.
    const bands = [...flow.bands].reverse();
    return {
      labels: flow.series.map(point => formatDay(point.date)),
      datasets: bands.map(band => ({
        label: band.name,
        data: flow.series.map(point => (point.counts ? (point.counts[band.id] ?? 0) : null)),
        borderColor: band.color,
        backgroundColor: withAlpha(band.color, 'b3'),
        fill: true,
        pointRadius: 0,
        borderWidth: 1,
        tension: 0,
        spanGaps: false,
      })),
    };
  }, [flow]);

  const summary = flow?.summary;
  const ariaLabel = summary
    ? t('widgetStats.flowAriaLabel', {
        defaultValue: '{{title}}: {{total}} tasks, {{inProgress}} in progress, {{done}} done',
        title,
        total: summary.total,
        inProgress: summary.in_progress,
        done: summary.done,
      })
    : title;

  return (
    <FlowFrame
      title={title}
      description={description}
      config={config}
      widgetType="cumulative_flow"
      isIncomplete={needsProject}
      needsProject={needsProject}
      isError={isError}
      isFetching={isFetching}
      hasData={Boolean(summary && (summary.total > 0 || flow?.series.some(point => point.counts && Object.values(point.counts).some(count => count > 0))))}
      emptyMessage={t('widgetStats.noFlowWork', { defaultValue: 'No tasks found for this selection' })}
      onRetry={refetch}
    >
      {flow && chartData && summary && (
        <Flex vertical gap={8} style={{ height: '100%' }}>
          <Flex gap={16} wrap="wrap" align="center">
            <Stat label={t('widgetStats.totalTasks', { defaultValue: 'Total tasks' })} value={summary.total} />
            <Stat label={t('widgetStats.inProgress', { defaultValue: 'In progress' })} value={summary.in_progress} />
            <Stat label={t('widgetStats.doneText', { defaultValue: 'Done' })} value={summary.done} />
            <Stat
              label={t('widgetStats.throughputPerDay', { defaultValue: 'Throughput / day' })}
              value={formatValue(summary.throughput_per_day)}
            />
            <Stat label={t('widgetStats.tasksAdded', { defaultValue: 'Tasks added' })} value={summary.added} />
          </Flex>
          <div ref={containerRef} role="img" aria-label={ariaLabel} style={{ flex: 1, minHeight: 0, width: '100%' }}>
            <Line
              data={chartData}
              options={{
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                color: token.colorTextSecondary,
                plugins: {
                  legend: { display: true, position: size.height > 0 && size.height < 160 ? 'right' : 'bottom' },
                },
                scales: {
                  x: { ticks: { color: token.colorTextSecondary, maxTicksLimit: 8 }, grid: { color: token.colorBorderSecondary } },
                  y: {
                    stacked: true,
                    beginAtZero: true,
                    ticks: { color: token.colorTextSecondary, precision: 0 },
                    grid: { color: token.colorBorderSecondary },
                  },
                },
              }}
            />
          </div>
        </Flex>
      )}
    </FlowFrame>
  );
};

/* -------------------------------------------------------------------------------------------- */
/* Time in status                                                                                */
/* -------------------------------------------------------------------------------------------- */

export const TimeInStatusWidget: React.FC<FlowWidgetProps> = ({ title, description, config, dateRange: dateRangeProp, includeArchived: includeArchivedProp }) => {
  const { t } = useTranslation('reporting-overview');
  const { token } = theme.useToken();
  const overview = useOptionalOverviewData();
  const dateRange = dateRangeProp ?? overview?.dateRange;
  const includeArchivedProjects = includeArchivedProp ?? overview?.includeArchivedProjects ?? false;
  const formatDuration = useDurationFormatter();
  const [containerRef] = useElementSize<HTMLDivElement>();

  const needsProject = (config?.progressScope ?? 'team') === 'project' && !config?.projectId;
  const { data, isFetching, isError, refetch } = useGetTimeInStatusQuery(
    { config, includeArchived: includeArchivedProjects, dateRange },
    { skip: needsProject }
  );
  const result = data?.body;

  const chartData = useMemo(() => {
    if (!result) return null;
    return {
      labels: result.rows.map(row => row.band.name),
      datasets: [
        {
          label: t('widgetStats.averageTimePerTask', { defaultValue: 'Average time per task' }),
          data: result.rows.map(row => row.avg_hours),
          backgroundColor: result.rows.map(row => row.band.color),
          borderRadius: 4,
        },
      ],
    };
  }, [result, t]);

  const slowest = result?.rows.slice().sort((a, b) => b.avg_hours - a.avg_hours)[0];
  const ariaLabel = result
    ? t('widgetStats.timeInStatusAriaLabel', {
        defaultValue: '{{title}}: {{count}} statuses, average {{average}} per task',
        title,
        count: result.rows.length,
        average: formatDuration(result.avg_hours_overall),
      })
    : title;

  return (
    <FlowFrame
      title={title}
      description={description}
      config={config}
      widgetType="time_in_status"
      isIncomplete={needsProject}
      needsProject={needsProject}
      isError={isError}
      isFetching={isFetching}
      hasData={Boolean(result?.rows.length)}
      emptyMessage={t('widgetStats.noFlowWork', { defaultValue: 'No tasks found for this selection' })}
      onRetry={refetch}
    >
      {result && chartData && (
        <Flex vertical gap={8} style={{ height: '100%' }}>
          <Flex gap={16} wrap="wrap" align="center">
            <Stat label={t('widgetStats.averageOverall', { defaultValue: 'Average per task' })} value={formatDuration(result.avg_hours_overall)} />
            {slowest && (
              <Stat
                label={t('widgetStats.slowestStatus', { defaultValue: 'Longest wait' })}
                value={`${slowest.band.name} · ${formatDuration(slowest.avg_hours)}`}
              />
            )}
          </Flex>
          <div ref={containerRef} role="img" aria-label={ariaLabel} style={{ flex: 1, minHeight: 0, width: '100%' }}>
            <Bar
              data={chartData}
              options={{
                indexAxis: 'y',
                maintainAspectRatio: false,
                color: token.colorTextSecondary,
                plugins: {
                  legend: { display: false },
                  tooltip: {
                    callbacks: {
                      label: context => {
                        const row = result.rows[context.dataIndex];
                        return [
                          t('widgetStats.averageTooltip', { defaultValue: 'Average: {{value}}', value: formatDuration(row.avg_hours) }),
                          t('widgetStats.medianTooltip', { defaultValue: 'Median: {{value}}', value: formatDuration(row.median_hours) }),
                          t('widgetStats.tasksTooltip', { defaultValue: 'Tasks: {{count}}', count: row.task_count }),
                        ];
                      },
                    },
                  },
                },
                scales: {
                  x: {
                    beginAtZero: true,
                    ticks: { color: token.colorTextSecondary, callback: value => formatDuration(Number(value)) },
                    grid: { color: token.colorBorderSecondary },
                  },
                  y: { ticks: { color: token.colorTextSecondary }, grid: { display: false } },
                },
              }}
            />
          </div>
        </Flex>
      )}
    </FlowFrame>
  );
};
