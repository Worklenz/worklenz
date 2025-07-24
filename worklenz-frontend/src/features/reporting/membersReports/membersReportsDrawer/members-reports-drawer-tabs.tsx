import { Tabs } from '@/shared/antd-imports';
import { TabsProps } from 'antd/lib';
import React from 'react';
import MembersReportsOverviewTab from './overviewTab/MembersReportsOverviewTab';
import MembersReportsTimeLogsTab from './time-log-tab/members-reports-time-logs-tab';
import MembersReportsActivityLogsTab from './activity-log-tab/members-reports-activity-logs-tab';
import MembersReportsTasksTab from './taskTab/MembersReportsTasksTab';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '../../../../hooks/useAppSelector';
import { useAppDispatch } from '../../../../hooks/useAppDispatch';
import { setMemberReportingDrawerActiveTab } from '../membersReportsSlice';

type MembersReportsDrawerProps = {
  memberId?: string | null;
};

type TabsType = 'overview' | 'timeLogs' | 'activityLogs' | 'tasks';

const MembersReportsDrawerTabs = ({ memberId = null }: MembersReportsDrawerProps) => {
  // localization
  const { t } = useTranslation('reporting-members-drawer');

  const dispatch = useAppDispatch();

  // get active tab state from member reporting reducer
  const activeTab = useAppSelector(state => state.membersReportsReducer.activeTab);

  const tabItems: TabsProps['items'] = [
    {
      key: 'overview',
      label: t('overviewTab'),
      children: <MembersReportsOverviewTab memberId={memberId} />,
    },
    {
      key: 'timeLogs',
      label: t('timeLogsTab'),
      children: <MembersReportsTimeLogsTab memberId={memberId} />,
    },
    {
      key: 'activityLogs',
      label: t('activityLogsTab'),
      children: <MembersReportsActivityLogsTab memberId={memberId} />,
    },
    {
      key: 'tasks',
      label: t('tasksTab'),
      children: <MembersReportsTasksTab memberId={memberId} />,
    },
  ];

  return (
    <Tabs
      type="card"
      items={tabItems}
      activeKey={activeTab}
      destroyInactiveTabPane
      onTabClick={key => dispatch(setMemberReportingDrawerActiveTab(key as TabsType))}
    />
  );
};

export default MembersReportsDrawerTabs;
