import {
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  FileExcelOutlined,
} from '@/shared/antd-imports';
import { Button, Card, Flex } from '@/shared/antd-imports';
import React, { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import {
  setMemberReportingDrawerActiveTab,
  toggleMembersOverviewTasksStatsDrawer,
  toggleMembersOverviewProjectsStatsDrawer,
} from '../../membersReportsSlice';
import { useAppSelector } from '@/hooks/useAppSelector';
import { IRPTOverviewMemberStats } from '@/types/reporting/reporting.types';

interface StatCardProps {
  statsModel: IRPTOverviewMemberStats | undefined;
  loading: boolean;
}

const MembersReportsStatCard = ({ statsModel, loading }: StatCardProps) => {
  // localization
  const { t } = useTranslation('reporting-members-drawer');

  const dispatch = useAppDispatch();
  const themeMode = useAppSelector(state => state.themeReducer.mode);

  // function to handle members overview tasks stat drawer open
  const handleMembersOverviewTasksStatsDrawerToggle = () => {
    dispatch(toggleMembersOverviewTasksStatsDrawer());
  };

  // function to handle members overview projects stat drawer open
  const handleMembersOverviewProjectsStatsDrawerToggle = () => {
    dispatch(toggleMembersOverviewProjectsStatsDrawer());
  };

  // fuction to handle tab change
  const handleNavigateTimeLogsTab = () => {
    dispatch(setMemberReportingDrawerActiveTab('timeLogs'));
  };

  type StatItemsType = {
    name: string;
    icon: ReactNode;
    value: string;
    onClick: () => void;
  };

  // stat items array
  const statItems: StatItemsType[] = [
    {
      name: 'projects',
      icon: <FileExcelOutlined style={{ fontSize: 24, color: '#f6ce69' }} />,
      value: statsModel?.projects.toString() || '0',
      onClick: handleMembersOverviewProjectsStatsDrawerToggle,
    },
    {
      name: 'totalTasks',
      icon: <ExclamationCircleOutlined style={{ fontSize: 24, color: '#70eded' }} />,
      value: statsModel?.total_tasks.toString() || '0',
      onClick: handleMembersOverviewTasksStatsDrawerToggle,
    },
    {
      name: 'assignedTasks',
      icon: <ExclamationCircleOutlined style={{ fontSize: 24, color: '#7590c9' }} />,
      value: statsModel?.assigned.toString() || '0',
      onClick: handleMembersOverviewTasksStatsDrawerToggle,
    },
    {
      name: 'completedTasks',
      icon: <ExclamationCircleOutlined style={{ fontSize: 24, color: '#75c997' }} />,
      value: statsModel?.completed.toString() || '0',
      onClick: handleMembersOverviewTasksStatsDrawerToggle,
    },
    {
      name: 'ongoingTasks',
      icon: <ClockCircleOutlined style={{ fontSize: 24, color: '#7cb5ec' }} />,
      value: statsModel?.ongoing.toString() || '0',
      onClick: handleMembersOverviewTasksStatsDrawerToggle,
    },
    {
      name: 'overdueTasks',
      icon: <ClockCircleOutlined style={{ fontSize: 24, color: '#eb6363' }} />,
      value: statsModel?.overdue.toString() || '0',
      onClick: handleMembersOverviewTasksStatsDrawerToggle,
    },
    {
      name: 'loggedHours',
      icon: <ClockCircleOutlined style={{ fontSize: 24, color: '#75c997' }} />,
      value: statsModel?.total_logged.toString() || '0',
      onClick: handleNavigateTimeLogsTab,
    },
  ];

  return (
    <Card style={{ width: '100%' }} loading={loading}>
      <Flex vertical gap={8} style={{ padding: '12px 24px' }}>
        {statItems.map((item, index) => (
          <Flex key={index} gap={12} align="center">
            {item.icon}
            <Button type="text" onClick={item.onClick}>
              {item.value} {t(`${item.name}Text`)}
            </Button>
          </Flex>
        ))}
      </Flex>
    </Card>
  );
};

export default MembersReportsStatCard;
