import { DownloadOutlined, PlayCircleFilled, PlusOutlined } from '@ant-design/icons';
import { Button, Divider, Flex, Skeleton, Typography } from 'antd';
import { useEffect, useState, useCallback } from 'react';
import { TFunction } from 'i18next';

import EmptyListPlaceholder from '@/components/EmptyListPlaceholder';
import { themeWiseColor } from '@/utils/themeWiseColor';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { setTimeLogEditing } from '@/features/task-drawer/task-drawer.slice';
import TimeLogList from './time-log-list';
import { taskTimeLogsApiService } from '@/api/tasks/task-time-logs.api.service';
import { ITaskLogViewModel } from '@/types/tasks/task-log-view.types';
import TaskTimer from '@/components/taskListCommon/task-timer/task-timer';
import { useTaskTimer } from '@/hooks/useTaskTimer';
import logger from '@/utils/errorLogger';

interface TaskDrawerTimeLogProps {
  t: TFunction;
  refreshTrigger?: number;
}

const TaskDrawerTimeLog = ({ t, refreshTrigger = 0 }: TaskDrawerTimeLogProps) => {
  const [timeLoggedList, setTimeLoggedList] = useState<ITaskLogViewModel[]>([]);
  const [totalTimeText, setTotalTimeText] = useState<string>('0m 0s');
  const [loading, setLoading] = useState<boolean>(false);

  const dispatch = useAppDispatch();
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const { selectedTaskId, taskFormViewModel, timeLogEditing } = useAppSelector(
    state => state.taskDrawerReducer
  );

  const { started, timeString, handleStartTimer, handleStopTimer } = useTaskTimer(
    selectedTaskId || '',
    taskFormViewModel?.task?.timer_start_time || null
  );

  const formatTimeComponents = (hours: number, minutes: number, seconds: number): string => {
    const parts = [];
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);
    return parts.join(' ');
  };

  const buildTotalTimeText = useCallback((logs: ITaskLogViewModel[]) => {
    let totalLogged = 0;

    for (const log of logs) {
      const timeSpentInSeconds = Number(log.time_spent || '0');

      // Calculate hours, minutes, seconds for individual time log
      const hours = Math.floor(timeSpentInSeconds / 3600);
      const minutes = Math.floor((timeSpentInSeconds % 3600) / 60);
      const seconds = timeSpentInSeconds % 60;

      // Format individual time log text
      log.time_spent_text = formatTimeComponents(hours, minutes, seconds);

      // Add to total
      totalLogged += timeSpentInSeconds;
    }

    // Format total time text
    const totalHours = Math.floor(totalLogged / 3600);
    const totalMinutes = Math.floor((totalLogged % 3600) / 60);
    const totalSeconds = totalLogged % 60;

    setTotalTimeText(formatTimeComponents(totalHours, totalMinutes, totalSeconds));
  }, []);

  const fetchTimeLoggedList = useCallback(async () => {
    if (!selectedTaskId) return;
    try {
      setLoading(true);
      const res = await taskTimeLogsApiService.getByTask(selectedTaskId);
      if (res.done) {
        buildTotalTimeText(res.body);
        setTimeLoggedList(res.body);
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
    if (loading) {
      return <Skeleton active />;
    }

    if (timeLoggedList.length === 0) {
      return (
        <Flex vertical gap={8} align="center">
          <EmptyListPlaceholder text={t('taskTimeLogTab.noTimeLogsFound')} imageHeight={120} />
        </Flex>
      );
    }

    return <TimeLogList timeLoggedList={timeLoggedList} onRefresh={fetchTimeLoggedList} />;
  };

  return (
    <Flex vertical justify="space-between" style={{ width: '100%', height: '78vh' }}>
      <Flex vertical>
        <Flex align="center" justify="space-between" style={{ width: '100%' }}>
          <Typography.Text type="secondary">
            {t('taskTimeLogTab.totalLogged')}: {totalTimeText}
          </Typography.Text>
          <Flex gap={8} align="center">
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
          </Flex>
        </Flex>
        <Divider style={{ marginBlock: 8 }} />
        {renderTimeLogContent()}
      </Flex>
    </Flex>
  );
};

export default TaskDrawerTimeLog;
