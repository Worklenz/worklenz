import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Checkbox, ColorPicker, Flex, Radio, Select, Typography } from '@/shared/antd-imports';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useGetProgressChartOptionsQuery } from '@/api/reporting/progress-chart.api.service';
import type { GridWidgetInstance } from '@/components/dashboard-grid';
import type { OverviewWidgetConfig, OverviewWidgetKey } from '@/api/reporting/overview-layout.api.service';

export interface OverviewWidgetFilterSettingsProps {
  widget: GridWidgetInstance<OverviewWidgetKey, OverviewWidgetConfig>;
  onChange: (patch: (config: OverviewWidgetConfig | undefined) => OverviewWidgetConfig) => void;
}

/** Widget types with a chart to pick a type for; everything else (KPI tiles, the Teams table,
 *  Client Stats) has no chart. The same 5 options (Bar/Stacked/Line/Donut/Number) are offered
 *  uniformly - a chart type that doesn't naturally fit a given widget's data (e.g. Donut on a
 *  multi-series comparison) still renders something sensible; see overview-stats-widgets.tsx. */
const CHART_WIDGETS: OverviewWidgetKey[] = [
  'project_stats_by_status',
  'tasks_by_status',
  'time_logged_vs_estimated',
  'capacity_vs_logged',
  'team_utilization',
  'billable_tasks',
  'billable_time_logs',
  'project_health_stats',
  'incomplete_tasks_by_project',
  'upcoming_tasks',
  'overdue_tasks',
];
/** Widget types with a "group by" setting instead of (or alongside) the usual filters. */
const GROUP_BY_FAMILY: OverviewWidgetKey[] = ['upcoming_tasks', 'overdue_tasks'];
/**
 * Widget types whose data is about tasks (so "only billable/non-billable tasks" is a meaningful
 * filter). Excludes project-level widgets (Project Stats by Status, Projects by Health) where
 * there's no task to filter, and the two billable-split widgets themselves, where the filter would
 * be self-contradictory (it would always collapse one side of the chart to zero).
 */
const TASK_RELATED_WIDGETS: OverviewWidgetKey[] = [
  'tasks_by_status',
  'time_logged_vs_estimated',
  'capacity_vs_logged',
  'team_utilization',
  'client_stats',
  'incomplete_tasks_by_project',
  'upcoming_tasks',
  'overdue_tasks',
];

const CHART_TYPE_OPTIONS: { value: NonNullable<OverviewWidgetConfig['chartType']>; labelKey: string; defaultLabel: string }[] = [
  { value: 'bar', labelKey: 'widgetFilters.chartTypeBar', defaultLabel: 'Bar' },
  { value: 'stacked', labelKey: 'widgetFilters.chartTypeStacked', defaultLabel: 'Stacked bar' },
  { value: 'line', labelKey: 'widgetFilters.chartTypeLine', defaultLabel: 'Line' },
  { value: 'donut', labelKey: 'widgetFilters.chartTypeDonut', defaultLabel: 'Donut' },
  { value: 'number', labelKey: 'widgetFilters.chartTypeNumber', defaultLabel: 'Number' },
];

export const DEFAULT_CHART_TYPE: Record<OverviewWidgetKey, OverviewWidgetConfig['chartType']> = {
  kpi_teams: undefined,
  kpi_projects: undefined,
  kpi_members: undefined,
  teams_table: undefined,
  kpi_active_projects: undefined,
  kpi_overdue_projects: undefined,
  kpi_unassigned_members: undefined,
  kpi_members_with_overdue_tasks: undefined,
  project_stats_by_status: 'donut',
  tasks_by_status: 'donut',
  time_logged_vs_estimated: 'bar',
  capacity_vs_logged: 'bar',
  team_utilization: 'bar',
  billable_tasks: 'donut',
  billable_time_logs: 'donut',
  client_stats: undefined,
  project_health_stats: 'donut',
  incomplete_tasks_by_project: 'bar',
  upcoming_tasks: 'bar',
  overdue_tasks: 'bar',
  burndown_chart: undefined,
  burnup_chart: undefined,
  velocity_chart: undefined,
  cumulative_flow: undefined,
  time_in_status: undefined,
};

/** Burnup / Burndown widgets: they have their own settings section and always plot lines. */
const PROGRESS_WIDGETS: OverviewWidgetKey[] = ['burndown_chart', 'burnup_chart'];

/** Velocity, Cumulative Flow and Time in Status: project/team pickers, no chart type. */
const FLOW_WIDGETS: OverviewWidgetKey[] = ['velocity_chart', 'cumulative_flow', 'time_in_status'];

/** Resolves a widget's effective chart type: its own config, else the widget's default. */
export const resolveChartType = (type: OverviewWidgetKey, config: OverviewWidgetConfig | undefined) =>
  config?.chartType ?? DEFAULT_CHART_TYPE[type];

/** Upcoming Tasks defaults to "by assignee" (a workload view); Overdue Tasks defaults to "by
 *  project" (where the risk is) - matching the backend's own per-widget defaults. */
export const DEFAULT_GROUP_BY: Partial<Record<OverviewWidgetKey, OverviewWidgetConfig['groupBy']>> = {
  upcoming_tasks: 'assignee',
  overdue_tasks: 'project',
};

export const resolveGroupBy = (type: OverviewWidgetKey, config: OverviewWidgetConfig | undefined) =>
  config?.groupBy ?? DEFAULT_GROUP_BY[type];

/** Each chart widget's series, in the order they're plotted - used both to pre-fill the color
 *  pickers below and as the fallback color a series renders with when the user hasn't overridden
 *  it. Table widgets (e.g. Client Stats) and pure-KPI widgets have no entry. */
const DEFAULT_SERIES_COLORS: Partial<Record<OverviewWidgetKey, string[]>> = {
  project_stats_by_status: ['#7a84df'],
  tasks_by_status: ['#7a84df'],
  time_logged_vs_estimated: ['#7a84df', '#c191cc'],
  capacity_vs_logged: ['#29b6f6', '#4caf50'],
  team_utilization: ['#ff9800'],
  billable_tasks: ['#4caf50'],
  billable_time_logs: ['#4caf50'],
  project_health_stats: ['#7a84df'],
  incomplete_tasks_by_project: ['#ef5350'],
  upcoming_tasks: ['#29b6f6'],
  overdue_tasks: ['#ff4d4f'],
};

/** Resolves the colors a widget's series render with: the user's own picks where set, falling
 *  back to the widget's default for any series left unset. */
export const resolveSeriesColors = (type: OverviewWidgetKey, config: OverviewWidgetConfig | undefined): string[] => {
  const defaults = DEFAULT_SERIES_COLORS[type] ?? [];
  return defaults.map((fallback, index) => config?.colors?.[index] ?? fallback);
};

/** Labels for the per-series color pickers of the two widgets with more than one series; every
 *  other chart widget only ever has one, so it's just labelled "Bar color". */
const SERIES_LABEL_KEYS: Partial<Record<OverviewWidgetKey, { labelKey: string; defaultLabel: string }[]>> = {
  time_logged_vs_estimated: [
    { labelKey: 'widgetStats.estimatedText', defaultLabel: 'Estimated' },
    { labelKey: 'widgetStats.loggedText', defaultLabel: 'Logged' },
  ],
  capacity_vs_logged: [
    { labelKey: 'widgetStats.expectedCapacity', defaultLabel: 'Expected capacity (h)' },
    { labelKey: 'widgetStats.loggedText', defaultLabel: 'Logged' },
  ],
};

/** Chart types whose series render as a solid bar/line fill, so picking a color makes sense.
 *  Donut slices and the single-number tile use their own coloring instead. */
const COLOR_PICKABLE_CHART_TYPES: OverviewWidgetConfig['chartType'][] = ['bar', 'stacked', 'line'];

/**
 * Per-widget filter form shown in the widget's own settings popover (WidgetEditFrame's
 * `extraSettings`), for the extra stats widgets (project/task/time/billable/client stats) added
 * alongside the Overview page's existing KPI tiles. Narrows the page-level defaults for just this
 * one widget; an unset field falls back to the page default. Date range is deliberately not here:
 * it's set once, page-wide, by the toolbar's date range filter, so there's only ever one range in
 * view at a time.
 */
export const OverviewWidgetFilterSettings: React.FC<OverviewWidgetFilterSettingsProps> = ({ widget, onChange }) => {
  const { t } = useTranslation('reporting-overview');
  const teams = useAppSelector(state => state.projectReportsReducer.teams);
  const config = widget.config ?? {};

  const teamOptions = useMemo(() => teams.map(team => ({ value: team.id as string, label: team.name as string })), [teams]);

  const set = (patch: Partial<OverviewWidgetConfig>) => onChange(current => ({ ...current, ...patch }));

  const isProgress = PROGRESS_WIDGETS.includes(widget.type);
  const isFlow = FLOW_WIDGETS.includes(widget.type);
  const progressScope = config.progressScope ?? 'team';
  const progressSource = progressScope === 'project' ? (config.progressSource ?? 'range') : 'range';
  const { data: optionsData, isFetching: isOptionsFetching } = useGetProgressChartOptionsQuery(
    { projectId: progressScope === 'project' ? config.projectId : undefined },
    { skip: !(isProgress || isFlow) || (widget.type !== 'velocity_chart' && progressScope !== 'project') }
  );
  const projectOptions = useMemo(
    () => (optionsData?.body?.projects ?? []).map(project => ({ value: project.id, label: project.name })),
    [optionsData]
  );
  const sprintOptions = useMemo(
    () =>
      (optionsData?.body?.sprints ?? []).map(sprint => ({
        value: sprint.id,
        label:
          sprint.sprint_status === 'active'
            ? `${sprint.name} (${t('widgetFilters.sprintActive', { defaultValue: 'active' })})`
            : sprint.name,
      })),
    [optionsData, t]
  );

  const hasChartType = CHART_WIDGETS.includes(widget.type);
  const hasGroupBy = GROUP_BY_FAMILY.includes(widget.type);
  const hasBillable = TASK_RELATED_WIDGETS.includes(widget.type);
  const chartType = resolveChartType(widget.type, config);
  const seriesColors = resolveSeriesColors(widget.type, config);
  const hasColorPicker = hasChartType && COLOR_PICKABLE_CHART_TYPES.includes(chartType) && seriesColors.length > 0;
  const seriesLabels = SERIES_LABEL_KEYS[widget.type];

  const setSeriesColor = (index: number, hex: string) => {
    const colors = [...seriesColors];
    colors[index] = hex;
    set({ colors });
  };

  if (isFlow) {
    const isVelocity = widget.type === 'velocity_chart';
    const flowScope = isVelocity ? 'project' : progressScope;
    return (
      <Flex vertical gap={10}>
        {!isVelocity && (
          <Flex vertical gap={4}>
            <Typography.Text strong>{t('widgetFilters.progressScope', { defaultValue: 'Level' })}</Typography.Text>
            <Radio.Group
              value={flowScope}
              onChange={e =>
                set({
                  progressScope: e.target.value,
                  ...(e.target.value === 'team' ? { projectId: undefined } : {}),
                })
              }
            >
              <Radio.Button value="team">{t('widgetFilters.scopeTeam', { defaultValue: 'Active team' })}</Radio.Button>
              <Radio.Button value="project">{t('widgetFilters.scopeProject', { defaultValue: 'Project' })}</Radio.Button>
            </Radio.Group>
          </Flex>
        )}
        {flowScope === 'project' && (
          <Flex vertical gap={4}>
            <Typography.Text strong>{t('widgetFilters.project', { defaultValue: 'Project' })}</Typography.Text>
            <Select
              showSearch
              optionFilterProp="label"
              loading={isOptionsFetching}
              style={{ width: '100%' }}
              placeholder={t('widgetFilters.selectProject', { defaultValue: 'Select a project' })}
              value={config.projectId}
              options={projectOptions}
              onChange={value => set({ projectId: value })}
            />
          </Flex>
        )}
        {isVelocity && (
          <>
            <Flex vertical gap={4}>
              <Typography.Text strong>{t('widgetFilters.metric', { defaultValue: 'Measure' })}</Typography.Text>
              <Select
                style={{ width: '100%' }}
                value={config.progressMetric === 'issue_count' ? 'issue_count' : 'story_points'}
                onChange={value => set({ progressMetric: value as OverviewWidgetConfig['progressMetric'] })}
                options={[
                  { value: 'story_points', label: t('widgetFilters.metricStoryPoints', { defaultValue: 'Story points' }) },
                  { value: 'issue_count', label: t('widgetFilters.metricIssueCount', { defaultValue: 'Issues' }) },
                ]}
              />
            </Flex>
            <Flex vertical gap={4}>
              <Typography.Text strong>{t('widgetFilters.sprintCount', { defaultValue: 'Sprints to show' })}</Typography.Text>
              <Select
                style={{ width: '100%' }}
                value={config.sprintCount ?? 6}
                onChange={value => set({ sprintCount: value })}
                options={Array.from({ length: 10 }, (_, index) => ({ value: index + 3, label: String(index + 3) }))}
              />
            </Flex>
          </>
        )}
        <Checkbox checked={config.includeSubtasks ?? false} onChange={e => set({ includeSubtasks: e.target.checked })}>
          {t('widgetFilters.includeSubtasks', { defaultValue: 'Include sub-tasks' })}
        </Checkbox>
        {!isVelocity && flowScope === 'team' && (
          <Checkbox checked={config.includeArchived ?? false} onChange={e => set({ includeArchived: e.target.checked || undefined })}>
            {t('widgetFilters.includeArchived', { defaultValue: 'Include archived projects' })}
          </Checkbox>
        )}
      </Flex>
    );
  }

  if (isProgress) {
    return (
      <Flex vertical gap={10}>
        <Flex vertical gap={4}>
          <Typography.Text strong>{t('widgetFilters.progressScope', { defaultValue: 'Level' })}</Typography.Text>
          <Radio.Group
            value={progressScope}
            onChange={e =>
              set({
                progressScope: e.target.value,
                ...(e.target.value === 'team' ? { projectId: undefined, sprintId: undefined, progressSource: undefined } : {}),
              })
            }
          >
            <Radio.Button value="team">{t('widgetFilters.scopeTeam', { defaultValue: 'Active team' })}</Radio.Button>
            <Radio.Button value="project">{t('widgetFilters.scopeProject', { defaultValue: 'Project' })}</Radio.Button>
          </Radio.Group>
        </Flex>
        {progressScope === 'project' && (
          <Flex vertical gap={4}>
            <Typography.Text strong>{t('widgetFilters.project', { defaultValue: 'Project' })}</Typography.Text>
            <Select
              showSearch
              optionFilterProp="label"
              loading={isOptionsFetching}
              style={{ width: '100%' }}
              placeholder={t('widgetFilters.selectProject', { defaultValue: 'Select a project' })}
              value={config.projectId}
              options={projectOptions}
              onChange={value => set({ projectId: value, sprintId: undefined })}
            />
          </Flex>
        )}
        {progressScope === 'project' && (
          <Flex vertical gap={4}>
            <Typography.Text strong>{t('widgetFilters.progressSource', { defaultValue: 'Period' })}</Typography.Text>
            <Radio.Group
              value={progressSource}
              onChange={e => set({ progressSource: e.target.value, sprintId: e.target.value === 'range' ? undefined : config.sprintId })}
            >
              <Radio.Button value="range">{t('widgetFilters.sourceRange', { defaultValue: 'Date range' })}</Radio.Button>
              <Radio.Button value="sprint">{t('widgetFilters.sourceSprint', { defaultValue: 'Sprint' })}</Radio.Button>
            </Radio.Group>
          </Flex>
        )}
        {progressScope === 'project' && progressSource === 'sprint' && (
          <Flex vertical gap={4}>
            <Typography.Text strong>{t('widgetFilters.sprint', { defaultValue: 'Sprint' })}</Typography.Text>
            <Select
              loading={isOptionsFetching}
              style={{ width: '100%' }}
              disabled={!config.projectId}
              placeholder={t('widgetFilters.selectSprint', { defaultValue: 'Select a sprint' })}
              notFoundContent={t('widgetFilters.noSprints', { defaultValue: 'No started sprints in this project' })}
              value={config.sprintId}
              options={sprintOptions}
              onChange={value => set({ sprintId: value })}
            />
          </Flex>
        )}
        <Flex vertical gap={4}>
          <Typography.Text strong>{t('widgetFilters.metric', { defaultValue: 'Measure' })}</Typography.Text>
          <Select
            style={{ width: '100%' }}
            value={config.progressMetric ?? 'story_points'}
            onChange={value => set({ progressMetric: value })}
            options={[
              { value: 'story_points', label: t('widgetFilters.metricStoryPoints', { defaultValue: 'Story points' }) },
              { value: 'issue_count', label: t('widgetFilters.metricIssueCount', { defaultValue: 'Issues' }) },
              { value: 'estimated_hours', label: t('widgetFilters.metricEstimatedHours', { defaultValue: 'Estimated hours' }) },
            ]}
          />
        </Flex>
        <Checkbox checked={config.includeSubtasks ?? false} onChange={e => set({ includeSubtasks: e.target.checked })}>
          {t('widgetFilters.includeSubtasks', { defaultValue: 'Include sub-tasks' })}
        </Checkbox>
        <Checkbox checked={config.showIdealLine ?? true} onChange={e => set({ showIdealLine: e.target.checked })}>
          {t('widgetFilters.showIdealLine', { defaultValue: 'Show guideline' })}
        </Checkbox>
        <Checkbox checked={config.showForecast ?? true} onChange={e => set({ showForecast: e.target.checked })}>
          {t('widgetFilters.showForecast', { defaultValue: 'Show forecast' })}
        </Checkbox>
        <Checkbox checked={config.includeArchived ?? false} onChange={e => set({ includeArchived: e.target.checked || undefined })}>
          {t('widgetFilters.includeArchived', { defaultValue: 'Include archived projects' })}
        </Checkbox>
      </Flex>
    );
  }

  return (
    <Flex vertical gap={10}>
      {hasChartType && (
        <Flex vertical gap={4}>
          <Typography.Text strong>{t('widgetFilters.chartType', { defaultValue: 'Chart type' })}</Typography.Text>
          <Select
            style={{ width: '100%' }}
            value={resolveChartType(widget.type, config)}
            onChange={value => set({ chartType: value })}
            options={CHART_TYPE_OPTIONS.map(option => ({
              value: option.value,
              label: t(option.labelKey, { defaultValue: option.defaultLabel }),
            }))}
          />
        </Flex>
      )}
      {hasChartType && (
        <Checkbox
          checked={config.hideDataLabels ?? false}
          onChange={e => set({ hideDataLabels: e.target.checked || undefined })}
        >
          {t('widgetFilters.hideDataLabels', { defaultValue: 'Hide data labels' })}
        </Checkbox>
      )}
      {hasColorPicker && (
        <Flex vertical gap={4}>
          <Typography.Text strong>
            {seriesColors.length > 1
              ? t('widgetFilters.barColors', { defaultValue: 'Bar colors' })
              : t('widgetFilters.barColor', { defaultValue: 'Bar color' })}
          </Typography.Text>
          <Flex gap={12} wrap="wrap">
            {seriesColors.map((color, index) => {
              const label = seriesLabels?.[index]
                ? t(seriesLabels[index].labelKey, { defaultValue: seriesLabels[index].defaultLabel })
                : undefined;
              return (
                <Flex key={index} align="center" gap={6}>
                  <ColorPicker
                    value={color}
                    onChangeComplete={value => setSeriesColor(index, value.toHexString())}
                    size="small"
                    showText={label ? () => label : false}
                    trigger="click"
                    disabledAlpha
                  />
                </Flex>
              );
            })}
          </Flex>
        </Flex>
      )}
      {hasGroupBy && (
        <Flex vertical gap={4}>
          <Typography.Text strong>{t('widgetFilters.groupBy', { defaultValue: 'Group by' })}</Typography.Text>
          <Radio.Group value={resolveGroupBy(widget.type, config)} onChange={e => set({ groupBy: e.target.value })}>
            <Radio.Button value="assignee">{t('widgetFilters.groupByAssignee', { defaultValue: 'Assignee' })}</Radio.Button>
            <Radio.Button value="project">{t('widgetFilters.groupByProject', { defaultValue: 'Project' })}</Radio.Button>
          </Radio.Group>
        </Flex>
      )}
      <Flex vertical gap={4}>
        <Typography.Text strong>{t('widgetFilters.teams', { defaultValue: 'Teams' })}</Typography.Text>
        <Select
          mode="multiple"
          allowClear
          style={{ width: '100%' }}
          placeholder={t('widgetFilters.allTeams', { defaultValue: 'All teams' })}
          value={config.teams ?? []}
          options={teamOptions}
          onChange={value => set({ teams: value.length ? value : undefined })}
          maxTagCount={2}
        />
      </Flex>
      {hasBillable && (
        <Flex vertical gap={4}>
          <Typography.Text strong>{t('widgetFilters.billable', { defaultValue: 'Billable' })}</Typography.Text>
          <Radio.Group
            value={config.billable ?? 'all'}
            onChange={e => set({ billable: e.target.value === 'all' ? undefined : e.target.value })}
          >
            <Radio.Button value="all">{t('widgetFilters.billableAll', { defaultValue: 'All' })}</Radio.Button>
            <Radio.Button value="billable">{t('widgetFilters.billableOnly', { defaultValue: 'Billable' })}</Radio.Button>
            <Radio.Button value="nonBillable">{t('widgetFilters.nonBillableOnly', { defaultValue: 'Non-billable' })}</Radio.Button>
          </Radio.Group>
        </Flex>
      )}
      <Checkbox
        checked={config.includeArchived ?? false}
        onChange={e => set({ includeArchived: e.target.checked || undefined })}
      >
        {t('widgetFilters.includeArchived', { defaultValue: 'Include archived projects' })}
      </Checkbox>
    </Flex>
  );
};

/**
 * Builds the human-readable lines shown as a tooltip on each added widget, so a user looking at
 * several instances of the same widget (e.g. two "Tasks by Status" cards) can tell which filters
 * each one is scoped to without opening its settings. The chart type is deliberately left out
 * here: it's visible at a glance from the chart itself, not something worth repeating in a
 * tooltip about filters.
 */
export const useOverviewWidgetFilterSummary = (type: OverviewWidgetKey, config: OverviewWidgetConfig | undefined): string[] => {
  const { t } = useTranslation('reporting-overview');
  const teams = useAppSelector(state => state.projectReportsReducer.teams);

  return useMemo(() => {
    const lines: string[] = [];
    if (PROGRESS_WIDGETS.includes(type)) {
      const scope = config?.progressScope ?? 'team';
      const metricLabels = {
        story_points: t('widgetFilters.metricStoryPoints', { defaultValue: 'Story points' }),
        issue_count: t('widgetFilters.metricIssueCount', { defaultValue: 'Issues' }),
        estimated_hours: t('widgetFilters.metricEstimatedHours', { defaultValue: 'Estimated hours' }),
      };
      lines.push(
        scope === 'project'
          ? t('widgetFilters.scopeProject', { defaultValue: 'Project' })
          : t('widgetFilters.scopeTeam', { defaultValue: 'Active team' })
      );
      lines.push(`${t('widgetFilters.metric', { defaultValue: 'Measure' })}: ${metricLabels[config?.progressMetric ?? 'story_points']}`);
      if (config?.includeSubtasks) lines.push(t('widgetFilters.includeSubtasks', { defaultValue: 'Include sub-tasks' }));
      if (config?.includeArchived) lines.push(t('widgetFilters.includeArchived', { defaultValue: 'Include archived projects' }));
      return lines;
    }
    if (FLOW_WIDGETS.includes(type)) {
      const scope = type === 'velocity_chart' ? 'project' : (config?.progressScope ?? 'team');
      lines.push(
        scope === 'project'
          ? t('widgetFilters.scopeProject', { defaultValue: 'Project' })
          : t('widgetFilters.scopeTeam', { defaultValue: 'Active team' })
      );
      if (type === 'velocity_chart') {
        lines.push(
          `${t('widgetFilters.metric', { defaultValue: 'Measure' })}: ${
            config?.progressMetric === 'issue_count'
              ? t('widgetFilters.metricIssueCount', { defaultValue: 'Issues' })
              : t('widgetFilters.metricStoryPoints', { defaultValue: 'Story points' })
          }`
        );
      }
      if (config?.includeSubtasks) lines.push(t('widgetFilters.includeSubtasks', { defaultValue: 'Include sub-tasks' }));
      if (config?.includeArchived && type !== 'velocity_chart') lines.push(t('widgetFilters.includeArchived', { defaultValue: 'Include archived projects' }));
      return lines;
    }
    const groupBy = resolveGroupBy(type, config);
    if (groupBy) {
      lines.push(
        `${t('widgetFilters.groupBy', { defaultValue: 'Group by' })}: ${
          groupBy === 'assignee'
            ? t('widgetFilters.groupByAssignee', { defaultValue: 'Assignee' })
            : t('widgetFilters.groupByProject', { defaultValue: 'Project' })
        }`
      );
    }
    if (config?.teams?.length) {
      const names = config.teams
        .map(id => teams.find(team => team.id === id)?.name)
        .filter((name): name is string => Boolean(name));
      lines.push(`${t('widgetFilters.teams', { defaultValue: 'Teams' })}: ${names.length ? names.join(', ') : config.teams.length}`);
    }
    if (TASK_RELATED_WIDGETS.includes(type)) {
      if (config?.billable === 'billable') {
        lines.push(t('widgetFilters.billableOnly', { defaultValue: 'Billable' }));
      } else if (config?.billable === 'nonBillable') {
        lines.push(t('widgetFilters.nonBillableOnly', { defaultValue: 'Non-billable' }));
      }
    }
    if (config?.includeArchived) {
      lines.push(t('widgetFilters.includeArchived', { defaultValue: 'Include archived projects' }));
    }
    return lines;
  }, [type, config, teams, t]);
};

export default OverviewWidgetFilterSettings;
