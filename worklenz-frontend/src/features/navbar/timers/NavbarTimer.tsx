import React, { useState, useEffect, useCallback } from 'react';
import { Button, Typography } from '@/shared/antd-imports';
import { PlayCircleFilled } from '@/shared/antd-imports';
import { colors } from '@/styles/colors';
import { useSocket } from '@/socket/socketContext';
import { SocketEvents } from '@/shared/socket-events';
import { taskTimeLogsApiService } from '@/api/tasks/task-time-logs.api.service';
import { Modal } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';

interface NavbarTimerProps {
  taskId: string;
  isRunning: boolean;
  startTime?: string;
  onTimerChange?: () => void; // Callback to refresh parent data
}

const NavbarTimer: React.FC<NavbarTimerProps> = ({
  taskId,
  isRunning,
  startTime,
  onTimerChange,
}) => {
  const [timeString, setTimeString] = useState('0m 0s');
  const [localRunning, setLocalRunning] = useState(isRunning);
  const { socket } = useSocket();
  const { t } = useTranslation('navbar');

  // Calculate elapsed time
  const calculateElapsedTime = useCallback(() => {
    if (!localRunning || !startTime) {
      setTimeString('0m 0s');
      return;
    }

    const start = new Date(startTime).getTime();
    const now = Date.now();
    const diff = Math.floor((now - start) / 1000);

    const hours = Math.floor(diff / 3600);
    const minutes = Math.floor((diff % 3600) / 60);
    const seconds = diff % 60;

    if (hours > 0) {
      setTimeString(`${hours}h ${minutes}m ${seconds}s`);
    } else {
      setTimeString(`${minutes}m ${seconds}s`);
    }
  }, [localRunning, startTime]);

  // Update timer every second
  useEffect(() => {
    if (!localRunning) {
      setTimeString('0m 0s');
      return;
    }

    calculateElapsedTime();
    const interval = setInterval(calculateElapsedTime, 1000);
    return () => clearInterval(interval);
  }, [localRunning, calculateElapsedTime]);

  // Sync with props
  useEffect(() => {
    setLocalRunning(isRunning);
  }, [isRunning]);

  const handleStartTimer = async () => {
    try {
      // Check for conflicting timers
      const response = await taskTimeLogsApiService.getRunningTimers();
      const runningTimers = response.body || [];
      const conflictingTimer = runningTimers.find(timer => timer.task_id !== taskId);

      if (conflictingTimer) {
        Modal.confirm({
          title: 'Timer Conflict',
          content: `Another timer is running for "${conflictingTimer.task_name}" in project "${conflictingTimer.project_name}". Do you want to stop it and start this timer?`,
          okText: 'Stop and Start',
          cancelText: 'Cancel',
          onOk: () => {
            // Stop conflicting timer
            socket?.emit(
              SocketEvents.TASK_TIMER_STOP.toString(),
              JSON.stringify({ task_id: conflictingTimer.task_id })
            );

            // Start new timer
            setTimeout(() => {
              socket?.emit(
                SocketEvents.TASK_TIMER_START.toString(),
                JSON.stringify({ task_id: taskId })
              );
              setLocalRunning(true);
              onTimerChange?.();
            }, 100);
          },
        });
      } else {
        // No conflict, start timer directly
        socket?.emit(SocketEvents.TASK_TIMER_START.toString(), JSON.stringify({ task_id: taskId }));
        setLocalRunning(true);
        onTimerChange?.();
      }
    } catch (error) {
      console.error('Error starting timer:', error);
    }
  };

  const handleStopTimer = () => {
    socket?.emit(SocketEvents.TASK_TIMER_STOP.toString(), JSON.stringify({ task_id: taskId }));
    setLocalRunning(false);
    onTimerChange?.();
  };

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

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      {localRunning ? (
        <Button type="text" icon={renderStopIcon()} onClick={handleStopTimer} />
      ) : (
        <Button
          type="text"
          icon={<PlayCircleFilled style={{ color: colors.skyBlue, fontSize: 16 }} />}
          onClick={handleStartTimer}
        />
      )}
      <Typography.Text style={{ cursor: 'pointer', fontFamily: 'monospace' }}>
        {timeString}
      </Typography.Text>
    </div>
  );
};

export default NavbarTimer;
