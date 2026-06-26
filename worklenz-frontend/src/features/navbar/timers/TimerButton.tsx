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
import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  taskTimeLogsApiService,
  IRunningTimer,
  IRecentTimeLog,
} from '@/api/tasks/task-time-logs.api.service';
import { useSocket } from '@/socket/socketContext';
import { SocketEvents } from '@/shared/socket-events';
import { format, parseISO, formatDistanceToNow } from 'date-fns';
import NavbarTimer from './NavbarTimer';

const { Text } = Typography;
const { useToken } = theme;

const TimerButton = () => {
  const [runningTimers, setRunningTimers] = useState<IRunningTimer[]>([]);
  const [recentTimeLogs, setRecentTimeLogs] = useState<IRecentTimeLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { t } = useTranslation('navbar');
  const { token } = useToken();
  const { socket, connected } = useSocket();

  const logError = (message: string, error?: any) => {
    // Production-safe error logging
    console.error(`[TimerButton] ${message}`, error);
    setError(message);
  };

  const fetchTimerData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [timersResponse, recentLogsResponse] = await Promise.all([
        taskTimeLogsApiService.getRunningTimers(),
        taskTimeLogsApiService.getRecentTimeLogs(),
      ]);

      if (timersResponse && timersResponse.done) {
        const timers = Array.isArray(timersResponse.body) ? timersResponse.body : [];
        setRunningTimers(timers);
      } else {
        logError('Invalid response from getRunningTimers API');
        setRunningTimers([]);
      }

      if (recentLogsResponse && recentLogsResponse.done) {
        const logs = Array.isArray(recentLogsResponse.body) ? recentLogsResponse.body : [];
        setRecentTimeLogs(logs);
      } else {
        setRecentTimeLogs([]);
      }
    } catch (error) {
      logError('Error fetching timer data', error);
      setRunningTimers([]);
      setRecentTimeLogs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTimerData();

    // If socket is not available, fall back to periodic polling
    if (!socket) {
      const pollInterval = setInterval(() => {
        fetchTimerData();
      }, 30000); // Poll every 30 seconds as fallback

      return () => clearInterval(pollInterval);
    }
  }, [fetchTimerData, socket]);

  // Listen for timer start/stop events and project updates to refresh the count
  useEffect(() => {
    if (!socket || !connected) {
      // Socket not available or not connected yet - this is expected during initial load
      // Timer will work via polling, real-time updates will be available once socket connects
      return;
    }

    const handleTimerStart = (data: string) => {
      try {
        const parsed = typeof data === 'string' ? JSON.parse(data) : data;
        const { id } = parsed || {};
        if (id) {
          // Refresh both running timers and recent logs when a new timer is started
          fetchTimerData();
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
          // Refresh both running timers and recent logs when a timer is stopped
          fetchTimerData();
        }
      } catch (error) {
        logError('Error parsing timer stop event', error);
      }
    };

    const handleProjectUpdates = () => {
      try {
        // Refresh timers and recent logs when project updates are available
        fetchTimerData();
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
  }, [socket, connected, fetchTimerData]);

  const hasRunningTimers = () => {
    return Array.isArray(runningTimers) && runningTimers.length > 0;
  };

  const timerCount = () => {
    return Array.isArray(runningTimers) ? runningTimers.length : 0;
  };

  // Helper function to format time spent in seconds
  const formatTimeSpent = (seconds: number | undefined): string => {
    if (!seconds || seconds === 0) return '0m 0s';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    const h = hours > 0 ? `${hours}h` : '';
    const m = `${minutes}m`;
    const s = `${secs}s`;
    return `${h} ${m} ${s}`.trim();
  };

  // Timer icon component (Lucide-style)
  const TimerIcon = ({ size = 20, style = {} }: { size?: number; style?: React.CSSProperties }) => {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={style}
      >
        <line x1="10" x2="14" y1="2" y2="2" />
        <line x1="12" x2="15" y1="14" y2="11" />
        <circle cx="12" cy="14" r="8" />
      </svg>
    );
  };

  const renderDropdownContent = () => {
    try {
      if (error) {
        return (
          <div style={{ padding: 16, textAlign: 'center', width: 350 }}>
            <Text type="danger">{t('timerButton.errorLoadingTimers')}</Text>
          </div>
        );
      }

      const hasRunning = Array.isArray(runningTimers) && runningTimers.length > 0;
      const hasRecent = Array.isArray(recentTimeLogs) && recentTimeLogs.length > 0;

      return (
        <div
          style={{
            width: 350,
            maxHeight: 500,
            overflow: 'auto',
            backgroundColor: token.colorBgElevated,
            borderRadius: token.borderRadius,
            boxShadow: token.boxShadowSecondary,
            border: `1px solid ${token.colorBorderSecondary}`,
          }}
        >
          {/* Running Timers Section */}
          {hasRunning && (
            <>
              <div
                style={{
                  padding: '8px 16px',
                  backgroundColor: token.colorFillQuaternary,
                  borderBottom: `1px solid ${token.colorBorderSecondary}`,
                }}
              >
                <Text strong style={{ fontSize: 12, color: token.colorTextSecondary }}>
                  {t('timerButton.runningTimers').toUpperCase()}
                </Text>
              </div>
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
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              gap: 8,
                              width: '100%',
                            }}
                          >
                            <Text
                              strong
                              style={{
                                fontSize: 14,
                                color: token.colorText,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                flex: 1,
                                minWidth: 0,
                              }}
                              title={timer.task_name || t('timerButton.unnamedTask')}
                            >
                              {timer.task_name || t('timerButton.unnamedTask')}
                            </Text>
                            <Text
                              style={{
                                fontSize: 11,
                                fontWeight: 500,
                                color: token.colorTextSecondary,
                                backgroundColor: token.colorFillQuaternary,
                                padding: '2px 8px',
                                borderRadius: token.borderRadiusSM,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                maxWidth: '40%',
                                flexShrink: 0,
                              }}
                              title={timer.project_name || t('timerButton.unnamedProject')}
                            >
                              {timer.project_name || t('timerButton.unnamedProject')}
                            </Text>
                          </div>
                          {timer.parent_task_name && (
                            <Text type="secondary" style={{ fontSize: 11 }}>
                              {t('timerButton.parent')}: {timer.parent_task_name}
                            </Text>
                          )}
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                            }}
                          >
                            <Text type="secondary" style={{ fontSize: 11 }}>
                              {t('timerButton.started')}:{' '}
                              {timer.start_time
                                ? format(parseISO(timer.start_time), 'HH:mm')
                                : '--:--'}
                            </Text>
                            <NavbarTimer
                              taskId={timer.task_id}
                              isRunning={true}
                              startTime={timer.start_time}
                              onTimerChange={fetchTimerData}
                            />
                          </div>
                        </Space>
                      </div>
                    </List.Item>
                  );
                }}
              />
            </>
          )}

          {/* Recent Time Logs Section */}
          {hasRecent && (
            <>
              {hasRunning && (
                <Divider style={{ margin: 0, borderColor: token.colorBorderSecondary }} />
              )}
              <div
                style={{
                  padding: '8px 16px',
                  backgroundColor: token.colorFillQuaternary,
                  borderBottom: `1px solid ${token.colorBorderSecondary}`,
                }}
              >
                <Text strong style={{ fontSize: 12, color: token.colorTextSecondary }}>
                  {t('timerButton.recentTimeLogs').toUpperCase()}
                </Text>
              </div>
              <List
                dataSource={recentTimeLogs}
                renderItem={log => {
                  if (!log || !log.task_id) return null;

                  const [isHovered, setIsHovered] = useState(false);

                  return (
                    <List.Item
                      style={{
                        padding: '12px 16px',
                        borderBottom: `1px solid ${token.colorBorderSecondary}`,
                        backgroundColor: 'transparent',
                      }}
                      onMouseEnter={() => setIsHovered(true)}
                      onMouseLeave={() => setIsHovered(false)}
                    >
                      <div style={{ width: '100%' }}>
                        <Space direction="vertical" size={4} style={{ width: '100%' }}>
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              gap: 8,
                              width: '100%',
                            }}
                          >
                            <Text
                              strong
                              style={{
                                fontSize: 14,
                                color: token.colorText,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                flex: 1,
                                minWidth: 0,
                              }}
                              title={log.task_name || t('timerButton.unnamedTask')}
                            >
                              {log.task_name || t('timerButton.unnamedTask')}
                            </Text>
                            <Text
                              style={{
                                fontSize: 11,
                                fontWeight: 500,
                                color: token.colorTextSecondary,
                                backgroundColor: token.colorFillQuaternary,
                                padding: '2px 8px',
                                borderRadius: token.borderRadiusSM,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                maxWidth: '40%',
                                flexShrink: 0,
                              }}
                              title={log.project_name || t('timerButton.unnamedProject')}
                            >
                              {log.project_name || t('timerButton.unnamedProject')}
                            </Text>
                          </div>
                          {log.parent_task_name && (
                            <Text type="secondary" style={{ fontSize: 11 }}>
                              {t('timerButton.parent')}: {log.parent_task_name}
                            </Text>
                          )}
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              marginTop: 4,
                            }}
                          >
                            <Text type="secondary" style={{ fontSize: 11 }}>
                              {formatDistanceToNow(parseISO(log.created_at), { addSuffix: true })}
                            </Text>
                            {isHovered ? (
                              <NavbarTimer
                                taskId={log.task_id}
                                isRunning={runningTimers.some(
                                  timer => timer.task_id === log.task_id
                                )}
                                startTime={
                                  runningTimers.find(timer => timer.task_id === log.task_id)
                                    ?.start_time
                                }
                                onTimerChange={fetchTimerData}
                              />
                            ) : (
                              <Text
                                style={{
                                  fontSize: 13,
                                  fontWeight: 500,
                                  color: token.colorTextSecondary,
                                  fontFamily: 'monospace',
                                }}
                              >
                                {formatTimeSpent(log.time_spent)}
                              </Text>
                            )}
                          </div>
                        </Space>
                      </div>
                    </List.Item>
                  );
                }}
              />
            </>
          )}

          {/* Empty State */}
          {!hasRunning && !hasRecent && (
            <div style={{ padding: 16, textAlign: 'center' }}>
              <Text type="secondary">{t('timerButton.noTimersOrLogs')}</Text>
            </div>
          )}

          {/* Footer Summary */}
          {(hasRunning || hasRecent) && (
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
                  {hasRunning && t('timerButton.timerRunning', { count: timerCount() })}
                  {hasRunning && hasRecent && ' • '}
                  {hasRecent && t('timerButton.recentLog', { count: recentTimeLogs.length })}
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
          <Text type="danger">{t('timerButton.errorRenderingTimers')}</Text>
        </div>
      );
    }
  };

  const handleDropdownOpenChange = (open: boolean) => {
    try {
      setDropdownOpen(open);
      if (open) {
        fetchTimerData();
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
        <Tooltip title={t('timerButton.runningTimers')}>
          <Button
            style={{ height: '62px', width: '60px' }}
            type="text"
            icon={
              hasRunningTimers() ? (
                <Badge count={timerCount()}>
                  <TimerIcon size={22} />
                </Badge>
              ) : (
                <TimerIcon size={22} />
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
      <Tooltip title={t('timerButton.timerError')}>
        <Button
          style={{ height: '62px', width: '60px' }}
          type="text"
          icon={<TimerIcon size={24} />}
          disabled
        />
      </Tooltip>
    );
  }
};

export default TimerButton;
