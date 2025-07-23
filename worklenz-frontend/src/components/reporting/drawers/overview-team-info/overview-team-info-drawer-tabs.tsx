import { Tabs } from '@/shared/antd-imports';
import { TabsProps } from 'antd/lib';
import { useTranslation } from 'react-i18next';
import OverviewReportsOverviewTab from './overview-tab/reports-overview-tab';
import OverviewReportsProjectsTab from './projects-tab/reporting-overview-projects-tab';
import OverviewReportsMembersTab from './members-tab/reporting-overview-members-tab';

type OverviewTeamInfoDrawerProps = {
  teamsId?: string | null;
};

const OverviewTeamInfoDrawerTabs = ({ teamsId = null }: OverviewTeamInfoDrawerProps) => {
  const { t } = useTranslation('reporting-overview-drawer');

  const tabItems: TabsProps['items'] = [
    {
      key: 'overview',
      label: t('overviewTab'),
      children: <OverviewReportsOverviewTab teamId={teamsId} />,
    },
    {
      key: 'projects',
      label: t('projectsTab'),
      children: <OverviewReportsProjectsTab teamsId={teamsId} />,
    },
    {
      key: 'members',
      label: t('membersTab'),
      children: <OverviewReportsMembersTab teamsId={teamsId} />,
    },
  ];

  return <Tabs type="card" items={tabItems} destroyInactiveTabPane defaultActiveKey="overview" />;
};

export default OverviewTeamInfoDrawerTabs;
