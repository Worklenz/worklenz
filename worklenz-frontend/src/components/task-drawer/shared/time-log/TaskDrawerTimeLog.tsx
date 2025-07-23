import { DownloadOutlined, PlusOutlined } from '@/shared/antd-imports';
import { Button, Divider, Flex, Skeleton, Typography } from '@/shared/antd-imports';
import { useEffect, useState } from 'react';

import EmptyListPlaceholder from '@/components/EmptyListPlaceholder';
import { themeWiseColor } from '@/utils/themeWiseColor';
import { useAppSelector } from '@/hooks/useAppSelector';
import TimeLogForm from './time-log-form';
import { taskTimeLogsApiService } from '@/api/tasks/task-time-logs.api.service';
import { ITaskLogViewModel } from '@/types/tasks/task-log-view.types';
import TaskTimer from '@/components/taskListCommon/task-timer/task-timer';
import { useTaskTimer } from '@/hooks/useTaskTimer';
import TimeLogItem from './time-log-item';

const TaskDrawerTimeLog = () => {
  const [timeLoggedList, setTimeLoggedList] = useState<ITaskLogViewModel[]>([]);
  const [totalTimeText, setTotalTimeText] = useState<string>('0m 0s');
  const [loading, setLoading] = useState<boolean>(false);
  const [isAddTimelogFormShow, setIsTimeLogFormShow] = useState<boolean>(false);

  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const { selectedTaskId, taskFormViewModel } = useAppSelector(state => state.taskDrawerReducer);

  const { started, timeString, handleStartTimer, handleStopTimer } = useTaskTimer(
    selectedTaskId || '',
    taskFormViewModel?.task?.timer_start_time || null
  );

  const buildTotalTimeText = (logs: ITaskLogViewModel[]) => {
    const totalLogged = logs.reduce((total, log) => {
      const timeSpentInSeconds = Number(log.time_spent || '0');
      log.time_spent_text = `${Math.floor(timeSpentInSeconds / 60)}m ${timeSpentInSeconds % 60}s`;
      return total + timeSpentInSeconds;
    }, 0);

    const totalMinutes = Math.floor(totalLogged / 60);
    const totalSeconds = totalLogged % 60;
    setTotalTimeText(`${totalMinutes}m ${totalSeconds}s`);
  };

  const fetchTimeLoggedList = async () => {
    if (!selectedTaskId) return;
    try {
      setLoading(true);
      const res = await taskTimeLogsApiService.getByTask(selectedTaskId);
      if (res.done) {
        buildTotalTimeText(res.body);
        setTimeLoggedList(res.body);
      }
    } catch (error) {
      console.error('Error fetching time logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTimerStop = async () => {
    handleStopTimer();
    await fetchTimeLoggedList();
  };

  useEffect(() => {
    fetchTimeLoggedList();
  }, [selectedTaskId]);

  const renderTimeLogList = () => {
    if (timeLoggedList.length === 0) {
      return (
        <Flex vertical gap={8} align="center">
          <EmptyListPlaceholder text="No time logs found in the task." imageHeight={120} />
          <Button
            type="primary"
            icon={<PlusOutlined />}
            style={{ width: 'fit-content' }}
            onClick={() => setIsTimeLogFormShow(true)}
          >
            Add Timelog
          </Button>
        </Flex>
      );
    }

    return (
      <Skeleton active loading={loading}>
        <Flex vertical gap={6}>
          {timeLoggedList.map(log => (
            <TimeLogItem key={log.id} log={log} />
          ))}
        </Flex>
      </Skeleton>
    );
  };

  const renderAddTimeLogButton = () => {
    if (!isAddTimelogFormShow && timeLoggedList.length > 0) {
      return (
        <Flex
          gap={8}
          vertical
          align="center"
          justify="center"
          style={{
            width: '100%',
            position: 'relative',
            height: 'fit-content',
            justifySelf: 'flex-end',
            paddingBlockStart: 24,
          }}
        >
          <div
            style={{
              marginBlockEnd: 0,
              height: 1,
              position: 'absolute',
              top: 0,
              width: '120%',
              backgroundColor: themeWiseColor('#ebebeb', '#3a3a3a', themeMode),
            }}
          />
          <Button
            type="primary"
            icon={<PlusOutlined />}
            style={{ width: '100%' }}
            onClick={() => setIsTimeLogFormShow(true)}
          >
            Add Timelog
          </Button>
        </Flex>
      );
    }
    return null;
  };

  return (
    <Flex vertical justify="space-between" style={{ width: '100%', height: '78vh' }}>
      <Flex vertical>
        <Flex align="center" justify="space-between" style={{ width: '100%' }}>
          <Typography.Text type="secondary">Total Logged: {totalTimeText}</Typography.Text>
          <Flex gap={8} align="center">
            <TaskTimer
              started={started}
              handleStartTimer={handleStartTimer}
              handleStopTimer={handleTimerStop}
              timeString={timeString}
              timeTrackingLogCard={<div>Time Tracking Log</div>}
            />
            <Button size="small" icon={<DownloadOutlined />}>
              Export to Excel
            </Button>
          </Flex>
        </Flex>
        <Divider style={{ marginBlock: 8 }} />
        {renderTimeLogList()}
      </Flex>

      {renderAddTimeLogButton()}
      {isAddTimelogFormShow && <TimeLogForm onCancel={() => setIsTimeLogFormShow(false)} />}
    </Flex>
  );
};

export default TaskDrawerTimeLog;
