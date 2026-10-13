import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Line } from 'react-chartjs-2';
import {
  CategoryScale,
  Chart,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip as ChartTooltip,
} from 'chart.js';
import { Button, Empty, Flex, Tag, Tooltip, Typography, theme } from '@/shared/antd-imports';
import type { OverviewWidgetConfig } from '@/api/reporting/overview-layout.api.service';
import {
  type ProgressChartResponse,
  useGetProgressChartQuery,
} from '@/api/reporting/progress-chart.api.service';
import { useOverviewData } from './OverviewDataContext';
import { useOverviewWidgetFilterSummary } from './overview-widget-filter-settings';
import { useElementSize, WidgetFrame } from './overview-stats-widgets';

Chart.register(CategoryScale, LinearScale, LineElement, PointElement, Legend, ChartTooltip);

export type ProgressChartMode = 'burndown' | 'burnup';

interface ProgressWidgetProps {
  title: string;
  description?: string;
  config?: OverviewWidgetConfig;
}

const SCOPE_COLOR = '#ef5350';
const COMPLETED_COLOR = '#4caf50';
const REMAINING_COLOR = '#7a84df';
const FORECAST_COLOR = '#ff9800';

const formatDay = (date: string): string =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });

const formatValue = (value: number): string => (Number.isInteger(value) ? String(value) : value.toFixed(1));

/** One widget, two modes. Burndown plots what is left; burnup plots scope against completed work. */
const ProgressChartWidget: React.FC<ProgressWidgetProps & { mode: ProgressChartMode }> = ({
  mode,
  title,
  description,
  config,
}) => {
  const { t } = useTranslation('reporting-overview');
  const { token } = theme.useToken();
  const { includeArchivedProjects, dateRange } = useOverviewData();
  const [containerRef, size] = useElementSize<HTMLDivElement>();
  const widgetType = mode === 'burndown' ? 'burndown_chart' : 'burnup_chart';
  const filtersSummary = useOverviewWidgetFilterSummary(widgetType, config);

  const scope = config?.progressScope ?? 'team';
  const source = scope === 'project' ? (config?.progressSource ?? 'range') : 'range';
  const needsProject = scope === 'project' && !config?.projectId;
  const needsSprint = source === 'sprint' && !config?.sprintId;
  const isIncomplete = needsProject || needsSprint;

  const { data, isFetching, isError, refetch } = useGetProgressChartQuery(
    { config, includeArchived: includeArchivedProjects, dateRange },
    { skip: isIncomplete }
  );
  const chart: ProgressChartResponse | undefined = data?.body;

  const showIdeal = config?.showIdealLine ?? true;
  const showForecast = config?.showForecast ?? true;
  const metric = config?.progressMetric ?? 'story_points';
  const metricLabel =
    metric === 'story_points'
      ? t('widgetFilters.metricStoryPoints', { defaultValue: 'Story points' })
      : metric === 'issue_count'
        ? t('widgetFilters.metricIssueCount', { defaultValue: 'Issues' })
        : t('widgetFilters.metricEstimatedHours', { defaultValue: 'Estimated hours' });

  const chartData = useMemo(() => {
    if (!chart) return null;
    const series = chart.series;
    const labels = series.map(point => formatDay(point.date));
    const line = (label: string, values: (number | null)[], color: string, extra: Record<string, unknown> = {}) => ({
      label,
      data: values,
      borderColor: color,
      backgroundColor: color,
      pointRadius: series.length > 45 ? 0 : 2,
      tension: 0,
      spanGaps: false,
      ...extra,
    });
    const guidelineLabel = t('widgetStats.guidelineText', { defaultValue: 'Guideline' });
    const forecastLabel = t('widgetStats.forecastText', { defaultValue: 'Forecast' });
    const datasets =
      mode === 'burndown'
        ? [
            line(t('widgetStats.remainingText', { defaultValue: 'Remaining' }), series.map(p => p.remaining), REMAINING_COLOR),
            ...(showIdeal ? [line(guidelineLabel, series.map(p => p.ideal_remaining), token.colorTextQuaternary, { borderDash: [6, 4], pointRadius: 0 })] : []),
            ...(showForecast && series.some(p => p.forecast_remaining !== null)
              ? [line(forecastLabel, series.map(p => p.forecast_remaining), FORECAST_COLOR, { borderDash: [2, 4], pointRadius: 0 })]
              : []),
          ]
        : [
            line(t('widgetStats.scopeText', { defaultValue: 'Scope' }), series.map(p => p.scope), SCOPE_COLOR, { stepped: 'before' }),
            line(t('widgetStats.completedText', { defaultValue: 'Completed' }), series.map(p => p.completed), COMPLETED_COLOR),
            ...(showIdeal ? [line(guidelineLabel, series.map(p => p.ideal_completed), token.colorTextQuaternary, { borderDash: [6, 4], pointRadius: 0 })] : []),
            ...(showForecast && series.some(p => p.forecast_remaining !== null)
              ? [line(forecastLabel, series.map(p => (p.forecast_remaining === null ? null : chart.summary.scope - p.forecast_remaining)), FORECAST_COLOR, { borderDash: [2, 4], pointRadius: 0 })]
              : []),
          ];
    return { labels, datasets };
  }, [chart, mode, showIdeal, showForecast, t, token.colorTextQuaternary]);

  const summary = chart?.summary;
  const ariaLabel = summary
    ? t('widgetStats.progressAriaLabel', {
        defaultValue: '{{title}}: {{completed}} of {{scope}} {{metric}} completed, {{remaining}} remaining',
        title,
        completed: formatValue(summary.completed),
        scope: formatValue(summary.scope),
        remaining: formatValue(summary.remaining),
        metric: metricLabel.toLowerCase(),
      })
    : title;

  const emptyContent = isIncomplete ? (
    <Empty
      description={
        needsProject
          ? t('widgetStats.pickProject', { defaultValue: 'Choose a project in this widget’s settings' })
          : t('widgetStats.pickSprint', { defaultValue: 'Choose a sprint in this widget’s settings' })
      }
    />
  ) : isError ? (
    <Empty description={t('widgetStats.loadFailed', { defaultValue: 'Could not load this chart' })}>
      <Button size="small" onClick={() => refetch()}>
        {t('widgetStats.retry', { defaultValue: 'Retry' })}
      </Button>
    </Empty>
  ) : (
    <Empty description={t('widgetStats.noProgressWork', { defaultValue: 'No work found for this selection' })} />
  );

  const hasWork = Boolean(chart && (chart.summary.scope > 0 || chart.series.some(point => (point.scope ?? 0) > 0)));

  return (
    <WidgetFrame
      title={title}
      loading={isFetching && !isIncomplete}
      empty={isIncomplete || isError || !hasWork}
      emptyContent={emptyContent}
      description={description}
      filtersSummary={filtersSummary}
    >
      {chart && chartData && summary && (
        <Flex vertical gap={8} style={{ height: '100%' }}>
          <Flex gap={16} wrap="wrap" align="center">
            <Flex vertical>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {t('widgetStats.scopeText', { defaultValue: 'Scope' })}
              </Typography.Text>
              <Typography.Text strong>{formatValue(summary.scope)}</Typography.Text>
            </Flex>
            <Flex vertical>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {t('widgetStats.completedText', { defaultValue: 'Completed' })}
              </Typography.Text>
              <Typography.Text strong>{formatValue(summary.completed)}</Typography.Text>
            </Flex>
            <Flex vertical>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {t('widgetStats.remainingText', { defaultValue: 'Remaining' })}
              </Typography.Text>
              <Typography.Text strong>{formatValue(summary.remaining)}</Typography.Text>
            </Flex>
            <Flex vertical>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {t('widgetStats.scopeChange', { defaultValue: 'Scope change' })}
              </Typography.Text>
              <Typography.Text strong type={summary.scope_change > 0 ? 'danger' : undefined}>
                {summary.scope_change > 0 ? '+' : ''}
                {formatValue(summary.scope_change)}
              </Typography.Text>
            </Flex>
            {summary.on_track !== null && (
              <Tooltip
                title={
                  summary.projected_finish
                    ? t('widgetStats.projectedFinish', {
                        defaultValue: 'Projected finish: {{date}}',
                        date: formatDay(summary.projected_finish),
                      })
                    : undefined
                }
              >
                <Tag color={summary.on_track ? 'success' : 'error'}>
                  {summary.on_track
                    ? t('widgetStats.onTrack', { defaultValue: 'On track' })
                    : t('widgetStats.behindSchedule', { defaultValue: 'Behind schedule' })}
                </Tag>
              </Tooltip>
            )}
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {chart.sprint ? `${chart.sprint.name} · ` : ''}
              {metricLabel}
            </Typography.Text>
          </Flex>
          <div
            ref={containerRef}
            role="img"
            aria-label={ariaLabel}
            style={{ flex: 1, minHeight: 0, width: '100%' }}
          >
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
                  y: { beginAtZero: true, ticks: { color: token.colorTextSecondary }, grid: { color: token.colorBorderSecondary } },
                },
              }}
            />
          </div>
          {chart.has_estimated_history && (
            <Typography.Text type="secondary" style={{ fontSize: 11 }}>
              {t('widgetStats.estimatedHistory', {
                defaultValue: 'Earlier history is estimated from task dates; changes are tracked exactly from now on.',
              })}
            </Typography.Text>
          )}
        </Flex>
      )}
    </WidgetFrame>
  );
};

export const BurndownChartWidget: React.FC<ProgressWidgetProps> = props => <ProgressChartWidget mode="burndown" {...props} />;
export const BurnupChartWidget: React.FC<ProgressWidgetProps> = props => <ProgressChartWidget mode="burnup" {...props} />;
