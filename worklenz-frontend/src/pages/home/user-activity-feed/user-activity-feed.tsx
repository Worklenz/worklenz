import React, { useMemo, useCallback } from 'react';
import { Card, Segmented, Skeleton, Empty, Typography, Alert } from 'antd';
import { ClockCircleOutlined, UnorderedListOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { ActivityFeedType } from '@/types/home/user-activity.types';
import { setActiveTab } from '@/features/home-page/user-activity.slice';
import {
  useGetUserRecentTasksQuery,
  useGetUserTimeLoggedTasksQuery,
} from '@/api/home-page/user-activity.api.service';
import TaskActivityList from './task-activity-list';
import TimeLoggedTaskList from './time-logged-task-list';

const { Title } = Typography;

const UserActivityFeed: React.FC = () => {
  const { t } = useTranslation('home');
  const dispatch = useAppDispatch();
  const { activeTab } = useAppSelector(state => state.userActivityReducer);

  const {
    data: recentTasksData,
    isLoading: loadingRecentTasks,
    error: recentTasksError,
  } = useGetUserRecentTasksQuery(
    { limit: 10 },
    { skip: activeTab !== ActivityFeedType.RECENT_TASKS }
  );

  const {
    data: timeLoggedTasksData,
    isLoading: loadingTimeLoggedTasks,
    error: timeLoggedTasksError,
  } = useGetUserTimeLoggedTasksQuery(
    { limit: 10 },
    { skip: activeTab !== ActivityFeedType.TIME_LOGGED_TASKS }
  );

  const recentTasks = useMemo(() => {
    if (!recentTasksData) return [];
    return Array.isArray(recentTasksData) ? recentTasksData : [];
  }, [recentTasksData]);

  const timeLoggedTasks = useMemo(() => {
    if (!timeLoggedTasksData) return [];
    return Array.isArray(timeLoggedTasksData) ? timeLoggedTasksData : [];
  }, [timeLoggedTasksData]);

  const segmentOptions = useMemo(
    () => [
      {
        value: ActivityFeedType.RECENT_TASKS,
        label: (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <UnorderedListOutlined />
            <span>{t('Recent Tasks')}</span>
          </div>
        ),
      },
      {
        value: ActivityFeedType.TIME_LOGGED_TASKS,
        label: (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <ClockCircleOutlined />
            <span>{t('Time Logged Tasks')}</span>
          </div>
        ),
      },
    ],
    [t]
  );

  const handleTabChange = useCallback(
    (value: ActivityFeedType) => {
      dispatch(setActiveTab(value));
    },
    [dispatch]
  );

  const renderContent = () => {
    if (activeTab === ActivityFeedType.RECENT_TASKS) {
      if (recentTasksError) {
        return <Alert message={t('Error Loading Recent Tasks')} type="error" showIcon />;
      }
      if (loadingRecentTasks) {
        return <Skeleton active />;
      }
      if (recentTasks.length === 0) {
        return <Empty description={t('No Recent Tasks')} />;
      }
      return <TaskActivityList tasks={recentTasks} />;
    } else {
      if (timeLoggedTasksError) {
        return <Alert message={t('Error Loading Time Logged Tasks')} type="error" showIcon />;
      }
      if (loadingTimeLoggedTasks) {
        return <Skeleton active />;
      }
      if (timeLoggedTasks.length === 0) {
        return <Empty description={t('No Time Logged Tasks')} />;
      }
      return <TimeLoggedTaskList tasks={timeLoggedTasks} />;
    }
  };

  return (
    <Card>
      <div style={{ marginBottom: 16 }}>
        <Title level={5} style={{ marginBottom: 12 }}>
          {t('Recent Activity')}
        </Title>
        <Segmented
          options={segmentOptions}
          value={activeTab}
          onChange={handleTabChange}
          style={{ width: '100%' }}
        />
      </div>
      {renderContent()}
    </Card>
  );
};

export default React.memo(UserActivityFeed);
