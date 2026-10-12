import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  BankOutlined,
  Card,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  FileOutlined,
  UserOutlined,
  UsergroupAddOutlined,
  WarningOutlined,
} from '@/shared/antd-imports';
import { colors } from '@/styles/colors';
import type { WidgetDefinition } from '@/components/dashboard-grid';
import type { OverviewWidgetKey } from '@/api/reporting/overview-layout.api.service';
import OverviewStatCard from '../components/overview-stat-card';
import OverviewReportsTable from '../components/overview-table/overview-reports-table';
import { useOverviewData } from './OverviewDataContext';

const KPI = { size: { w: 3, h: 3 }, min: { w: 2, h: 3 } };

/** The Overview widget catalogue. Order here is also the order shown in "Add widget". */
export const OVERVIEW_WIDGETS: WidgetDefinition<OverviewWidgetKey>[] = [
  { type: 'kpi_teams', titleKey: 'reporting-overview:teamsText', defaultTitle: 'Teams', ...KPI },
  { type: 'kpi_projects', titleKey: 'reporting-overview:projectCountPlural', defaultTitle: 'Projects', ...KPI },
  { type: 'kpi_members', titleKey: 'reporting-overview:memberCountPlural', defaultTitle: 'Members', ...KPI },
  { type: 'teams_table', titleKey: 'reporting-overview:teamsText', defaultTitle: 'Teams', size: { w: 12, h: 11 }, min: { w: 4, h: 6 } },
  {
    type: 'kpi_active_projects',
    titleKey: 'reporting-overview:activeProjectCountPlural',
    defaultTitle: 'Active Projects',
    ...KPI,
    hiddenByDefault: true,
  },
  {
    type: 'kpi_overdue_projects',
    titleKey: 'reporting-overview:overdueProjectCountPlural',
    defaultTitle: 'Overdue Projects',
    ...KPI,
    hiddenByDefault: true,
  },
  {
    type: 'kpi_unassigned_members',
    titleKey: 'reporting-overview:unassignedMemberCountPlural',
    defaultTitle: 'Unassigned Members',
    ...KPI,
    hiddenByDefault: true,
  },
  {
    type: 'kpi_members_with_overdue_tasks',
    titleKey: 'reporting-overview:memberWithOverdueTaskCountPlural',
    defaultTitle: 'Members With Overdue Tasks',
    ...KPI,
    hiddenByDefault: true,
  },
];

export const titleOf = (type: OverviewWidgetKey, t: (key: string, options?: Record<string, unknown>) => string): string => {
  const def = OVERVIEW_WIDGETS.find(item => item.type === type);
  return def ? t(def.titleKey, { defaultValue: def.defaultTitle }) : type;
};

/** A single-number KPI tile, matching the counts shown in the original Overview page's three big cards. */
const SimpleKpi: React.FC<{ icon: React.ReactNode; count: number | undefined; singularKey: string; pluralKey: string; loading: boolean }> = ({
  icon,
  count = 0,
  singularKey,
  pluralKey,
  loading,
}) => {
  const { t } = useTranslation('reporting-overview');
  return (
    <OverviewStatCard icon={icon} title={`${count} ${count === 1 ? t(singularKey) : t(pluralKey)}`} loading={loading} />
  );
};

const TeamsKpi: React.FC = () => {
  const { stats, loading } = useOverviewData();
  const { t } = useTranslation('reporting-overview');
  return (
    <OverviewStatCard
      icon={<BankOutlined style={{ color: colors.skyBlue, fontSize: 42 }} />}
      title={`${stats.teams?.count ?? 0} ${(stats.teams?.count ?? 0) === 1 ? t('teamCount') : t('teamCountPlural')}`}
      loading={loading}
    >
      <div style={{ fontSize: 14, color: 'var(--ant-color-text-secondary, rgba(0,0,0,0.65))' }}>
        {stats.teams?.projects ?? 0} {t('projectCountPlural')} · {stats.teams?.members ?? 0} {t('memberCountPlural')}
      </div>
    </OverviewStatCard>
  );
};

const ProjectsKpi: React.FC = () => {
  const { stats, loading } = useOverviewData();
  const { t } = useTranslation('reporting-overview');
  return (
    <OverviewStatCard
      icon={<FileOutlined style={{ color: colors.limeGreen, fontSize: 42 }} />}
      title={`${stats.projects?.count ?? 0} ${(stats.projects?.count ?? 0) === 1 ? t('projectCount') : t('projectCountPlural')}`}
      loading={loading}
    >
      <div style={{ fontSize: 14 }}>{stats.projects?.active ?? 0} {t('activeProjectCountPlural')}</div>
      <div style={{ fontSize: 14, color: '#ff4d4f' }}>{stats.projects?.overdue ?? 0} {t('overdueProjectCountPlural')}</div>
    </OverviewStatCard>
  );
};

const MembersKpi: React.FC = () => {
  const { stats, loading } = useOverviewData();
  const { t } = useTranslation('reporting-overview');
  return (
    <OverviewStatCard
      icon={<UsergroupAddOutlined style={{ color: colors.lightGray, fontSize: 42 }} />}
      title={`${stats.members?.count ?? 0} ${(stats.members?.count ?? 0) === 1 ? t('memberCount') : t('memberCountPlural')}`}
      loading={loading}
    >
      <div style={{ fontSize: 14 }}>{stats.members?.unassigned ?? 0} {t('unassignedMemberCountPlural')}</div>
      <div style={{ fontSize: 14, color: '#ff4d4f' }}>{stats.members?.overdue ?? 0} {t('memberWithOverdueTaskCountPlural')}</div>
    </OverviewStatCard>
  );
};

const ActiveProjectsKpi: React.FC = () => {
  const { stats, loading } = useOverviewData();
  return (
    <SimpleKpi
      icon={<CheckCircleOutlined style={{ color: colors.limeGreen, fontSize: 42 }} />}
      count={stats.projects?.active}
      singularKey="activeProjectCount"
      pluralKey="activeProjectCountPlural"
      loading={loading}
    />
  );
};

const OverdueProjectsKpi: React.FC = () => {
  const { stats, loading } = useOverviewData();
  return (
    <SimpleKpi
      icon={<ExclamationCircleOutlined style={{ color: '#ff4d4f', fontSize: 42 }} />}
      count={stats.projects?.overdue}
      singularKey="overdueProjectCount"
      pluralKey="overdueProjectCountPlural"
      loading={loading}
    />
  );
};

const UnassignedMembersKpi: React.FC = () => {
  const { stats, loading } = useOverviewData();
  return (
    <SimpleKpi
      icon={<UserOutlined style={{ color: colors.lightGray, fontSize: 42 }} />}
      count={stats.members?.unassigned}
      singularKey="unassignedMemberCount"
      pluralKey="unassignedMemberCountPlural"
      loading={loading}
    />
  );
};

const MembersWithOverdueTasksKpi: React.FC = () => {
  const { stats, loading } = useOverviewData();
  return (
    <SimpleKpi
      icon={<WarningOutlined style={{ color: '#ff4d4f', fontSize: 42 }} />}
      count={stats.members?.overdue}
      singularKey="memberWithOverdueTaskCount"
      pluralKey="memberWithOverdueTaskCountPlural"
      loading={loading}
    />
  );
};

/** The teams table in a scrollable card, so it fits the grid's fixed-height cell instead of growing it. */
const TeamsTableWidget: React.FC = () => {
  const { t } = useTranslation('reporting-overview');
  return (
    <Card title={t('teamsText')} style={{ height: '100%' }} styles={{ body: { height: 'calc(100% - 57px)', overflow: 'auto' } }}>
      <OverviewReportsTable />
    </Card>
  );
};

/** Renders a single Overview widget by its key. */
export const OverviewWidgetByKey: React.FC<{ widgetKey: OverviewWidgetKey }> = ({ widgetKey }) => {
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
    default:
      return null;
  }
};
