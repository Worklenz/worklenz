import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '@/shared/antd-imports';
import type { WidgetDefinition } from '@/components/dashboard-grid';
import { ViewLargerButton, WidgetViewLargerModal } from '@/components/dashboard-grid';
import type { OverviewWidgetConfig, OverviewWidgetKey } from '@/api/reporting/overview-layout.api.service';
import OverviewStatCard from '../components/overview-stat-card';
import OverviewReportsTable from '../components/overview-table/overview-reports-table';
import { useOverviewData } from './OverviewDataContext';
import { BurndownChartWidget, BurnupChartWidget } from './overview-progress-widgets';
import {
  BillableTasksWidget,
  BillableTimeLogsWidget,
  CapacityVsLoggedWidget,
  ClientStatsWidget,
  IncompleteTasksByProjectWidget,
  OverdueTasksWidget,
  ProjectHealthStatsWidget,
  ProjectStatsByStatusWidget,
  TasksByStatusWidget,
  TeamUtilizationWidget,
  TimeLoggedVsEstimatedWidget,
  UpcomingTasksWidget,
} from './overview-stats-widgets';

const KPI = { size: { w: 3, h: 2 }, min: { w: 2, h: 2 } };
// Repeatable: the user can add the same chart/table more than once, each with its own filters and
// (for the chart ones) its own chart type. There's no default instance; "Add widget" always offers
// these regardless of how many are already on the grid.
const STATS_WIDGET = { size: { w: 4, h: 8 }, min: { w: 3, h: 6 }, repeatable: true };
const STATS_WIDGET_WIDE = { size: { w: 6, h: 9 }, min: { w: 4, h: 6 }, repeatable: true };

/** The Overview widget catalogue. Order here is also the order shown in "Add widget". */
export const OVERVIEW_WIDGETS: WidgetDefinition<OverviewWidgetKey>[] = [
  {
    type: 'kpi_teams',
    titleKey: 'reporting-overview:totalTeams',
    defaultTitle: 'Total Teams',
    descriptionKey: 'reporting-overview:widgetDescriptions.kpiTeams',
    defaultDescription: 'Number of teams in your workspace',
    ...KPI,
  },
  {
    type: 'kpi_projects',
    titleKey: 'reporting-overview:totalProjects',
    defaultTitle: 'Total Projects',
    descriptionKey: 'reporting-overview:widgetDescriptions.kpiProjects',
    defaultDescription: 'Number of projects across your teams',
    ...KPI,
  },
  {
    type: 'kpi_members',
    titleKey: 'reporting-overview:totalMembers',
    defaultTitle: 'Total Members',
    descriptionKey: 'reporting-overview:widgetDescriptions.kpiMembers',
    defaultDescription: 'Number of people across your teams',
    ...KPI,
  },
  {
    type: 'teams_table',
    titleKey: 'reporting-overview:teamsText',
    defaultTitle: 'Teams',
    descriptionKey: 'reporting-overview:widgetDescriptions.teamsTable',
    defaultDescription: 'A table of your teams and their project/member counts',
    size: { w: 12, h: 11 },
    min: { w: 4, h: 6 },
  },
  {
    type: 'kpi_active_projects',
    titleKey: 'reporting-overview:activeProjectCountPlural',
    defaultTitle: 'Active Projects',
    descriptionKey: 'reporting-overview:widgetDescriptions.kpiActiveProjects',
    defaultDescription: 'Projects that are not yet overdue or completed',
    ...KPI,
    hiddenByDefault: true,
  },
  {
    type: 'kpi_overdue_projects',
    titleKey: 'reporting-overview:overdueProjectCountPlural',
    defaultTitle: 'Overdue Projects',
    descriptionKey: 'reporting-overview:widgetDescriptions.kpiOverdueProjects',
    defaultDescription: 'Projects past their end date and not completed',
    ...KPI,
    hiddenByDefault: true,
  },
  {
    type: 'kpi_unassigned_members',
    titleKey: 'reporting-overview:unassignedMemberCountPlural',
    defaultTitle: 'Unassigned Members',
    descriptionKey: 'reporting-overview:widgetDescriptions.kpiUnassignedMembers',
    defaultDescription: 'Members with no tasks assigned to them',
    ...KPI,
    hiddenByDefault: true,
  },
  {
    type: 'kpi_members_with_overdue_tasks',
    titleKey: 'reporting-overview:memberWithOverdueTaskCountPlural',
    defaultTitle: 'Members With Overdue Tasks',
    descriptionKey: 'reporting-overview:widgetDescriptions.kpiMembersWithOverdueTasks',
    defaultDescription: 'Members who have at least one overdue task',
    ...KPI,
    hiddenByDefault: true,
  },
  {
    type: 'project_stats_by_status',
    titleKey: 'reporting-overview:widgets.projectStatsByStatus',
    defaultTitle: 'Project Stats by Status',
    descriptionKey: 'reporting-overview:widgetDescriptions.projectStatsByStatus',
    defaultDescription: 'How many projects are in each status (e.g. In Progress, On Hold, Completed)',
    ...STATS_WIDGET,
  },
  {
    type: 'tasks_by_status',
    titleKey: 'reporting-overview:widgets.tasksByStatus',
    defaultTitle: 'Tasks by Status',
    descriptionKey: 'reporting-overview:widgetDescriptions.tasksByStatus',
    defaultDescription: 'Task breakdown by To do, Doing and Done across your projects',
    ...STATS_WIDGET,
  },
  {
    type: 'time_logged_vs_estimated',
    titleKey: 'reporting-overview:widgets.timeLoggedVsEstimated',
    defaultTitle: 'Total Time Logged vs Estimated',
    descriptionKey: 'reporting-overview:widgetDescriptions.timeLoggedVsEstimated',
    defaultDescription: 'Compares actual logged hours to each project’s estimate',
    ...STATS_WIDGET_WIDE,
  },
  {
    type: 'capacity_vs_logged',
    titleKey: 'reporting-overview:widgets.capacityVsLogged',
    defaultTitle: 'Expected Capacity vs Logged Time',
    descriptionKey: 'reporting-overview:widgetDescriptions.capacityVsLogged',
    defaultDescription: 'Compares each member’s available working hours to the hours they logged',
    ...STATS_WIDGET_WIDE,
  },
  {
    type: 'team_utilization',
    titleKey: 'reporting-overview:widgets.teamUtilization',
    defaultTitle: 'Team Utilization',
    descriptionKey: 'reporting-overview:widgetDescriptions.teamUtilization',
    defaultDescription: 'Logged hours as a percentage of each member’s expected capacity',
    ...STATS_WIDGET_WIDE,
  },
  {
    type: 'billable_tasks',
    titleKey: 'reporting-overview:widgets.billableTasks',
    defaultTitle: 'Billable vs Non-billable Tasks',
    descriptionKey: 'reporting-overview:widgetDescriptions.billableTasks',
    defaultDescription: 'How many tasks are marked billable vs non-billable',
    ...STATS_WIDGET,
  },
  {
    type: 'billable_time_logs',
    titleKey: 'reporting-overview:widgets.billableTimeLogs',
    defaultTitle: 'Billable vs Non-billable Time Logs',
    descriptionKey: 'reporting-overview:widgetDescriptions.billableTimeLogs',
    defaultDescription: 'Logged hours split between billable and non-billable time',
    ...STATS_WIDGET,
  },
  {
    type: 'client_stats',
    titleKey: 'reporting-overview:widgets.clientStats',
    defaultTitle: 'Client Stats',
    descriptionKey: 'reporting-overview:widgetDescriptions.clientStats',
    defaultDescription: 'Projects, tasks and logged hours grouped by client',
    ...STATS_WIDGET_WIDE,
  },
  {
    type: 'project_health_stats',
    titleKey: 'reporting-overview:widgets.projectHealthStats',
    defaultTitle: 'Projects by Health',
    descriptionKey: 'reporting-overview:widgetDescriptions.projectHealthStats',
    defaultDescription: 'How many projects are at each health status (e.g. Good, At Risk, Needs Attention)',
    ...STATS_WIDGET,
  },
  {
    type: 'incomplete_tasks_by_project',
    titleKey: 'reporting-overview:widgets.incompleteTasksByProject',
    defaultTitle: 'Incomplete Tasks by Project',
    descriptionKey: 'reporting-overview:widgetDescriptions.incompleteTasksByProject',
    defaultDescription: 'How many not-yet-done tasks each project has',
    ...STATS_WIDGET_WIDE,
  },
  {
    type: 'upcoming_tasks',
    titleKey: 'reporting-overview:widgets.upcomingTasks',
    defaultTitle: 'Upcoming Tasks',
    descriptionKey: 'reporting-overview:widgetDescriptions.upcomingTasks',
    defaultDescription: 'Not-yet-done tasks with a future due date, by assignee or project',
    ...STATS_WIDGET_WIDE,
  },
  {
    type: 'overdue_tasks',
    titleKey: 'reporting-overview:widgets.overdueTasks',
    defaultTitle: 'Overdue Tasks',
    descriptionKey: 'reporting-overview:widgetDescriptions.overdueTasks',
    defaultDescription: 'Tasks past their due date and not done, by project or assignee',
    ...STATS_WIDGET_WIDE,
  },
  {
    type: 'burndown_chart',
    titleKey: 'reporting-overview:widgets.burndownChart',
    defaultTitle: 'Burndown Chart',
    descriptionKey: 'reporting-overview:widgetDescriptions.burndownChart',
    defaultDescription: 'Work remaining over time for your active team or a single project/sprint, against a guideline',
    ...STATS_WIDGET_WIDE,
  },
  {
    type: 'burnup_chart',
    titleKey: 'reporting-overview:widgets.burnupChart',
    defaultTitle: 'Burnup Chart',
    descriptionKey: 'reporting-overview:widgetDescriptions.burnupChart',
    defaultDescription: 'Completed work against total scope over time, so scope changes are visible',
    ...STATS_WIDGET_WIDE,
  },
];

export const titleOf = (type: OverviewWidgetKey, t: (key: string, options?: Record<string, unknown>) => string): string => {
  const def = OVERVIEW_WIDGETS.find(item => item.type === type);
  return def ? t(def.titleKey, { defaultValue: def.defaultTitle }) : type;
};

export const descriptionOf = (
  type: OverviewWidgetKey,
  t: (key: string, options?: Record<string, unknown>) => string
): string | undefined => {
  const def = OVERVIEW_WIDGETS.find(item => item.type === type);
  if (!def?.descriptionKey) return undefined;
  return t(def.descriptionKey, { defaultValue: def.defaultDescription });
};

/** A single-number KPI tile: a short title (with a tooltip for the full label) and the big count below. */
const SimpleKpi: React.FC<{ titleKey: string; count: number | undefined; loading: boolean }> = ({
  titleKey,
  count = 0,
  loading,
}) => {
  const { t } = useTranslation('reporting-overview');
  const label = t(titleKey);
  return <OverviewStatCard title={label} tooltip={label} value={count} loading={loading} />;
};

const TeamsKpi: React.FC = () => {
  const { stats, loading } = useOverviewData();
  const { t } = useTranslation('reporting-overview');
  return <OverviewStatCard title={t('totalTeams')} value={stats.teams?.count ?? 0} loading={loading} />;
};

const ProjectsKpi: React.FC = () => {
  const { stats, loading } = useOverviewData();
  const { t } = useTranslation('reporting-overview');
  return <OverviewStatCard title={t('totalProjects')} value={stats.projects?.count ?? 0} loading={loading} />;
};

const MembersKpi: React.FC = () => {
  const { stats, loading } = useOverviewData();
  const { t } = useTranslation('reporting-overview');
  return <OverviewStatCard title={t('totalMembers')} value={stats.members?.count ?? 0} loading={loading} />;
};

const ActiveProjectsKpi: React.FC = () => {
  const { stats, loading } = useOverviewData();
  return <SimpleKpi titleKey="activeProjectCountPlural" count={stats.projects?.active} loading={loading} />;
};

const OverdueProjectsKpi: React.FC = () => {
  const { stats, loading } = useOverviewData();
  const { t } = useTranslation('reporting-overview');
  const count = stats.projects?.overdue ?? 0;
  const label = t('overdueProjectCountPlural');
  return (
    <OverviewStatCard
      title={label}
      tooltip={label}
      value={count}
      valueColor={count > 0 ? '#ff4d4f' : undefined}
      loading={loading}
    />
  );
};

const UnassignedMembersKpi: React.FC = () => {
  const { stats, loading } = useOverviewData();
  return <SimpleKpi titleKey="unassignedMemberCountPlural" count={stats.members?.unassigned} loading={loading} />;
};

const MembersWithOverdueTasksKpi: React.FC = () => {
  const { stats, loading } = useOverviewData();
  const { t } = useTranslation('reporting-overview');
  const count = stats.members?.overdue ?? 0;
  const label = t('memberWithOverdueTaskCountPlural');
  return (
    <OverviewStatCard
      title={label}
      tooltip={label}
      value={count}
      valueColor={count > 0 ? '#ff4d4f' : undefined}
      loading={loading}
    />
  );
};

/** The teams table in a scrollable card, so it fits the grid's fixed-height cell instead of growing it. */
const TeamsTableWidget: React.FC = () => {
  const { t } = useTranslation('reporting-overview');
  const title = t('teamsText');
  const [viewLarger, setViewLarger] = useState(false);
  return (
    <>
      <Card
        title={title}
        extra={<ViewLargerButton title={title} i18nNamespace="reporting-overview" onClick={() => setViewLarger(true)} />}
        style={{ height: '100%' }}
        styles={{ body: { height: 'calc(100% - 57px)', overflow: 'auto' } }}
      >
        <OverviewReportsTable />
      </Card>
      <WidgetViewLargerModal title={title} open={viewLarger} onClose={() => setViewLarger(false)}>
        <OverviewReportsTable />
      </WidgetViewLargerModal>
    </>
  );
};

/** Renders a single Overview widget by its key and (for the stats widgets) its own filter config. */
export const OverviewWidgetByKey: React.FC<{ widgetKey: OverviewWidgetKey; config?: OverviewWidgetConfig }> = ({
  widgetKey,
  config,
}) => {
  const { t } = useTranslation('reporting-overview');
  switch (widgetKey) {
    case 'kpi_teams':
      return <TeamsKpi />;
    case 'kpi_projects':
      return <ProjectsKpi />;
    case 'kpi_members':
      return <MembersKpi />;
    case 'teams_table':
      return <TeamsTableWidget />;
    case 'kpi_active_projects':
      return <ActiveProjectsKpi />;
    case 'kpi_overdue_projects':
      return <OverdueProjectsKpi />;
    case 'kpi_unassigned_members':
      return <UnassignedMembersKpi />;
    case 'kpi_members_with_overdue_tasks':
      return <MembersWithOverdueTasksKpi />;
    case 'project_stats_by_status':
      return <ProjectStatsByStatusWidget title={titleOf(widgetKey, t)} description={descriptionOf(widgetKey, t)} config={config} />;
    case 'tasks_by_status':
      return <TasksByStatusWidget title={titleOf(widgetKey, t)} description={descriptionOf(widgetKey, t)} config={config} />;
    case 'time_logged_vs_estimated':
      return <TimeLoggedVsEstimatedWidget title={titleOf(widgetKey, t)} description={descriptionOf(widgetKey, t)} config={config} />;
    case 'capacity_vs_logged':
      return <CapacityVsLoggedWidget title={titleOf(widgetKey, t)} description={descriptionOf(widgetKey, t)} config={config} />;
    case 'team_utilization':
      return <TeamUtilizationWidget title={titleOf(widgetKey, t)} description={descriptionOf(widgetKey, t)} config={config} />;
    case 'billable_tasks':
      return <BillableTasksWidget title={titleOf(widgetKey, t)} description={descriptionOf(widgetKey, t)} config={config} />;
    case 'billable_time_logs':
      return <BillableTimeLogsWidget title={titleOf(widgetKey, t)} description={descriptionOf(widgetKey, t)} config={config} />;
    case 'client_stats':
      return <ClientStatsWidget title={titleOf(widgetKey, t)} description={descriptionOf(widgetKey, t)} config={config} />;
    case 'project_health_stats':
      return <ProjectHealthStatsWidget title={titleOf(widgetKey, t)} description={descriptionOf(widgetKey, t)} config={config} />;
    case 'incomplete_tasks_by_project':
      return <IncompleteTasksByProjectWidget title={titleOf(widgetKey, t)} description={descriptionOf(widgetKey, t)} config={config} />;
    case 'upcoming_tasks':
      return <UpcomingTasksWidget title={titleOf(widgetKey, t)} description={descriptionOf(widgetKey, t)} config={config} />;
    case 'overdue_tasks':
      return <OverdueTasksWidget title={titleOf(widgetKey, t)} description={descriptionOf(widgetKey, t)} config={config} />;
    case 'burndown_chart':
      return <BurndownChartWidget title={titleOf(widgetKey, t)} description={descriptionOf(widgetKey, t)} config={config} />;
    case 'burnup_chart':
      return <BurnupChartWidget title={titleOf(widgetKey, t)} description={descriptionOf(widgetKey, t)} config={config} />;
    default:
      return null;
  }
};
