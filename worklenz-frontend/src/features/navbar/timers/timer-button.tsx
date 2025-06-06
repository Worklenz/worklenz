import { ClockCircleOutlined, StopOutlined } from '@ant-design/icons';
import { Badge, Button, Dropdown, List, Tooltip, Typography, Space, Divider, theme } from 'antd';
import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { taskTimeLogsApiService, IRunningTimer } from '@/api/tasks/task-time-logs.api.service';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useSocket } from '@/socket/socketContext';
import { SocketEvents } from '@/shared/socket-events';
import { updateTaskTimeTracking } from '@/features/tasks/tasks.slice';
import moment from 'moment';

const { Text } = Typography;
const { useToken } = theme;

const TimerButton = () => {
  const [runningTimers, setRunningTimers] = useState<IRunningTimer[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentTimes, setCurrentTimes] = useState<Record<string, string>>({});
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const { t } = useTranslation('navbar');
  const { token } = useToken();
  const dispatch = useAppDispatch();
  const { socket } = useSocket();

  const fetchRunningTimers = useCallback(async () => {
    try {
      setLoading(true);
      const response = await taskTimeLogsApiService.getRunningTimers();
      if (response.done) {
        setRunningTimers(response.body || []);
      }
    } catch (error) {
      console.error('Error fetching running timers:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const updateCurrentTimes = () => {
    const newTimes: Record<string, string> = {};
    runningTimers.forEach(timer => {
      const startTime = moment(timer.start_time);
      const now = moment();
      const duration = moment.duration(now.diff(startTime));
      const hours = Math.floor(duration.asHours());
      const minutes = duration.minutes();
      const seconds = duration.seconds();
      newTimes[timer.task_id] = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    });
    setCurrentTimes(newTimes);
  };

  useEffect(() => {
    fetchRunningTimers();
    
    // Set up polling to refresh timers every 30 seconds
    const pollInterval = setInterval(() => {
      fetchRunningTimers();
    }, 30000);
    
    return () => clearInterval(pollInterval);
  }, [fetchRunningTimers]);

  useEffect(() => {
    if (runningTimers.length > 0) {
      updateCurrentTimes();
      const interval = setInterval(updateCurrentTimes, 1000);
      return () => clearInterval(interval);
    }
  }, [runningTimers]);

  // Listen for timer start/stop events and project updates to refresh the count
  useEffect(() => {
    if (!socket) return;

    const handleTimerStart = (data: string) => {
      try {
        const { id } = typeof data === 'string' ? JSON.parse(data) : data;
        if (id) {
          // Refresh the running timers list when a new timer is started
          fetchRunningTimers();
        }
      } catch (error) {
        console.error('Error parsing timer start event:', error);
      }
    };

    const handleTimerStop = (data: string) => {
      try {
        const { id } = typeof data === 'string' ? JSON.parse(data) : data;
        if (id) {
          // Refresh the running timers list when a timer is stopped
          fetchRunningTimers();
        }
      } catch (error) {
        console.error('Error parsing timer stop event:', error);
      }
    };

    const handleProjectUpdates = () => {
      // Refresh timers when project updates are available
      fetchRunningTimers();
    };

    socket.on(SocketEvents.TASK_TIMER_START.toString(), handleTimerStart);
    socket.on(SocketEvents.TASK_TIMER_STOP.toString(), handleTimerStop);
    socket.on(SocketEvents.PROJECT_UPDATES_AVAILABLE.toString(), handleProjectUpdates);

    return () => {
      socket.off(SocketEvents.TASK_TIMER_START.toString(), handleTimerStart);
      socket.off(SocketEvents.TASK_TIMER_STOP.toString(), handleTimerStop);
      socket.off(SocketEvents.PROJECT_UPDATES_AVAILABLE.toString(), handleProjectUpdates);
    };
  }, [socket, fetchRunningTimers]);

  const hasRunningTimers = () => {
    return runningTimers.length > 0;
  };

  const timerCount = () => {
    return runningTimers.length;
  };

  const handleStopTimer = (taskId: string) => {
    if (!socket) return;
    
    socket.emit(SocketEvents.TASK_TIMER_STOP.toString(), JSON.stringify({ task_id: taskId }));
    dispatch(updateTaskTimeTracking({ taskId, timeTracking: null }));
  };

  const dropdownContent = (
    <div 
      style={{ 
        width: 350, 
        maxHeight: 400, 
        overflow: 'auto',
        backgroundColor: token.colorBgElevated,
        borderRadius: token.borderRadius,
        boxShadow: token.boxShadowSecondary,
        border: `1px solid ${token.colorBorderSecondary}`
      }}
    >
      {runningTimers.length === 0 ? (
        <div style={{ padding: 16, textAlign: 'center' }}>
          <Text type="secondary">No running timers</Text>
        </div>
      ) : (
        <List
          dataSource={runningTimers}
          renderItem={(timer) => (
            <List.Item 
              style={{ 
                padding: '12px 16px',
                borderBottom: `1px solid ${token.colorBorderSecondary}`,
                backgroundColor: 'transparent'
              }}
            >
              <div style={{ width: '100%' }}>
                <Space direction="vertical" size={4} style={{ width: '100%' }}>
                  <Text strong style={{ fontSize: 14, color: token.colorText }}>
                    {timer.task_name}
                  </Text>
                  <div style={{ 
                    display: 'inline-block',
                    backgroundColor: token.colorPrimaryBg,
                    color: token.colorPrimary,
                    padding: '2px 8px',
                    borderRadius: token.borderRadiusSM,
                    fontSize: 11,
                    fontWeight: 500,
                    marginTop: 2
                  }}>
                    {timer.project_name}
                  </div>
                  {timer.parent_task_name && (
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      Parent: {timer.parent_task_name}
                    </Text>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <Text type="secondary" style={{ fontSize: 11 }}>
                          Started: {moment(timer.start_time).format('HH:mm')}
                        </Text>
                        <Text 
                          strong 
                          style={{ 
                            fontSize: 14, 
                            color: token.colorPrimary,
                            fontFamily: 'monospace'
                          }}
                        >
                          {currentTimes[timer.task_id] || '00:00:00'}
                        </Text>
                      </div>
                    </div>
                    <Button
                      size="small"
                      icon={<StopOutlined />}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStopTimer(timer.task_id);
                      }}
                      style={{
                        backgroundColor: token.colorErrorBg,
                        borderColor: token.colorError,
                        color: token.colorError,
                        fontWeight: 500
                      }}
                    >
                      Stop
                    </Button>
                  </div>
                </Space>
              </div>
            </List.Item>
          )}
        />
      )}
      {runningTimers.length > 0 && (
        <>
          <Divider style={{ margin: 0, borderColor: token.colorBorderSecondary }} />
          <div 
            style={{ 
              padding: '8px 16px', 
              textAlign: 'center', 
              backgroundColor: token.colorFillQuaternary,
              borderBottomLeftRadius: token.borderRadius,
              borderBottomRightRadius: token.borderRadius
            }}
          >
            <Text type="secondary" style={{ fontSize: 11 }}>
              {runningTimers.length} timer{runningTimers.length !== 1 ? 's' : ''} running
            </Text>
          </div>
        </>
      )}
    </div>
  );

  return (
    <Dropdown
      popupRender={() => dropdownContent}
      trigger={['click']}
      placement="bottomRight"
      open={dropdownOpen}
      onOpenChange={(open) => {
        setDropdownOpen(open);
        if (open) {
          fetchRunningTimers();
        }
      }}
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
};

export default TimerButton; 