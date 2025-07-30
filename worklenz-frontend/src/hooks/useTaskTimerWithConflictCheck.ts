import { useState, useEffect, useCallback } from 'react';
import { Modal } from 'antd';
import { useTranslation } from 'react-i18next';
import { useSocket } from '@/socket/socketContext';
import { SocketEvents } from '@/shared/socket-events';
import { taskTimeLogsApiService } from '@/api/tasks/task-time-logs.api.service';
import { useTaskTimer } from './useTaskTimer';

interface ConflictingTimer {
  task_id: string;
  task_name: string;
  project_name: string;
}

export const useTaskTimerWithConflictCheck = (taskId: string, timerStartTime: string | null) => {
  const { socket } = useSocket();
  const { t: tTable } = useTranslation('task-list-table');
  const { t: tCommon } = useTranslation('common');

  // Ensure timerStartTime is a number or null, as required by useTaskTimer
  const parsedTimerStartTime = typeof timerStartTime === 'string' && timerStartTime !== null
    ? Number(timerStartTime)
    : timerStartTime;

  const originalHook = useTaskTimer(taskId, parsedTimerStartTime as number | null);
  const [isCheckingConflict, setIsCheckingConflict] = useState(false);

  const checkForConflictingTimers = useCallback(async () => {
    try {
      const response = await taskTimeLogsApiService.getRunningTimers();
      const runningTimers = response.body || [];
      
      // Find conflicting timer (running timer for a different task)
      const conflictingTimer = runningTimers.find((timer: ConflictingTimer) => 
        timer.task_id !== taskId
      );
      
      return conflictingTimer;
    } catch (error) {
      console.error('Error checking for conflicting timers:', error);
      return null;
    }
  }, [taskId]);

  const handleStartTimerWithConflictCheck = useCallback(async () => {
    if (isCheckingConflict) return;
    
    setIsCheckingConflict(true);
    
    try {
      const conflictingTimer = await checkForConflictingTimers();
      
      if (conflictingTimer) {
        Modal.confirm({
          title: tTable('timer.conflictTitle'),
          content: tTable('timer.conflictMessage', { 
            taskName: conflictingTimer.task_name,
            projectName: conflictingTimer.project_name 
          }),
          okText: tTable('timer.stopAndStart'),
          cancelText: tCommon('cancel'),
          onOk: () => {
            // Stop the conflicting timer
            if (socket) {
              socket.emit(SocketEvents.TASK_TIMER_STOP.toString(), JSON.stringify({ 
                task_id: conflictingTimer.task_id 
              }));
            }
            
            // Start the new timer after a short delay
            setTimeout(() => {
              originalHook.handleStartTimer();
            }, 100);
          },
        });
      } else {
        // No conflict, start timer directly
        originalHook.handleStartTimer();
      }
    } catch (error) {
      console.error('Error handling timer start with conflict check:', error);
      // Fallback to original behavior
      originalHook.handleStartTimer();
    } finally {
      setIsCheckingConflict(false);
    }
  }, [isCheckingConflict, checkForConflictingTimers, tTable, tCommon, socket, originalHook]);

  return {
    ...originalHook,
    handleStartTimer: handleStartTimerWithConflictCheck,
    isCheckingConflict,
  };
};