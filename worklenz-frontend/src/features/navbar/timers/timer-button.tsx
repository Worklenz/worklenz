import { ClockCircleOutlined, StopOutlined } from '@/shared/antd-imports';
import {
  Badge,
  Button,
  Dropdown,
  List,
  Tooltip,
  Typography,
  Space,
  Divider,
  theme,
} from '@/shared/antd-imports';
import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { taskTimeLogsApiService, IRunningTimer } from '@/api/tasks/task-time-logs.api.service';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useSocket } from '@/socket/socketContext';
import { SocketEvents } from '@/shared/socket-events';
import { updateTaskTimeTracking } from '@/features/tasks/tasks.slice';
import { format, differenceInSeconds, isValid, parseISO } from 'date-fns';

const { Text } = Typography;
const { useToken } = theme;

const TimerButton = () => {
  const [runningTimers, setRunningTimers] = useState<IRunningTimer[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentTimes, setCurrentTimes] = useState<Record<string, string>>({});
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { t } = useTranslation('navbar');
  const { token } = useToken();
  const dispatch = useAppDispatch();
  const { socket } = useSocket();

  const logError = (message: string, error?: any) => {
    // Production-safe error logging
    console.error(`[TimerButton] ${message}`, error);
    setError(message);
  };

  const fetchRunningTimers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await taskTimeLogsApiService.getRunningTimers();

      if (response && response.done) {
        const timers = Array.isArray(response.body) ? response.body : [];
        setRunningTimers(timers);
      } else {
        logError('Invalid response from getRunningTimers API');
        setRunningTimers([]);
      }
    } catch (error) {
      logError('Error fetching running timers', error);
      setRunningTimers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const updateCurrentTimes = useCallback(() => {
    try {
      if (!Array.isArray(runningTimers) || runningTimers.length === 0) return;

      const newTimes: Record<string, string> = {};
      runningTimers.forEach(timer => {
        try {
          if (!timer || !timer.task_id || !timer.start_time) return;

          const startTime = parseISO(timer.start_time);
          if (!isValid(startTime)) {
            logError(`Invalid start time for timer ${timer.task_id}: ${timer.start_time}`);
            return;
          }

          const now = new Date();
          const totalSeconds = differenceInSeconds(now, startTime);
          const hours = Math.floor(totalSeconds / 3600);
          const minutes = Math.floor((totalSeconds % 3600) / 60);
          const seconds = totalSeconds % 60;
          newTimes[timer.task_id] =
            `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        } catch (error) {
          logError(`Error updating time for timer ${timer?.task_id}`, error);
        }
      });
      setCurrentTimes(newTimes);
    } catch (error) {
      logError('Error in updateCurrentTimes', error);
    }
  }, [runningTimers]);

  useEffect(() => {
    fetchRunningTimers();

    // Removed periodic polling - rely on socket events for real-time updates
  }, [fetchRunningTimers]);

  useEffect(() => {
    if (runningTimers.length > 0) {
      updateCurrentTimes();
      const interval = setInterval(updateCurrentTimes, 1000);
      return () => clearInterval(interval);
    }
  }, [runningTimers, updateCurrentTimes]);

  // Listen for timer start/stop events and project updates to refresh the count
  useEffect(() => {
    if (!socket) {
      logError('Socket not available');
      return;
    }

    const handleTimerStart = (data: string) => {
      try {
        const parsed = typeof data === 'string' ? JSON.parse(data) : data;
        const { id } = parsed || {};
        if (id) {
          // Refresh the running timers list when a new timer is started
          fetchRunningTimers();
        }
      } catch (error) {
        logError('Error parsing timer start event', error);
      }
    };

    const handleTimerStop = (data: string) => {
      try {
        const parsed = typeof data === 'string' ? JSON.parse(data) : data;
        const { id } = parsed || {};
        if (id) {
          // Refresh the running timers list when a timer is stopped
          fetchRunningTimers();
        }
      } catch (error) {
        logError('Error parsing timer stop event', error);
      }
    };

    const handleProjectUpdates = () => {
      try {
        // Refresh timers when project updates are available
        fetchRunningTimers();
      } catch (error) {
        logError('Error handling project updates', error);
      }
    };

    try {
      socket.on(SocketEvents.TASK_TIMER_START.toString(), handleTimerStart);
      socket.on(SocketEvents.TASK_TIMER_STOP.toString(), handleTimerStop);
      socket.on(SocketEvents.PROJECT_UPDATES_AVAILABLE.toString(), handleProjectUpdates);

      return () => {
        try {
          socket.off(SocketEvents.TASK_TIMER_START.toString(), handleTimerStart);
          socket.off(SocketEvents.TASK_TIMER_STOP.toString(), handleTimerStop);
          socket.off(SocketEvents.PROJECT_UPDATES_AVAILABLE.toString(), handleProjectUpdates);
        } catch (error) {
          logError('Error cleaning up socket listeners', error);
        }
      };
    } catch (error) {
      logError('Error setting up socket listeners', error);
    }
  }, [socket, fetchRunningTimers]);

  const hasRunningTimers = () => {
    return Array.isArray(runningTimers) && runningTimers.length > 0;
  };

  const timerCount = () => {
    return Array.isArray(runningTimers) ? runningTimers.length : 0;
  };

  const handleStopTimer = (taskId: string) => {
    if (!socket) {
      logError('Socket not available for stopping timer');
      return;
    }

    if (!taskId) {
      logError('Invalid task ID for stopping timer');
      return;
    }

    try {
      socket.emit(SocketEvents.TASK_TIMER_STOP.toString(), JSON.stringify({ task_id: taskId }));
      dispatch(updateTaskTimeTracking({ taskId, timeTracking: null }));
    } catch (error) {
      logError(`Error stopping timer for task ${taskId}`, error);
    }
  };

  const renderDropdownContent = () => {
    try {
      if (error) {
        return (
          <div style={{ padding: 16, textAlign: 'center', width: 350 }}>
            <Text type="danger">Error loading timers</Text>
          </div>
        );
      }

      return (
        <div
          style={{
            width: 350,
            maxHeight: 400,
            overflow: 'auto',
            backgroundColor: token.colorBgElevated,
            borderRadius: token.borderRadius,
            boxShadow: token.boxShadowSecondary,
            border: `1px solid ${token.colorBorderSecondary}`,
          }}
        >
          {!Array.isArray(runningTimers) || runningTimers.length === 0 ? (
            <div style={{ padding: 16, textAlign: 'center' }}>
              <Text type="secondary">No running timers</Text>
            </div>
          ) : (
            <List
              dataSource={runningTimers}
              renderItem={timer => {
                if (!timer || !timer.task_id) return null;

                return (
                  <List.Item
                    style={{
                      padding: '12px 16px',
                      borderBottom: `1px solid ${token.colorBorderSecondary}`,
                      backgroundColor: 'transparent',
                    }}
                  >
                    <div style={{ width: '100%' }}>
                      <Space direction="vertical" size={4} style={{ width: '100%' }}>
                        <Text strong style={{ fontSize: 14, color: token.colorText }}>
                          {timer.task_name || 'Unnamed Task'}
                        </Text>
                        <div
                          style={{
                            display: 'inline-block',
                            backgroundColor: token.colorPrimaryBg,
                            color: token.colorPrimary,
                            padding: '2px 8px',
                            borderRadius: token.borderRadiusSM,
                            fontSize: 11,
                            fontWeight: 500,
                            marginTop: 2,
                          }}
                        >
                          {timer.project_name || 'Unnamed Project'}
                        </div>
                        {timer.parent_task_name && (
                          <Text type="secondary" style={{ fontSize: 11 }}>
                            Parent: {timer.parent_task_name}
                          </Text>
                        )}
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                          }}
                        >
                          <div style={{ flex: 1 }}>
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                marginBottom: 4,
                              }}
                            >
                              <Text type="secondary" style={{ fontSize: 11 }}>
                                Started:{' '}
                                {timer.start_time
                                  ? format(parseISO(timer.start_time), 'HH:mm')
                                  : '--:--'}
                              </Text>
                              <Text
                                strong
                                style={{
                                  fontSize: 14,
                                  color: token.colorPrimary,
                                  fontFamily: 'monospace',
                                }}
                              >
                                {currentTimes[timer.task_id] || '00:00:00'}
                              </Text>
                            </div>
                          </div>
                          <Button
                            size="small"
                            icon={<StopOutlined />}
                            onClick={e => {
                              e.stopPropagation();
                              handleStopTimer(timer.task_id);
                            }}
                            style={{
                              backgroundColor: token.colorErrorBg,
                              borderColor: token.colorError,
                              color: token.colorError,
                              fontWeight: 500,
                            }}
                          >
                            Stop
                          </Button>
                        </div>
                      </Space>
                    </div>
                  </List.Item>
                );
              }}
            />
          )}
          {hasRunningTimers() && (
            <>
              <Divider style={{ margin: 0, borderColor: token.colorBorderSecondary }} />
              <div
                style={{
                  padding: '8px 16px',
                  textAlign: 'center',
                  backgroundColor: token.colorFillQuaternary,
                  borderBottomLeftRadius: token.borderRadius,
                  borderBottomRightRadius: token.borderRadius,
                }}
              >
                <Text type="secondary" style={{ fontSize: 11 }}>
                  {timerCount()} timer{timerCount() !== 1 ? 's' : ''} running
                </Text>
              </div>
            </>
          )}
        </div>
      );
    } catch (error) {
      logError('Error rendering dropdown content', error);
      return (
        <div style={{ padding: 16, textAlign: 'center', width: 350 }}>
          <Text type="danger">Error rendering timers</Text>
        </div>
      );
    }
  };

  const handleDropdownOpenChange = (open: boolean) => {
    try {
      setDropdownOpen(open);
      if (open) {
        fetchRunningTimers();
      }
    } catch (error) {
      logError('Error handling dropdown open change', error);
    }
  };

  try {
    return (
      <Dropdown
        popupRender={() => renderDropdownContent()}
        trigger={['click']}
        placement="bottomRight"
        open={dropdownOpen}
        onOpenChange={handleDropdownOpenChange}
      >
        <Tooltip title="Running Timers">
          <Button
            style={{ height: '62px', width: '60px' }}
            type="text"
            icon={
              hasRunningTimers() ? (
                <Badge count={timerCount()}>
                  <ClockCircleOutlined style={{ fontSize: 20 }} />
                </Badge>
              ) : (
                <ClockCircleOutlined style={{ fontSize: 20 }} />
              )
            }
            loading={loading}
          />
        </Tooltip>
      </Dropdown>
    );
  } catch (error) {
    logError('Error rendering TimerButton', error);
    return (
      <Tooltip title="Timer Error">
        <Button
          style={{ height: '62px', width: '60px' }}
          type="text"
          icon={<ClockCircleOutlined style={{ fontSize: 20 }} />}
          disabled
        />
      </Tooltip>
    );
  }
};

export default TimerButton;
