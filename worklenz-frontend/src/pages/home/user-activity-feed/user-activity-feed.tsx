import React, { useMemo, useCallback, useEffect } from 'react';
import { Card, Segmented, Skeleton, Empty, Typography, Alert, Button, Tooltip } from '@/shared/antd-imports';
import { ClockCircleOutlined, UnorderedListOutlined, SyncOutlined } from '@/shared/antd-imports';
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
    refetch: refetchRecentTasks,
  } = useGetUserRecentTasksQuery(
    { limit: 10 },
    { 
      skip: false,
      refetchOnMountOrArgChange: true
    }
  );

  const {
    data: timeLoggedTasksData,
    isLoading: loadingTimeLoggedTasks,
    error: timeLoggedTasksError,
    refetch: refetchTimeLoggedTasks,
  } = useGetUserTimeLoggedTasksQuery(
    { limit: 10 },
    { 
      skip: false,
      refetchOnMountOrArgChange: true
    }
  );

  const recentTasks = useMemo(() => {
    if (!recentTasksData) return [];
    // Handle both array and object responses from the API
    if (Array.isArray(recentTasksData)) {
      return recentTasksData;
    }
    // If it's an object with a data property (common API pattern)
    if (recentTasksData && typeof recentTasksData === 'object' && 'data' in recentTasksData) {
      const data = (recentTasksData as any).data;
      return Array.isArray(data) ? data : [];
    }
    // If it's a different object structure, try to extract tasks
    if (recentTasksData && typeof recentTasksData === 'object') {
      const possibleArrays = Object.values(recentTasksData as any).filter(Array.isArray);
      return possibleArrays.length > 0 ? possibleArrays[0] : [];
    }
    return [];
  }, [recentTasksData]);

  const timeLoggedTasks = useMemo(() => {
    if (!timeLoggedTasksData) return [];
    // Handle both array and object responses from the API
    if (Array.isArray(timeLoggedTasksData)) {
      return timeLoggedTasksData;
    }
    // If it's an object with a data property (common API pattern)
    if (timeLoggedTasksData && typeof timeLoggedTasksData === 'object' && 'data' in timeLoggedTasksData) {
      const data = (timeLoggedTasksData as any).data;
      return Array.isArray(data) ? data : [];
    }
    // If it's a different object structure, try to extract tasks
    if (timeLoggedTasksData && typeof timeLoggedTasksData === 'object') {
      const possibleArrays = Object.values(timeLoggedTasksData as any).filter(Array.isArray);
      return possibleArrays.length > 0 ? possibleArrays[0] : [];
    }
    return [];
  }, [timeLoggedTasksData]);

  const segmentOptions = useMemo(
    () => [
      {
        value: ActivityFeedType.TIME_LOGGED_TASKS,
        label: (
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <ClockCircleOutlined style={{ fontSize: 14 }} />
            {t('tasks.timeLoggedSegment')}
          </span>
        ),
      },
      {
        value: ActivityFeedType.RECENT_TASKS,
        label: (
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <UnorderedListOutlined style={{ fontSize: 14 }} />
            {t('tasks.recentTasksSegment')}
          </span>
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

  // Refetch data when the active tab changes
  useEffect(() => {
    if (activeTab === ActivityFeedType.RECENT_TASKS) {
      refetchRecentTasks();
    } else if (activeTab === ActivityFeedType.TIME_LOGGED_TASKS) {
      refetchTimeLoggedTasks();
    }
  }, [activeTab, refetchRecentTasks, refetchTimeLoggedTasks]);

  const handleRefresh = useCallback(() => {
    if (activeTab === ActivityFeedType.TIME_LOGGED_TASKS) {
      refetchTimeLoggedTasks();
    } else {
      refetchRecentTasks();
    }
  }, [activeTab, refetchRecentTasks, refetchTimeLoggedTasks]);

  const isLoading = activeTab === ActivityFeedType.TIME_LOGGED_TASKS ? loadingTimeLoggedTasks : loadingRecentTasks;
  const currentCount = activeTab === ActivityFeedType.TIME_LOGGED_TASKS ? timeLoggedTasks.length : recentTasks.length;

  const renderContent = () => {
    if (activeTab === ActivityFeedType.TIME_LOGGED_TASKS) {
      if (loadingTimeLoggedTasks) {
        return <Skeleton active />;
      }
      if (timeLoggedTasksError) {
        return <Alert message={t('tasks.errorLoadingTimeLoggedTasks')} type="error" showIcon />;
      }
      if (timeLoggedTasks.length === 0) {
        return <Empty description={t('tasks.noTimeLoggedTasks')} />;
      }
      return (
        <div style={{ maxHeight: 450, overflow: 'auto' }}>
          <TimeLoggedTaskList tasks={timeLoggedTasks} />
        </div>
      );
    } else if (activeTab === ActivityFeedType.RECENT_TASKS) {
      if (loadingRecentTasks) {
        return <Skeleton active />;
      }
      if (recentTasksError) {
        return <Alert message={t('tasks.errorLoadingRecentTasks')} type="error" showIcon />;
      }
      if (recentTasks.length === 0) {
        return <Empty description={t('tasks.noRecentTasks')} />;
      }
      return (
        <div style={{ maxHeight: 450, overflow: 'auto' }}>
          <TaskActivityList tasks={recentTasks} />
        </div>
      );
    }
    return null;
  };

  return (
    <Card 
      title={
        <Typography.Title level={5} style={{ marginBlockEnd: 0 }}>
          {t('tasks.recentActivity')} ({currentCount})
        </Typography.Title>
      }
      extra={
        <Tooltip title={t('tasks.refresh')}>
          <Button 
            shape="circle" 
            icon={<SyncOutlined spin={isLoading} />} 
            onClick={handleRefresh}
          />
        </Tooltip>
      }
      style={{ width: '100%' }}
    >
      <Segmented
        options={segmentOptions}
        value={activeTab}
        onChange={handleTabChange}
        style={{ marginBottom: 16, width: '100%' }}
        block
      />
      {renderContent()}
    </Card>
  );
};

export default React.memo(UserActivityFeed);
