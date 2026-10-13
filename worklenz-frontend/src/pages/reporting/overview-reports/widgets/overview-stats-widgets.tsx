import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import { ArcElement, BarElement, CategoryScale, Chart, Legend, LinearScale, LineElement, PointElement, Tooltip as ChartTooltip } from 'chart.js';
import { Card, Empty, Flex, Table, Tooltip, Typography } from '@/shared/antd-imports';
import type { OverviewWidgetConfig, OverviewWidgetKey } from '@/api/reporting/overview-layout.api.service';
import { useGetOverviewWidgetStatsQuery, type ProjectWidgetType } from '@/api/reporting/overview-widgets-stats.api.service';
import { resolveChartType, resolveSeriesColors, useOverviewWidgetFilterSummary } from './overview-widget-filter-settings';
import { useOverviewData } from './OverviewDataContext';
import { WorklenzLogoLoader } from '@/components/worklenz-loader/worklenz-loader';
import { ViewLargerButton, WidgetViewLargerModal } from '@/components/dashboard-grid';

Chart.register(ArcElement, BarElement, CategoryScale, LinearScale, LineElement, PointElement, Legend, ChartTooltip);

const DOUGHNUT_COLORS = ['#7a84df', '#c191cc', '#4caf50', '#ff9800', '#ef5350', '#29b6f6', '#8d6e63', '#78909c'];

const WidgetFrame: React.FC<{
  title: string;
  loading: boolean;
  empty: boolean;
  /** What the chart/table is showing (the widget's catalogue description), shown first in the tooltip. */
  description?: string;
  /** Active filters for this instance (teams, billable, archived), shown below the description. */
  filtersSummary?: string[];
  children: React.ReactNode;
}> = ({ title, loading, empty, description, filtersSummary, children }) => {
  const [viewLarger, setViewLarger] = useState(false);
  const hasTooltip = Boolean(description) || Boolean(filtersSummary?.length);
  const titleNode = hasTooltip ? (
    <Tooltip
      title={
        <Flex vertical gap={4}>
          {description && <span>{description}</span>}
          {filtersSummary?.length ? (
            <Flex vertical gap={2}>
              {filtersSummary.map((line, index) => (
                <span key={index}>{line}</span>
              ))}
            </Flex>
          ) : null}
        </Flex>
      }
    >
      <span>{title}</span>
    </Tooltip>
  ) : (
    title
  );
  const body = loading ? (
    <Flex align="center" justify="center" style={{ height: '100%' }}>
      <WorklenzLogoLoader scale={0.6} />
    </Flex>
  ) : empty ? (
    <Empty />
  ) : (
    children
  );
  return (
    <>
      <Card
        title={titleNode}
        extra={<ViewLargerButton title={title} i18nNamespace="reporting-overview" onClick={() => setViewLarger(true)} />}
        style={{ height: '100%' }}
        styles={{ body: { height: 'calc(100% - 57px)', overflow: 'auto' } }}
      >
        {body}
      </Card>
      <WidgetViewLargerModal title={title} open={viewLarger} onClose={() => setViewLarger(false)}>
        {body}
      </WidgetViewLargerModal>
    </>
  );
};

/** Shared by every stats widget below: resolves its effective chart type and filter summary. */
const useWidgetChrome = (type: OverviewWidgetKey, config: OverviewWidgetConfig | undefined) => ({
  chartType: resolveChartType(type, config),
  filtersSummary: useOverviewWidgetFilterSummary(type, config),
  hideDataLabels: config?.hideDataLabels ?? false,
});

const useWidgetStats = (widget: ProjectWidgetType, config: OverviewWidgetConfig | undefined) => {
  const { includeArchivedProjects, dateRange } = useOverviewData();
  return useGetOverviewWidgetStatsQuery({
    widget,
    config,
    pageDefaults: { includeArchived: includeArchivedProjects },
    dateRange,
  });
};

interface ChartSeries {
  label: string;
  data: number[];
  color: string;
}

/** A container's rendered size, tracked live via ResizeObserver - so chart chrome (legend
 *  placement) can react to the widget's actual on-screen size (drag-resize, breakpoint changes)
 *  instead of a fixed assumption. */
const useElementSize = <T extends HTMLElement>() => {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, size] as const;
};

/** Legend on the right needs enough spare width beside the chart to be worth it; narrower or
 *  squarer widgets keep it below instead, where it has the full width to wrap into. */
const legendPositionFor = (size: { width: number; height: number }): 'right' | 'bottom' =>
  size.width >= 360 && size.width >= size.height ? 'right' : 'bottom';

/**
 * Renders one widget's data as whichever chart type its settings picked (Bar/Stacked/Line/Donut),
 * or as a single big number. Shared by every chart-based stats widget below, so a widget only has
 * to shape its rows into labels + series:
 *  - `bar`/`stacked`: a (possibly multi-series) bar chart; `stacked` stacks the series instead of
 *    grouping them side by side.
 *  - `line`: the same series as a line chart.
 *  - `donut`: only the first series, as slices (a donut can't show more than one series at once).
 *  - `number`: the first series summed to one figure, with an optional caption.
 * A chart type that doesn't naturally fit a widget's data (e.g. Donut on a two-series comparison)
 * still renders something sensible rather than erroring, per how the setting is offered uniformly.
 * The legend (when shown) sits to the right on a widget wide enough for it, bottom otherwise.
 */
const ChartByType: React.FC<{
  chartType: NonNullable<OverviewWidgetConfig['chartType']>;
  labels: string[];
  series: ChartSeries[];
  /** Per-label slice colors for Donut mode; defaults to cycling DOUGHNUT_COLORS. */
  sliceColors?: string[];
  numberCaption?: string;
  /** Hides the legend (the chart's data labels), regardless of chart type or series count. */
  hideDataLabels?: boolean;
}> = ({ chartType, labels, series, sliceColors, numberCaption, hideDataLabels }) => {
  const [containerRef, size] = useElementSize<HTMLDivElement>();

  if (chartType === 'number') {
    const total = series[0]?.data.reduce((sum, value) => sum + (value || 0), 0) ?? 0;
    return (
      <Flex vertical align="center" justify="center" gap={4} style={{ height: '100%' }}>
        <Typography.Text style={{ fontSize: 40, fontWeight: 700, lineHeight: 1 }}>{total}</Typography.Text>
        {numberCaption && <Typography.Text type="secondary">{numberCaption}</Typography.Text>}
      </Flex>
    );
  }

  const legendPosition = legendPositionFor(size);

  if (chartType === 'donut') {
    const primary = series[0];
    return (
      <div ref={containerRef} style={{ width: '100%', height: '100%' }}>
        <Doughnut
          data={{
            labels,
            datasets: [
              {
                data: primary?.data ?? [],
                backgroundColor: sliceColors ?? labels.map((_, i) => DOUGHNUT_COLORS[i % DOUGHNUT_COLORS.length]),
                borderWidth: 0,
              },
            ],
          }}
          options={{ plugins: { legend: { display: !hideDataLabels, position: legendPosition } }, maintainAspectRatio: false }}
        />
      </div>
    );
  }

  const isStacked = chartType === 'stacked';
  const ChartComponent = chartType === 'line' ? Line : Bar;
  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%' }}>
      <ChartComponent
        data={{
          labels,
          datasets: series.map(s => ({
            label: s.label,
            data: s.data,
            backgroundColor: s.color,
            borderColor: s.color,
            stack: isStacked ? 'stack1' : undefined,
          })),
        }}
        options={{
          maintainAspectRatio: false,
          plugins: { legend: { display: !hideDataLabels && series.length > 1, position: legendPosition } },
          scales: isStacked ? { x: { stacked: true }, y: { stacked: true, beginAtZero: true } } : { y: { beginAtZero: true } },
        }}
      />
    </div>
  );
};

export const ProjectStatsByStatusWidget: React.FC<{ title: string; description?: string; config?: OverviewWidgetConfig }> = ({ title, description, config }) => {
  const { t } = useTranslation('reporting-overview');
  const { data, isFetching } = useWidgetStats('project_stats_by_status', config);
  const rows = (data?.body?.project_stats_by_status ?? []).filter(row => row.count > 0);
  const { chartType, filtersSummary, hideDataLabels } = useWidgetChrome('project_stats_by_status', config);
  const [seriesColor] = resolveSeriesColors('project_stats_by_status', config);

  return (
    <WidgetFrame title={title} loading={isFetching} empty={!rows.length} description={description} filtersSummary={filtersSummary}>
      <ChartByType
        chartType={chartType!}
        hideDataLabels={hideDataLabels}
        labels={rows.map(row => row.status)}
        series={[{ label: t('widgetStats.projectsText', { defaultValue: 'Projects' }), data: rows.map(row => row.count), color: seriesColor }]}
        sliceColors={rows.map((_, i) => DOUGHNUT_COLORS[i % DOUGHNUT_COLORS.length])}
        numberCaption={t('widgetStats.projectsText', { defaultValue: 'Projects' })}
      />
    </WidgetFrame>
  );
};

export const TasksByStatusWidget: React.FC<{ title: string; description?: string; config?: OverviewWidgetConfig }> = ({ title, description, config }) => {
  const { t } = useTranslation('reporting-overview');
  const { data, isFetching } = useWidgetStats('tasks_by_status', config);
  const stats = data?.body?.tasks_by_status;
  const rows = stats
    ? [
        { label: t('widgetStats.todoText', { defaultValue: 'To do' }), value: stats.todo },
        { label: t('widgetStats.doingText', { defaultValue: 'Doing' }), value: stats.doing },
        { label: t('widgetStats.doneText', { defaultValue: 'Done' }), value: stats.done },
      ].filter(row => row.value > 0)
    : [];
  const { chartType, filtersSummary, hideDataLabels } = useWidgetChrome('tasks_by_status', config);
  const [seriesColor] = resolveSeriesColors('tasks_by_status', config);

  return (
    <WidgetFrame title={title} loading={isFetching} empty={!rows.length} description={description} filtersSummary={filtersSummary}>
      <ChartByType
        chartType={chartType!}
        hideDataLabels={hideDataLabels}
        labels={rows.map(row => row.label)}
        series={[{ label: t('widgetStats.tasksText', { defaultValue: 'Tasks' }), data: rows.map(row => row.value), color: seriesColor }]}
        numberCaption={t('widgetStats.tasksText', { defaultValue: 'Tasks' })}
      />
    </WidgetFrame>
  );
};

export const TimeLoggedVsEstimatedWidget: React.FC<{ title: string; description?: string; config?: OverviewWidgetConfig }> = ({ title, description, config }) => {
  const { t } = useTranslation('reporting-overview');
  const { data, isFetching } = useWidgetStats('time_logged_vs_estimated', config);
  const rows = (data?.body?.time_logged_vs_estimated ?? []).slice(0, 15);
  const { chartType, filtersSummary, hideDataLabels } = useWidgetChrome('time_logged_vs_estimated', config);
  const [estimatedColor, loggedColor] = resolveSeriesColors('time_logged_vs_estimated', config);

  return (
    <WidgetFrame title={title} loading={isFetching} empty={!rows.length} description={description} filtersSummary={filtersSummary}>
      <ChartByType
        chartType={chartType!}
        hideDataLabels={hideDataLabels}
        labels={rows.map(row => row.project_name)}
        series={[
          { label: t('widgetStats.estimatedText', { defaultValue: 'Estimated' }), data: rows.map(row => row.estimated_hours), color: estimatedColor },
          { label: t('widgetStats.loggedText', { defaultValue: 'Logged' }), data: rows.map(row => row.logged_hours), color: loggedColor },
        ]}
        numberCaption={t('widgetStats.loggedHoursText', { defaultValue: 'Logged (h)' })}
      />
    </WidgetFrame>
  );
};

export const CapacityVsLoggedWidget: React.FC<{ title: string; description?: string; config?: OverviewWidgetConfig }> = ({ title, description, config }) => {
  const { t } = useTranslation('reporting-overview');
  const { data, isFetching } = useWidgetStats('capacity_vs_logged', config);
  const rows = (data?.body?.capacity_vs_logged ?? []).slice(0, 15);
  const { chartType, filtersSummary, hideDataLabels } = useWidgetChrome('capacity_vs_logged', config);
  const [capacityColor, loggedColor] = resolveSeriesColors('capacity_vs_logged', config);

  return (
    <WidgetFrame title={title} loading={isFetching} empty={!rows.length} description={description} filtersSummary={filtersSummary}>
      <ChartByType
        chartType={chartType!}
        hideDataLabels={hideDataLabels}
        labels={rows.map(row => row.name)}
        series={[
          { label: t('widgetStats.expectedCapacity', { defaultValue: 'Expected capacity (h)' }), data: rows.map(row => row.expected_capacity_hours), color: capacityColor },
          { label: t('widgetStats.loggedText', { defaultValue: 'Logged' }), data: rows.map(row => row.logged_hours), color: loggedColor },
        ]}
        numberCaption={t('widgetStats.loggedHoursText', { defaultValue: 'Logged (h)' })}
      />
    </WidgetFrame>
  );
};

export const TeamUtilizationWidget: React.FC<{ title: string; description?: string; config?: OverviewWidgetConfig }> = ({ title, description, config }) => {
  const { t } = useTranslation('reporting-overview');
  const { data, isFetching } = useWidgetStats('team_utilization', config);
  const rows = (data?.body?.team_utilization ?? []).slice(0, 15);
  const { chartType, filtersSummary, hideDataLabels } = useWidgetChrome('team_utilization', config);
  const [seriesColor] = resolveSeriesColors('team_utilization', config);

  return (
    <WidgetFrame title={title} loading={isFetching} empty={!rows.length} description={description} filtersSummary={filtersSummary}>
      <ChartByType
        chartType={chartType!}
        hideDataLabels={hideDataLabels}
        labels={rows.map(row => row.name)}
        series={[{ label: t('widgetStats.utilization', { defaultValue: 'Utilization %' }), data: rows.map(row => row.utilization_percent), color: seriesColor }]}
        numberCaption={t('widgetStats.utilization', { defaultValue: 'Utilization %' })}
      />
    </WidgetFrame>
  );
};

export const BillableTasksWidget: React.FC<{ title: string; description?: string; config?: OverviewWidgetConfig }> = ({ title, description, config }) => {
  const { t } = useTranslation('reporting-overview');
  const { data, isFetching } = useWidgetStats('billable_tasks', config);
  const stats = data?.body?.billable_tasks;
  const total = (stats?.billable ?? 0) + (stats?.non_billable ?? 0);
  const { chartType, filtersSummary, hideDataLabels } = useWidgetChrome('billable_tasks', config);
  const [seriesColor] = resolveSeriesColors('billable_tasks', config);

  return (
    <WidgetFrame title={title} loading={isFetching} empty={!total} description={description} filtersSummary={filtersSummary}>
      <ChartByType
        chartType={chartType!}
        hideDataLabels={hideDataLabels}
        labels={[t('widgetStats.billableText', { defaultValue: 'Billable' }), t('widgetStats.nonBillableText', { defaultValue: 'Non-billable' })]}
        series={[{ label: t('widgetStats.tasksText', { defaultValue: 'Tasks' }), data: [stats?.billable ?? 0, stats?.non_billable ?? 0], color: seriesColor }]}
        sliceColors={['#4caf50', '#ef5350']}
        numberCaption={t('widgetStats.tasksText', { defaultValue: 'Tasks' })}
      />
    </WidgetFrame>
  );
};

export const BillableTimeLogsWidget: React.FC<{ title: string; description?: string; config?: OverviewWidgetConfig }> = ({ title, description, config }) => {
  const { t } = useTranslation('reporting-overview');
  const { data, isFetching } = useWidgetStats('billable_time_logs', config);
  const stats = data?.body?.billable_time_logs;
  const total = (stats?.billable_hours ?? 0) + (stats?.non_billable_hours ?? 0);
  const { chartType, filtersSummary, hideDataLabels } = useWidgetChrome('billable_time_logs', config);
  const [seriesColor] = resolveSeriesColors('billable_time_logs', config);

  return (
    <WidgetFrame title={title} loading={isFetching} empty={!total} description={description} filtersSummary={filtersSummary}>
      <ChartByType
        chartType={chartType!}
        hideDataLabels={hideDataLabels}
        labels={[t('widgetStats.billableText', { defaultValue: 'Billable' }), t('widgetStats.nonBillableText', { defaultValue: 'Non-billable' })]}
        series={[{ label: t('widgetStats.loggedHoursText', { defaultValue: 'Logged (h)' }), data: [stats?.billable_hours ?? 0, stats?.non_billable_hours ?? 0], color: seriesColor }]}
        sliceColors={['#4caf50', '#ef5350']}
        numberCaption={t('widgetStats.loggedHoursText', { defaultValue: 'Logged (h)' })}
      />
    </WidgetFrame>
  );
};

export const ClientStatsWidget: React.FC<{ title: string; description?: string; config?: OverviewWidgetConfig }> = ({ title, description, config }) => {
  const { t } = useTranslation('reporting-overview');
  const { data, isFetching } = useWidgetStats('client_stats', config);
  const rows = data?.body?.client_stats ?? [];
  const filtersSummary = useOverviewWidgetFilterSummary('client_stats', config);

  return (
    <WidgetFrame title={title} loading={isFetching} empty={!rows.length} description={description} filtersSummary={filtersSummary}>
      <Table
        size="small"
        pagination={false}
        rowKey={row => row.client_id ?? row.client_name}
        dataSource={rows}
        columns={[
          {
            title: t('widgetStats.clientText', { defaultValue: 'Client' }),
            dataIndex: 'client_name',
            render: (value: string) =>
              value || <Typography.Text type="secondary">{t('widgetStats.noClientText', { defaultValue: 'No client' })}</Typography.Text>,
          },
          { title: t('projectsColumn', { defaultValue: 'Projects' }), dataIndex: 'project_count', align: 'right' },
          { title: t('widgetStats.tasksText', { defaultValue: 'Tasks' }), dataIndex: 'task_count', align: 'right' },
          { title: t('widgetStats.loggedHoursText', { defaultValue: 'Logged (h)' }), dataIndex: 'logged_hours', align: 'right' },
        ]}
      />
    </WidgetFrame>
  );
};

export const ProjectHealthStatsWidget: React.FC<{ title: string; description?: string; config?: OverviewWidgetConfig }> = ({ title, description, config }) => {
  const { t } = useTranslation('reporting-overview');
  const { data, isFetching } = useWidgetStats('project_health_stats', config);
  const rows = (data?.body?.project_health_stats ?? []).filter(row => row.count > 0);
  const { chartType, filtersSummary, hideDataLabels } = useWidgetChrome('project_health_stats', config);
  const [seriesColor] = resolveSeriesColors('project_health_stats', config);

  return (
    <WidgetFrame title={title} loading={isFetching} empty={!rows.length} description={description} filtersSummary={filtersSummary}>
      <ChartByType
        chartType={chartType!}
        hideDataLabels={hideDataLabels}
        labels={rows.map(row => row.health)}
        series={[{ label: t('widgetStats.projectsText', { defaultValue: 'Projects' }), data: rows.map(row => row.count), color: seriesColor }]}
        sliceColors={rows.map((row, i) => row.color_code || DOUGHNUT_COLORS[i % DOUGHNUT_COLORS.length])}
        numberCaption={t('widgetStats.projectsText', { defaultValue: 'Projects' })}
      />
    </WidgetFrame>
  );
};

export const IncompleteTasksByProjectWidget: React.FC<{ title: string; description?: string; config?: OverviewWidgetConfig }> = ({ title, description, config }) => {
  const { t } = useTranslation('reporting-overview');
  const { data, isFetching } = useWidgetStats('incomplete_tasks_by_project', config);
  const rows = (data?.body?.incomplete_tasks_by_project ?? []).slice(0, 15);
  const { chartType, filtersSummary, hideDataLabels } = useWidgetChrome('incomplete_tasks_by_project', config);
  const [seriesColor] = resolveSeriesColors('incomplete_tasks_by_project', config);

  return (
    <WidgetFrame title={title} loading={isFetching} empty={!rows.length} description={description} filtersSummary={filtersSummary}>
      <ChartByType
        chartType={chartType!}
        hideDataLabels={hideDataLabels}
        labels={rows.map(row => row.project_name)}
        series={[{ label: t('widgetStats.incompleteTasks', { defaultValue: 'Incomplete tasks' }), data: rows.map(row => row.count), color: seriesColor }]}
        numberCaption={t('widgetStats.incompleteTasks', { defaultValue: 'Incomplete tasks' })}
      />
    </WidgetFrame>
  );
};

export const UpcomingTasksWidget: React.FC<{ title: string; description?: string; config?: OverviewWidgetConfig }> = ({ title, description, config }) => {
  const { t } = useTranslation('reporting-overview');
  const { data, isFetching } = useWidgetStats('upcoming_tasks', config);
  const rows = (data?.body?.upcoming_tasks ?? []).slice(0, 15);
  const { chartType, filtersSummary, hideDataLabels } = useWidgetChrome('upcoming_tasks', config);
  const [seriesColor] = resolveSeriesColors('upcoming_tasks', config);

  return (
    <WidgetFrame title={title} loading={isFetching} empty={!rows.length} description={description} filtersSummary={filtersSummary}>
      <ChartByType
        chartType={chartType!}
        hideDataLabels={hideDataLabels}
        labels={rows.map(row => row.group_name ?? t('widgetStats.unassignedText', { defaultValue: 'Unassigned' }))}
        series={[{ label: t('widgetStats.upcomingTasks', { defaultValue: 'Upcoming tasks' }), data: rows.map(row => row.count), color: seriesColor }]}
        numberCaption={t('widgetStats.upcomingTasks', { defaultValue: 'Upcoming tasks' })}
      />
    </WidgetFrame>
  );
};

export const OverdueTasksWidget: React.FC<{ title: string; description?: string; config?: OverviewWidgetConfig }> = ({ title, description, config }) => {
  const { t } = useTranslation('reporting-overview');
  const { data, isFetching } = useWidgetStats('overdue_tasks', config);
  const rows = (data?.body?.overdue_tasks ?? []).slice(0, 15);
  const { chartType, filtersSummary, hideDataLabels } = useWidgetChrome('overdue_tasks', config);
  const [seriesColor] = resolveSeriesColors('overdue_tasks', config);

  return (
    <WidgetFrame title={title} loading={isFetching} empty={!rows.length} description={description} filtersSummary={filtersSummary}>
      <ChartByType
        chartType={chartType!}
        hideDataLabels={hideDataLabels}
        labels={rows.map(row => row.group_name ?? t('widgetStats.unassignedText', { defaultValue: 'Unassigned' }))}
        series={[{ label: t('widgetStats.overdueTasks', { defaultValue: 'Overdue tasks' }), data: rows.map(row => row.count), color: seriesColor }]}
        numberCaption={t('widgetStats.overdueTasks', { defaultValue: 'Overdue tasks' })}
      />
    </WidgetFrame>
  );
};
