import { taskTimeLogsApiService } from '@/api/tasks/task-time-logs.api.service';
import SingleAvatar from '@/components/common/single-avatar/single-avatar';
import { colors } from '@/styles/colors';
import { ITaskLogViewModel } from '@/types/tasks/task-log-view.types';
import { calculateTimeGap } from '@/utils/calculate-time-gap';
import logger from '@/utils/errorLogger';
import { formatDateTimeWithLocale } from '@/utils/format-date-time-with-locale';
import { formatDate } from '@/utils/timeUtils';
import { PlayCircleFilled } from '@ant-design/icons';
import { Flex, Button, Popover, Typography, Divider, Skeleton } from 'antd/es';
import React from 'react';
import { useState } from 'react';

interface TaskTimerProps {
  started: boolean;
  handleStartTimer: () => void;
  handleStopTimer: () => void;
  timeString: string;
  taskId: string;
}

const TaskTimer = ({
  started,
  handleStartTimer,
  handleStopTimer,
  timeString,
  taskId,
}: TaskTimerProps) => {
  const [timeLogs, setTimeLogs] = useState<ITaskLogViewModel[]>([]);
  const [loading, setLoading] = useState(false);

  const renderStopIcon = () => {
    return (
      <span
        className="nz-icon"
        style={{ fontSize: 8, position: 'relative', top: -1, left: 0, right: 0, bottom: 0 }}
      >
        <svg viewBox="0 0 1024 1024" width="1em" height="1em" fill="currentColor">
          <path d="M864 64H160C107 64 64 107 64 160v704c0 53 43 96 96 96h704c53 0 96-43 96-96V160c0-53-43-96-96-96z"></path>
        </svg>
      </span>
    );
  };

  const renderLoggedByTimer = (log: ITaskLogViewModel) => {
    if (!log.logged_by_timer) return null;
    return (
      <>
        via Timer about{' '}
        <Typography.Text strong style={{ fontSize: 15 }}>
          {log.logged_by_timer}
        </Typography.Text>
      </>
    );
  };
  const formatTimeSpent = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;

    // Pad numbers with leading zeros if needed
    const pad = (num: number) => num.toString().padStart(1, '0');

    if (hours >= 1) {
      return `${pad(hours)}h ${pad(minutes)}m ${pad(remainingSeconds)}s`;
    } else {
      return `${pad(minutes)}m ${pad(remainingSeconds)}s`;
    }
  };

  const timeTrackingLogCard = (
    <Flex vertical style={{ width: '100%', maxWidth: 400, maxHeight: 350, overflowY: 'scroll' }}>
      <Skeleton active loading={loading}>
        {timeLogs.map(log => (
          <React.Fragment key={log.id}>
            <Flex gap={12} align="center" wrap="wrap">
              <SingleAvatar avatarUrl={log.avatar_url} name={log.user_name} />
              <Flex vertical style={{ flex: 1, minWidth: 0 }}>
                <Typography style={{ fontSize: 15, wordBreak: 'break-word' }}>
                  <Typography.Text strong style={{ fontSize: 15 }}>
                    {log.user_name}&nbsp;
                  </Typography.Text>
                  logged&nbsp;
                  <Typography.Text strong style={{ fontSize: 15 }}>
                    {formatTimeSpent(log.time_spent || 0)}
                  </Typography.Text>{' '}
                  {renderLoggedByTimer(log)}
                  {calculateTimeGap(log.created_at || '')}
                </Typography>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  {formatDateTimeWithLocale(log.created_at || '')}
                </Typography.Text>
              </Flex>
            </Flex>
            <Divider style={{ marginBlock: 12 }} />
          </React.Fragment>
        ))}
      </Skeleton>
    </Flex>
  );

  const getTaskLogs = async () => {
    try {
      setLoading(true);
      const response = await taskTimeLogsApiService.getByTask(taskId);
      if (response.done) {
        setTimeLogs(response.body || []);
      }
    } catch (error) {
      logger.error('Error fetching task logs', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChange = (visible: boolean) => {
    if (visible) {
      getTaskLogs();
    } else {
      setTimeLogs([]);
    }
  };

  return (
    <Flex gap={4} align="center">
      {started ? (
        <Button type="text" icon={renderStopIcon()} onClick={handleStopTimer} />
      ) : (
        <Button
          type="text"
          icon={<PlayCircleFilled style={{ color: colors.skyBlue, fontSize: 16 }} />}
          onClick={handleStartTimer}
        />
      )}
      <Popover
        title={
          <Typography.Text style={{ fontWeight: 500 }}>
            Time Tracking Log
            <Divider style={{ marginBlockStart: 8, marginBlockEnd: 12 }} />
          </Typography.Text>
        }
        content={timeTrackingLogCard}
        trigger="click"
        placement="bottomRight"
        onOpenChange={handleOpenChange}
      >
        <Typography.Text style={{ cursor: 'pointer' }}>{timeString}</Typography.Text>
      </Popover>
    </Flex>
  );
};

export default TaskTimer;
