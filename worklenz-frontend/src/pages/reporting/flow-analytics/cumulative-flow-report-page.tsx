import React, { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Line } from 'react-chartjs-2';
import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip as ChartTooltip,
} from 'chart.js';
import { Alert, Button, Card, Empty, Flex, Skeleton, Spin, Typography, theme } from '@/shared/antd-imports';
import { useDocumentTitle } from '@/hooks/useDoumentTItle';
import { useMixpanelTracking } from '@/hooks/useMixpanelTracking';
import { evt_reporting_cumulative_flow } from '@/shared/worklenz-analytics-events';
import { useGetCumulativeFlowQuery } from '@/api/reporting/progress-chart.api.service';
import { ReportShell, StatCard, useDefaultLastWeekFilter, useReportDateRange } from './report-shell';
import CumulativeFlowToolbar from './cumulative-flow/cumulative-flow-toolbar';
import { useCumulativeFlowFilters } from './cumulative-flow/use-cumulative-flow-filters';

ChartJS.register(CategoryScale, LinearScale, LineElement, PointElement, Filler, Legend, ChartTooltip);

const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/i;

const withAlpha = (color: string, alpha: string): string => (HEX_COLOR_PATTERN.test(color) ? `${color}${alpha}` : color);
const formatDay = (date: string): string =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });
const formatValue = (value: number): string => (Number.isInteger(value) ? String(value) : value.toFixed(1));

export const CumulativeFlowReportPage = () => {
  const { t } = useTranslation('reporting-flow');
  const { token } = theme.useToken();
  const { trackMixpanelEvent } = useMixpanelTracking();
  useDocumentTitle(t('cfd.title', { defaultValue: 'Cumulative Flow Diagram' }));

  // Always open on "Last 7 days". The date filter reads the shared duration when it mounts, so set it first.
  const isDateFilterReady = useDefaultLastWeekFilter();
  const dateRange = useReportDateRange();
  const { filters, updateFilters, resetFilters, flowArgs } = useCumulativeFlowFilters(dateRange);

  useEffect(() => {
    trackMixpanelEvent(evt_reporting_cumulative_flow);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { data, isLoading, isFetching, isError, refetch } = useGetCumulativeFlowQuery(flowArgs, {
    skip: !isDateFilterReady,
  });
  const flow = data?.body;
  const { selectedStages } = filters;

  const stageOptions = useMemo(
    () => (flow?.bands ?? []).map(band => ({ id: band.id, name: band.name, color: band.color })),
    [flow]
  );

  const chartData = useMemo(() => {
    if (!flow) return null;
    // Done at the bottom, the rest stacked above it in board order: the classic CFD reading order.
    const visible = [...flow.bands]
      .reverse()
      .filter(band => selectedStages.length === 0 || selectedStages.includes(band.id));
    return {
      labels: flow.series.map(point => formatDay(point.date)),
      datasets: visible.map(band => ({
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
  }, [flow, selectedStages]);

  const summary = flow?.summary;
  const hasTasks = Boolean(summary && summary.total > 0);

  let body: React.ReactNode;
  if (isLoading) {
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
  } else if (!flow || !summary || !chartData || !hasTasks) {
    body = (
      <Card>
        <Empty description={t('noTasks', { defaultValue: 'No tasks found for this selection' })} />
      </Card>
    );
  } else {
    body = (
      <>
        <Flex gap={12} wrap="wrap">
          <StatCard
            label={t('cfd.avgCycleTime', { defaultValue: 'Avg cycle time' })}
            value={
              summary.avg_cycle_days === null
                ? '–'
                : t('cfd.daysValue', { defaultValue: '{{value}} days', value: formatValue(summary.avg_cycle_days) })
            }
            caption={t('cfd.cycleCaption', { defaultValue: 'Created → done, for tasks finished in this period' })}
            tone="colorPrimary"
          />
          <StatCard
            label={t('cfd.throughput', { defaultValue: 'Throughput' })}
            value={t('cfd.perWeekValue', {
              defaultValue: '{{value}} items/wk',
              value: formatValue(Math.round(summary.throughput_per_day * 7 * 10) / 10),
            })}
            caption={t('cfd.throughputCaption', { defaultValue: 'Average over this period' })}
            tone="colorSuccess"
          />
          <StatCard
            label={t('cfd.currentWip', { defaultValue: 'Current WIP' })}
            value={summary.in_progress}
            caption={t('cfd.wipCaption', { defaultValue: 'Tasks in progress today' })}
            tone="colorWarning"
          />
          <StatCard
            label={t('cfd.tasksAdded', { defaultValue: 'Tasks added' })}
            value={summary.added}
            caption={t('cfd.addedCaption', { defaultValue: 'New work in this period' })}
          />
        </Flex>
        <Card title={t('cfd.chartTitle', { defaultValue: 'Cumulative flow' })}>
          <div
            role="img"
            aria-label={t('cfd.chartAria', {
              defaultValue: 'Cumulative flow: {{total}} tasks, {{inProgress}} in progress, {{done}} done',
              total: summary.total,
              inProgress: summary.in_progress,
              done: summary.done,
            })}
            style={{ height: 380 }}
          >
            <Line
              data={chartData}
              options={{
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                color: token.colorTextSecondary,
                plugins: { legend: { position: 'bottom' } },
                scales: {
                  x: { ticks: { color: token.colorTextSecondary, maxTicksLimit: 10 }, grid: { color: token.colorBorderSecondary } },
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
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {t('cfd.reading', {
              defaultValue: 'Parallel bands mean healthy flow. A band that keeps widening points to a bottleneck in that stage.',
            })}
          </Typography.Text>
        </Card>
      </>
    );
  }

  if (!isDateFilterReady) return null;

  return (
    <ReportShell
      title={t('cfd.title', { defaultValue: 'Cumulative Flow Diagram' })}
      subtitle={t('cfd.subtitle', { defaultValue: 'See how work accumulates across workflow stages over time.' })}
      actions={
        <CumulativeFlowToolbar
          filters={filters}
          stageOptions={stageOptions}
          isLoadingStages={isLoading}
          onFiltersChange={updateFilters}
          onFiltersReset={resetFilters}
        />
      }
    >
      {/* Keep the previous chart in view, dimmed, while a changed filter reloads. */}
      <Spin spinning={isFetching && !isLoading}>
        <Flex vertical gap={16}>
          {body}
        </Flex>
      </Spin>
    </ReportShell>
  );
};

export default CumulativeFlowReportPage;
