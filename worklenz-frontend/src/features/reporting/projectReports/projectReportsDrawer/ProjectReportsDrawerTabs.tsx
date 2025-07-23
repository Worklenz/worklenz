import { Tabs } from '@/shared/antd-imports';
import { TabsProps } from 'antd/lib';
import { useTranslation } from 'react-i18next';

import ProjectReportsOverviewTab from './overviewTab/ProjectReportsOverviewTab';
import ProjectReportsMembersTab from './membersTab/ProjectReportsMembersTab';
import ProjectReportsTasksTab from './tasksTab/ProjectReportsTasksTab';

type ProjectReportsDrawerProps = {
  projectId?: string | null;
};

const ProjectReportsDrawerTabs = ({ projectId = null }: ProjectReportsDrawerProps) => {
  // localization
  const { t } = useTranslation('reporting-projects-drawer');

  const tabItems: TabsProps['items'] = [
    {
      key: 'overview',
      label: t('overviewTab'),
      children: <ProjectReportsOverviewTab projectId={projectId} />,
    },
    {
      key: 'members',
      label: t('membersTab'),
      children: <ProjectReportsMembersTab projectId={projectId} />,
    },
    {
      key: 'tasks',
      label: t('tasksTab'),
      children: <ProjectReportsTasksTab projectId={projectId} />,
    },
  ];

  return <Tabs type="card" items={tabItems} destroyInactiveTabPane />;
};

export default ProjectReportsDrawerTabs;
