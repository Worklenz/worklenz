import { taskTimeLogsApiService } from '@/api/tasks/task-time-logs.api.service';
import SingleAvatar from '@/components/common/single-avatar/single-avatar';
import { colors } from '@/styles/colors';
import { ITaskLogViewModel } from '@/types/tasks/task-log-view.types';
import { calculateTimeGap } from '@/utils/calculate-time-gap';
import logger from '@/utils/errorLogger';
import { formatDateTimeWithLocale } from '@/utils/format-date-time-with-locale';
import { formatDate } from '@/utils/timeUtils';
import { PlayCircleFilled } from '@ant-design/icons';
import { Flex, Button, Popover, Typography, Divider, Skeleton, Tooltip, Tag } from 'antd/es';
import React from 'react';
import { useState } from 'react';

interface TaskTimerProps {
  started: boolean;
  handleStartTimer: () => void;
  handleStopTimer: () => void;
  timeString: string;
  taskId: string;
  disabled?: boolean;
  disabledTooltip?: string;
}

const TaskTimer = ({
  started,
  handleStartTimer,
  handleStopTimer,
  timeString,
  taskId,
  disabled = false,
  disabledTooltip,
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
    <Flex vertical style={{ width: '100%', maxWidth: 450, maxHeight: 350, overflowY: 'scroll' }}>
      <Skeleton active loading={loading}>
      {timeLogs.map(log => {
        // Check if this time log is from a subtask
        const isFromSubtask = log.task_id && log.task_id !== taskId;
        
        const formatTime = (timeString: string | undefined) => {
          if (!timeString) return '';
          try {
            return new Date(timeString).toLocaleTimeString([], { 
              hour: '2-digit', 
              minute: '2-digit',
              hour12: true 
            });
          } catch {
            return timeString;
          }
        };
        
        return (
          <React.Fragment key={log.id}>
          <Flex vertical gap={8} style={{ padding: '8px 0' }}>
            <Flex gap={12} align="center">
              <SingleAvatar avatarUrl={log.avatar_url} name={log.user_name} />
              <Flex vertical style={{ flex: 1, minWidth: 0 }}>
                <Flex align="center" gap={8} wrap>
                  <Typography.Text strong style={{ fontSize: 14 }}>
                    {log.user_name}
                  </Typography.Text>
                  {log.task_name && (
                    <Tag color={isFromSubtask ? "blue" : "default"} style={{ fontSize: '10px', margin: 0, padding: '0 4px' }}>
                      {log.task_name}
                    </Tag>
                  )}
                  {log.logged_by_timer && (
                    <Tag color="green" style={{ fontSize: '10px', margin: 0 }}>
                      Timer
                    </Tag>
                  )}
                </Flex>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  {calculateTimeGap(log.created_at || '')}
                </Typography.Text>
              </Flex>
            </Flex>
            
            <Flex align="center" gap={12} style={{ 
              backgroundColor: '#fafafa', 
              padding: '6px 8px', 
              borderRadius: 4,
              fontSize: '11px'
            }}>
              <Flex vertical gap={2}>
                <Typography.Text type="secondary" style={{ fontSize: '10px' }}>
                  Start
                </Typography.Text>
                <Typography.Text strong style={{ fontSize: '11px' }}>
                  {formatTime(log.start_time)}
                </Typography.Text>
              </Flex>
              <Typography.Text type="secondary" style={{ fontSize: '10px' }}>→</Typography.Text>
              <Flex vertical gap={2}>
                <Typography.Text type="secondary" style={{ fontSize: '10px' }}>
                  End
                </Typography.Text>
                <Typography.Text strong style={{ fontSize: '11px' }}>
                  {formatTime(log.end_time)}
                </Typography.Text>
              </Flex>
              <Divider type="vertical" style={{ height: '16px', margin: 0 }} />
              <Flex vertical gap={2}>
                <Typography.Text type="secondary" style={{ fontSize: '10px' }}>
                  Duration
                </Typography.Text>
                <Typography.Text strong style={{ color: '#1890ff', fontSize: '11px' }}>
                  {formatTimeSpent(log.time_spent || 0)}
                </Typography.Text>
              </Flex>
            </Flex>
          </Flex>
          <Divider style={{ marginBlock: 8 }} />
          </React.Fragment>
        );
      })}
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

  const renderTimerButton = () => {
    const button = started ? (
      <Button 
        type="text" 
        icon={renderStopIcon()} 
        onClick={handleStopTimer}
        disabled={disabled}
        style={{ 
          opacity: disabled ? 0.5 : 1,
          cursor: disabled ? 'not-allowed' : 'pointer'
        }}
      />
    ) : (
      <Button
        type="text"
        icon={<PlayCircleFilled style={{ color: disabled ? colors.lightGray : colors.skyBlue, fontSize: 16 }} />}
        onClick={handleStartTimer}
        disabled={disabled}
        style={{ 
          opacity: disabled ? 0.5 : 1,
          cursor: disabled ? 'not-allowed' : 'pointer'
        }}
      />
    );

    if (disabled && disabledTooltip) {
      return (
        <Tooltip title={disabledTooltip}>
          {button}
        </Tooltip>
      );
    }

    return button;
  };

  return (
    <Flex gap={4} align="center">
      {renderTimerButton()}
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
