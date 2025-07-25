import { useState, useEffect, useCallback, useRef } from 'react';
import { Modal } from 'antd';
import { useTranslation } from 'react-i18next';
import { buildTimeString } from '@/utils/timeUtils';
import { useSocket } from '@/socket/socketContext';
import { SocketEvents } from '@/shared/socket-events';
import logger from '@/utils/errorLogger';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { updateTaskTimeTracking, syncActiveTimersFromTaskData } from '@/features/tasks/tasks.slice';
import { useAppSelector } from '@/hooks/useAppSelector';

export const useTaskTimer = (taskId: string, initialStartTime: number | null) => {
  const dispatch = useAppDispatch();
  const { socket } = useSocket();
  const { t } = useTranslation('common');
  const DEFAULT_TIME_LEFT = buildTimeString(0, 0, 0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const hasInitialized = useRef(false); // Track if we've initialized

  const activeTimers = useAppSelector(state => state.taskReducer.activeTimers);
  const taskGroups = useAppSelector(state => state.taskReducer.taskGroups);
  const currentUser = useAppSelector(state => state.userReducer);
  const reduxStartTime = activeTimers[taskId]?.startTime || null;
  const started = Boolean(reduxStartTime);

  const [timeString, setTimeString] = useState(DEFAULT_TIME_LEFT);
  const [localStarted, setLocalStarted] = useState(false);

  // Utility function to find task by ID and get its name
  const getTaskName = useCallback((searchTaskId: string): string => {
    for (const group of taskGroups) {
      // Check main tasks
      const task = group.tasks.find(t => t.id === searchTaskId);
      if (task) {
        return task.name || 'Unknown Task';
      }

      // Check subtasks
      for (const task of group.tasks) {
        if (task.sub_tasks) {
          const subTask = task.sub_tasks.find(subtask => subtask.id === searchTaskId);
          if (subTask) {
            return subTask.name || 'Unknown Task';
          }
        }
      }
    }
    return 'Unknown Task';
  }, [taskGroups]);

  // Check for active timer for the current user (should only allow one running timer)
  const getActiveTimerInfo = useCallback(() => {
    // Debug: Log current user and active timers
    console.log('Checking timer conflict for user:', currentUser.id);
    console.log('Active timers:', activeTimers);
    
    // Check activeTimers for any timer belonging to the current user (except current task)
    for (const [timerTaskId, timerInfo] of Object.entries(activeTimers)) {
      console.log(`Checking timer ${timerTaskId}:`, timerInfo);
      if (timerInfo && timerInfo.userId === currentUser.id && timerTaskId !== taskId) {
        console.log(`Found conflict: timer ${timerTaskId} belongs to current user ${currentUser.id}`);
        // Find the task name
        const taskName = getTaskName(timerTaskId);
        return { taskId: timerTaskId, taskName };
      }
    }
    console.log('No conflict found for user:', currentUser.id);
    return null;
  }, [activeTimers, currentUser.id, taskId, getTaskName]);

  // start a timer with conflict check
  const startTimerWithConflictCheck = useCallback(() => {
    const activeTimerInfo = getActiveTimerInfo();
    
    if (activeTimerInfo) {
      // Show confirmation dialog - user already has a timer running
      Modal.confirm({
        title: t('timer.conflictTitle'),
        content: t('timer.conflictMessage', { taskName: activeTimerInfo.taskName }),
        okText: t('timer.stopAndStartNew'),
        cancelText: t('timer.cancel'),
        okType: 'primary',
        onOk: () => {
          // Stop the current timer first
          dispatch(updateTaskTimeTracking({ taskId: activeTimerInfo.taskId, timeTracking: null }));
          socket?.emit(SocketEvents.TASK_TIMER_STOP.toString(), JSON.stringify({ task_id: activeTimerInfo.taskId }));
          
          // Then start the new timer
          const now = Date.now();
          dispatch(updateTaskTimeTracking({ taskId, timeTracking: now, userId: currentUser.id }));
          setLocalStarted(true);
          socket?.emit(SocketEvents.TASK_TIMER_START.toString(), JSON.stringify({ task_id: taskId }));
        },
        onCancel: () => {
          // Do nothing, keep the current timer running
        },
      });
    } else {
      // No conflict, start timer normally
      const now = Date.now();
      dispatch(updateTaskTimeTracking({ taskId, timeTracking: now, userId: currentUser.id }));
      setLocalStarted(true);
      socket?.emit(SocketEvents.TASK_TIMER_START.toString(), JSON.stringify({ task_id: taskId }));
    }
  }, [getActiveTimerInfo, taskId, dispatch, socket, t, currentUser.id]);

  const timerTick = useCallback(() => {
    if (!reduxStartTime) return;
    const now = Date.now();
    const diff = Math.floor((now - reduxStartTime) / 1000);
    const hours = Math.floor(diff / 3600);
    const minutes = Math.floor((diff % 3600) / 60);
    const seconds = diff % 60;
    setTimeString(buildTimeString(hours, minutes, seconds));
  }, [reduxStartTime]);

  const clearTimerInterval = useCallback(() => {
    if (intervalRef.current) {
      
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, [taskId]);

  const resetTimer = useCallback(() => {
    
    clearTimerInterval();
    setTimeString(DEFAULT_TIME_LEFT);
    setLocalStarted(false);
  }, [clearTimerInterval, taskId]);

  // Timer management effect
  useEffect(() => {
    
    
    if (started && localStarted && reduxStartTime) {
      
      clearTimerInterval();
      timerTick();
      intervalRef.current = setInterval(timerTick, 1000);
    } else {
      
      clearTimerInterval();
      setTimeString(DEFAULT_TIME_LEFT);
      if (started !== localStarted) {
        setLocalStarted(started);
      }
    }

    return () => {
      
      clearTimerInterval();
    };
  }, [reduxStartTime, started, localStarted, timerTick, clearTimerInterval, taskId]);

  // Initialize timer only on first mount if Redux is unset
  useEffect(() => {
    if (!hasInitialized.current && initialStartTime && reduxStartTime === undefined) {
      
      dispatch(updateTaskTimeTracking({ taskId, timeTracking: initialStartTime, userId: currentUser.id }));
      setLocalStarted(true);
    } else if (reduxStartTime && !localStarted) {
      
      setLocalStarted(true);
    }
    hasInitialized.current = true; // Mark as initialized
  }, [initialStartTime, reduxStartTime, taskId, dispatch, currentUser.id]);

  const handleStartTimer = useCallback(() => {
    if (started || !taskId) return;
    try {
      startTimerWithConflictCheck();
    } catch (error) {
      logger.error('Error starting timer:', error);
    }
  }, [taskId, started, startTimerWithConflictCheck]);

  const handleStopTimer = useCallback(() => {
    if (!taskId) return;
    
    resetTimer();
    socket?.emit(SocketEvents.TASK_TIMER_STOP.toString(), JSON.stringify({ task_id: taskId }));
    dispatch(updateTaskTimeTracking({ taskId, timeTracking: null }));
  }, [taskId, socket, dispatch, resetTimer]);

  // Socket event listeners
  useEffect(() => {
    if (!socket) return;

    const handleTimerStop = (data: string) => {
      try {
        const { task_id } = typeof data === 'string' ? JSON.parse(data) : data;
        if (task_id === taskId) {
          
          resetTimer();
          dispatch(updateTaskTimeTracking({ taskId, timeTracking: null }));
        }
      } catch (error) {
        logger.error('Error parsing timer stop event:', error);
      }
    };

    const handleTimerStart = (data: string) => {
      try {
        const { task_id, start_time } = typeof data === 'string' ? JSON.parse(data) : data;
        if (task_id === taskId && start_time) {
          const time = typeof start_time === 'number' ? start_time : parseInt(start_time);
          
          dispatch(updateTaskTimeTracking({ taskId, timeTracking: time, userId: currentUser.id }));
          setLocalStarted(true);
        }
      } catch (error) {
        logger.error('Error parsing timer start event:', error);
      }
    };

    socket.on(SocketEvents.TASK_TIMER_STOP.toString(), handleTimerStop);
    socket.on(SocketEvents.TASK_TIMER_START.toString(), handleTimerStart);

    return () => {
      socket.off(SocketEvents.TASK_TIMER_STOP.toString(), handleTimerStop);
      socket.off(SocketEvents.TASK_TIMER_START.toString(), handleTimerStart);
    };
  }, [socket, taskId, dispatch, resetTimer, currentUser.id]);

  return {
    started,
    timeString,
    handleStartTimer,
    handleStopTimer,
  };
};