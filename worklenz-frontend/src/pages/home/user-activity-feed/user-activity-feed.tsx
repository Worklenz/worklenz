import React, { useMemo, useCallback, useEffect } from 'react';
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
      return Array.isArray(recentTasksData.data) ? recentTasksData.data : [];
    }
    // If it's a different object structure, try to extract tasks
    if (recentTasksData && typeof recentTasksData === 'object') {
      const possibleArrays = Object.values(recentTasksData).filter(Array.isArray);
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
      return Array.isArray(timeLoggedTasksData.data) ? timeLoggedTasksData.data : [];
    }
    // If it's a different object structure, try to extract tasks
    if (timeLoggedTasksData && typeof timeLoggedTasksData === 'object') {
      const possibleArrays = Object.values(timeLoggedTasksData).filter(Array.isArray);
      return possibleArrays.length > 0 ? possibleArrays[0] : [];
    }
    return [];
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

  // Refetch data when the active tab changes
  useEffect(() => {
    if (activeTab === ActivityFeedType.RECENT_TASKS) {
      refetchRecentTasks();
    } else if (activeTab === ActivityFeedType.TIME_LOGGED_TASKS) {
      refetchTimeLoggedTasks();
    }
  }, [activeTab, refetchRecentTasks, refetchTimeLoggedTasks]);

  const renderContent = () => {
    if (activeTab === ActivityFeedType.RECENT_TASKS) {
      if (loadingRecentTasks) {
        return <Skeleton active />;
      }
      if (recentTasksError) {
        return <Alert message={t('Error Loading Recent Tasks')} type="error" showIcon />;
      }
      if (recentTasks.length === 0) {
        return <Empty description={t('No Recent Tasks')} />;
      }
      return <TaskActivityList tasks={recentTasks} />;
    } else {
      if (loadingTimeLoggedTasks) {
        return <Skeleton active />;
      }
      if (timeLoggedTasksError) {
        return <Alert message={t('Error Loading Time Logged Tasks')} type="error" showIcon />;
      }
      if (timeLoggedTasks.length === 0) {
        return <Empty description={t('No Time Logged Tasks')} />;
      }
      return <TimeLoggedTaskList tasks={timeLoggedTasks} />;
    }
  };

  return (
    <Card title={t('Recent Activity')}>
      <div style={{ marginBottom: 16 }}>
        <Segmented
          options={segmentOptions}
          value={activeTab}
          onChange={handleTabChange}
        />
      </div>
      {renderContent()}
    </Card>
  );
};

export default React.memo(UserActivityFeed);
