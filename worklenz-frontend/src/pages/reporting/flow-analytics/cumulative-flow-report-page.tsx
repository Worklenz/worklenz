import React, { useEffect, useMemo, useState } from 'react';
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
import { Alert, Button, Card, Checkbox, Empty, Flex, Select, Skeleton, Typography, theme } from '@/shared/antd-imports';
import { useDocumentTitle } from '@/hooks/useDoumentTItle';
import { useMixpanelTracking } from '@/hooks/useMixpanelTracking';
import { evt_reporting_cumulative_flow } from '@/shared/worklenz-analytics-events';
import { useGetCumulativeFlowQuery } from '@/api/reporting/progress-chart.api.service';
import type { OverviewWidgetConfig } from '@/api/reporting/overview-layout.api.service';
import { ReportRangePicker, ReportShell, StatCard, useReportDateRange, useReportOptions } from './report-shell';

ChartJS.register(CategoryScale, LinearScale, LineElement, PointElement, Filler, Legend, ChartTooltip);

const ALL_PROJECTS = 'all';
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

  const { projects, isFetching: isLoadingOptions } = useReportOptions();
  const { range, setRange, dateRange } = useReportDateRange();
  const [projectId, setProjectId] = useState<string>(ALL_PROJECTS);
  const [includeSubtasks, setIncludeSubtasks] = useState(false);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [hiddenBands, setHiddenBands] = useState<string[]>([]);

  useEffect(() => {
    trackMixpanelEvent(evt_reporting_cumulative_flow);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isTeam = projectId === ALL_PROJECTS;
  const config = useMemo<OverviewWidgetConfig>(
    () => ({ progressScope: isTeam ? 'team' : 'project', projectId: isTeam ? undefined : projectId, includeSubtasks }),
    [isTeam, projectId, includeSubtasks]
  );
  const { data, isLoading, isError, refetch } = useGetCumulativeFlowQuery({ config, includeArchived, dateRange });
  const flow = data?.body;

  const handleProjectChange = (value: string) => {
    setProjectId(value);
    setHiddenBands([]);
  };

  const chartData = useMemo(() => {
    if (!flow) return null;
    // Done at the bottom, the rest stacked above it in board order: the classic CFD reading order.
    const visible = [...flow.bands].reverse().filter(band => !hiddenBands.includes(band.id));
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
  }, [flow, hiddenBands]);

  const summary = flow?.summary;
  const hasTasks = Boolean(summary && summary.total > 0);

  const filters = (
    <>
      <Select
        showSearch
        optionFilterProp="label"
        style={{ minWidth: 220 }}
        loading={isLoadingOptions}
        aria-label={t('project', { defaultValue: 'Project' })}
        value={projectId}
        onChange={handleProjectChange}
        options={[
          { value: ALL_PROJECTS, label: t('allProjects', { defaultValue: 'All projects (active team)' }) },
          ...projects.map(project => ({ value: project.id, label: project.name })),
        ]}
      />
      <ReportRangePicker value={range} onChange={setRange} />
      <Checkbox checked={includeSubtasks} onChange={event => setIncludeSubtasks(event.target.checked)}>
        {t('includeSubtasks', { defaultValue: 'Include sub-tasks' })}
      </Checkbox>
      {isTeam && (
        <Checkbox checked={includeArchived} onChange={event => setIncludeArchived(event.target.checked)}>
          {t('includeArchived', { defaultValue: 'Include archived projects' })}
        </Checkbox>
      )}
      {flow && flow.bands.length > 0 && (
        <Flex gap={4} wrap="wrap" align="center" role="group" aria-label={t('cfd.stages', { defaultValue: 'Stages' })}>
          <Typography.Text type="secondary">{t('cfd.stages', { defaultValue: 'Stages' })}:</Typography.Text>
          <Checkbox.Group
            value={flow.bands.map(band => band.id).filter(id => !hiddenBands.includes(id))}
            options={flow.bands.map(band => ({ value: band.id, label: band.name }))}
            onChange={checked => setHiddenBands(flow.bands.map(band => band.id).filter(id => !checked.includes(id)))}
          />
        </Flex>
      )}
    </>
  );

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
            value={t('cfd.perWeekValue', { defaultValue: '{{value}} items/wk', value: formatValue(Math.round(summary.throughput_per_day * 7 * 10) / 10) })}
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

  return (
    <ReportShell
      title={t('cfd.title', { defaultValue: 'Cumulative Flow Diagram' })}
      subtitle={t('cfd.subtitle', {
        defaultValue:
          'See how work accumulates across workflow stages over time. The thickness of each band is the number of tasks in that stage; widening bands reveal bottlenecks.',
      })}
      filters={filters}
    >
      {body}
    </ReportShell>
  );
};

export default CumulativeFlowReportPage;
