import { DownloadOutlined } from '@/shared/antd-imports';
import { Button, Divider, Flex, Skeleton, Typography, Popover } from '@/shared/antd-imports';
import { useEffect, useState, useCallback } from 'react';
import { TFunction } from 'i18next';

import EmptyListPlaceholder from '@/components/EmptyListPlaceholder';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import TimeLogList from './time-log-list';
import { taskTimeLogsApiService } from '@/api/tasks/task-time-logs.api.service';
import { ITaskLogViewModel } from '@/types/tasks/task-log-view.types';
import TaskTimer from '@/components/taskListCommon/task-timer/task-timer';
import { useTaskTimerWithConflictCheck } from '@/hooks/useTaskTimerWithConflictCheck';
import logger from '@/utils/errorLogger';
import { toggleUpgradeModal } from '@/features/admin-center/admin-center.slice';
import { useAuthService } from '@/hooks/useAuth';
import { hasBusinessFeatureAccess } from '@/ee/utils/subscription-utils';
import { useAppSumoTracking } from '@/ee/hooks/useAppSumoTracking';
import { AppSumoUpsellEvents } from '@/types/mixpanel-events.types';
import { formatSecondsToTimeString } from '@/utils/time-format.utils';

interface TaskDrawerTimeLogProps {
  t: TFunction;
  refreshTrigger?: number;
  isGuest?: boolean;
}

const TaskDrawerTimeLog = ({ t, refreshTrigger = 0, isGuest = false }: TaskDrawerTimeLogProps) => {
  const [timeLoggedList, setTimeLoggedList] = useState<ITaskLogViewModel[]>([]);
  const [totalTimeText, setTotalTimeText] = useState<string>('0s');
  const [subtasksTotalSeconds, setSubtasksTotalSeconds] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [isHistoryPopoverOpen, setIsHistoryPopoverOpen] = useState(false);

  const { selectedTaskId, taskFormViewModel } = useAppSelector(state => state.taskDrawerReducer);
  const dispatch = useAppDispatch();
  const currentSession = useAuthService().getCurrentSession();
  const hasBusinessAccess = hasBusinessFeatureAccess(currentSession);
  const { trackAppSumoEvent } = useAppSumoTracking();
  const isAppSumoUser = String(currentSession?.subscription_type || '').toLowerCase().includes('appsumo');

  const { started, timeString, handleStartTimer, handleStopTimer } = useTaskTimerWithConflictCheck(
    selectedTaskId || '',
    taskFormViewModel?.task?.timer_start_time || null
  );

  // Hidden entirely (not shown as 0s) unless the task has subtasks AND those
  // subtasks actually have logged time — a non-zero total already implies both.
  const showSubtasksLogged = subtasksTotalSeconds > 0;
  const subtasksTimeText = formatSecondsToTimeString(subtasksTotalSeconds);

  const buildTotalTimeText = useCallback((logs: ITaskLogViewModel[]) => {
    let totalLogged = 0;

    for (const log of logs) {
      const timeSpentInSeconds = Number(log.time_spent || '0');
      log.time_spent_text = formatSecondsToTimeString(timeSpentInSeconds);
      totalLogged += timeSpentInSeconds;
    }

    setTotalTimeText(formatSecondsToTimeString(totalLogged));
  }, []);

  const fetchTimeLoggedList = useCallback(async () => {
    if (!selectedTaskId) return;
    try {
      setLoading(true);
      const res = await taskTimeLogsApiService.getByTask(selectedTaskId);
      if (res.done) {
        buildTotalTimeText(res.body.logs);
        setTimeLoggedList(res.body.logs);
        setSubtasksTotalSeconds(res.body.subtasks_total_time_spent || 0);
      }
    } catch (error) {
      logger.error('Failed to fetch time logs', error);
    } finally {
      setLoading(false);
    }
  }, [selectedTaskId, buildTotalTimeText]);

  const handleTimerStop = async () => {
    handleStopTimer();
    await fetchTimeLoggedList();
  };

  const handleExportToExcel = () => {
    if (!selectedTaskId) return;
    taskTimeLogsApiService.exportToExcel(selectedTaskId);
  };

  // Fetch time logs when selectedTaskId changes or refreshTrigger changes
  useEffect(() => {
    fetchTimeLoggedList();
  }, [selectedTaskId, fetchTimeLoggedList, refreshTrigger]);

  const renderTimeLogContent = () => {
    const ninetyDaysAgo = Date.now() - 90 * 24 * 60 * 60 * 1000;
    const visibleLogs = hasBusinessAccess
      ? timeLoggedList
      : timeLoggedList.filter(log => {
        if (!log.created_at) return true;
        return new Date(log.created_at).getTime() >= ninetyDaysAgo;
      });
    const lockedCount = hasBusinessAccess ? 0 : timeLoggedList.length - visibleLogs.length;

    if (loading) {
      return <Skeleton active />;
    }

    if (visibleLogs.length === 0) {
      return (
        <Flex vertical gap={8} align="center">
          <EmptyListPlaceholder text={t('taskTimeLogTab.noTimeLogsFound')} imageHeight={120} />
        </Flex>
      );
    }

    return (
      <Flex vertical gap={8}>
        <TimeLogList timeLoggedList={visibleLogs} onRefresh={fetchTimeLoggedList} isGuest={isGuest} />
        {lockedCount > 0 && (
          <Flex align="center" justify="space-between">
            <Typography.Text type="secondary">
              {t('taskTimeLogTab.historyLockedBoundary', {
                defaultValue: 'Time log history is limited to the last 90 days on this plan',
              })}
            </Typography.Text>
            <Popover
              trigger="click"
              open={isHistoryPopoverOpen}
              onOpenChange={open => {
                setIsHistoryPopoverOpen(open);
                if (isAppSumoUser) {
                  trackAppSumoEvent(
                    open ? AppSumoUpsellEvents.UPGRADE_PROMPT_SHOWN : AppSumoUpsellEvents.UPGRADE_PROMPT_DISMISSED,
                    { feature: 'time_log_history' }
                  );
                }
              }}
              title={t('taskTimeLogTab.historyLockedTitle', {
                defaultValue: 'Time Log History Locked',
              })}
              content={
                <Flex vertical gap={12} style={{ maxWidth: 280 }}>
                  <Typography.Text>
                    {t('taskTimeLogTab.historyLockedBody', {
                      defaultValue:
                        'Time log entries beyond 90 days are available on the Business plan.',
                    })}
                  </Typography.Text>
                  <Button
                    type="primary"
                    onClick={() => {
                      setIsHistoryPopoverOpen(false);
                      if (isAppSumoUser) {
                        trackAppSumoEvent(AppSumoUpsellEvents.LOCKED_HISTORY_VIEW_CLICKED, { feature: 'time_log_history' });
                        trackAppSumoEvent(AppSumoUpsellEvents.UPGRADE_NOW_CLICKED, { feature: 'time_log_history' });
                      }
                      dispatch(toggleUpgradeModal());
                    }}
                  >
                    {t('upgradeNow', { defaultValue: 'Upgrade Now' })}
                  </Button>
                </Flex>
              }
            >
              <Button size="small">
                {t('taskTimeLogTab.viewFullTimeLog', { defaultValue: 'View time log history' })}
              </Button>
            </Popover>
          </Flex>
        )}
      </Flex>
    );
  };

  return (
    <Flex vertical justify="space-between" style={{ width: '100%', height: '78vh' }}>
      <Flex vertical>
        <Flex align="center" justify="space-between" style={{ width: '100%' }}>
          <Flex gap={12} align="center">
            <Typography.Text type="secondary">
              {t('taskTimeLogTab.totalLogged', { defaultValue: 'Total Logged' })}: {totalTimeText}
            </Typography.Text>
            {showSubtasksLogged && (
              <Typography.Text type="secondary">
                {t('taskTimeLogTab.subtasksLogged', { defaultValue: 'Subtasks Logged' })}:{' '}
                {subtasksTimeText}
              </Typography.Text>
            )}
          </Flex>
          <Flex gap={8} align="center">
            {!isGuest && (
              <>
                <TaskTimer
                  taskId={selectedTaskId || ''}
                  started={started}
                  handleStartTimer={handleStartTimer}
                  handleStopTimer={handleTimerStop}
                  timeString={timeString}
                />
                <Button size="small" icon={<DownloadOutlined />} onClick={handleExportToExcel}>
                  {t('taskTimeLogTab.exportToExcel')}
                </Button>
              </>
            )}
          </Flex>
        </Flex>
        <Divider style={{ marginBlock: 8 }} />
        {renderTimeLogContent()}
      </Flex>
    </Flex>
  );
};

export default TaskDrawerTimeLog;
