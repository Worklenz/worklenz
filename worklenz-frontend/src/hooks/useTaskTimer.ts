import { useState, useEffect, useCallback, useRef } from 'react';
import dayjs from 'dayjs';
import { message } from '@/shared/antd-imports';
import { buildTimeString } from '@/utils/timeUtils';
import { useSocket } from '@/socket/socketContext';
import { SocketEvents } from '@/shared/socket-events';
import logger from '@/utils/errorLogger';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { updateTaskTimeTracking } from '@/features/tasks/tasks.slice';
import { useAppSelector } from '@/hooks/useAppSelector';
import { selectTaskById, updateTask } from '@/features/task-management/task-management.slice';
import { store } from '@/app/store';
import { Task } from '@/types/task-management.types';

export const useTaskTimer = (taskId: string, initialStartTime: number | null) => {
  const dispatch = useAppDispatch();
  const { socket } = useSocket();
  const DEFAULT_TIME_LEFT = buildTimeString(0, 0, 0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const hasInitialized = useRef(false); // Track if we've initialized

  const activeTimers = useAppSelector(state => state.taskReducer.activeTimers);
  const task = useAppSelector(state => selectTaskById(state, taskId));

  // Check both the old slice (activeTimers) and new slice (task.timeTracking.activeTimer)
  const reduxStartTime = activeTimers[taskId] || task?.timeTracking?.activeTimer;
  const started = Boolean(reduxStartTime);

  const [timeString, setTimeString] = useState(DEFAULT_TIME_LEFT);
  const [localStarted, setLocalStarted] = useState(false);

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

  const clearReduxTimer = useCallback(
    (targetTaskId: string) => {
      dispatch(updateTaskTimeTracking({ taskId: targetTaskId, timeTracking: null }));
      const currentTask = store.getState().taskManagement.entities[targetTaskId];
      if (currentTask && currentTask.timeTracking?.activeTimer) {
        dispatch(
          updateTask({
            ...currentTask,
            timeTracking: {
              ...currentTask.timeTracking,
              activeTimer: undefined,
            },
            updatedAt: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
        );
      }
    },
    [dispatch]
  );

  const resetTimer = useCallback(() => {
    clearTimerInterval();
    setTimeString(DEFAULT_TIME_LEFT);
    setLocalStarted(false);
  }, [clearTimerInterval]);

  // Timer management effect
  useEffect(() => {
    if (started && reduxStartTime) {
      // Sync local state with Redux state
      if (!localStarted) {
        setLocalStarted(true);
      }
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
  }, [reduxStartTime, started, localStarted, timerTick, clearTimerInterval]);

  // Initialize timer only on first mount if Redux is unset
  useEffect(() => {
    if (!hasInitialized.current && initialStartTime && reduxStartTime === undefined) {
      dispatch(updateTaskTimeTracking({ taskId, timeTracking: initialStartTime }));
      setLocalStarted(true);
    } else if (reduxStartTime && !localStarted) {
      setLocalStarted(true);
    }
    hasInitialized.current = true; // Mark as initialized
  }, [initialStartTime, reduxStartTime, taskId, dispatch]);

  const handleStartTimer = useCallback(() => {
    if (started || !taskId) return;

    // Check if task's project has a scheduled start date in the future
    const state = store.getState();
    const currentProject = state.projectReducer.project;
    const drawerTask = state.taskDrawerReducer.taskFormViewModel?.task;
    const projectStartDate =
      (currentProject?.id && (!drawerTask?.project_id || drawerTask.project_id === currentProject.id)
        ? currentProject.start_date
        : null) ||
      drawerTask?.project_start_date;

    if (
      projectStartDate &&
      dayjs(projectStartDate).startOf('day').isAfter(dayjs().startOf('day'), 'day')
    ) {
      const formattedDate = dayjs(projectStartDate).format('MMM DD, YYYY');
      message.warning({
        content: `Time cannot be logged before the project start date (${formattedDate}).`,
        key: `timer-error-${taskId}`,
      });
      return;
    }

    try {
      const now = Date.now();

      dispatch(updateTaskTimeTracking({ taskId, timeTracking: now }));
      setLocalStarted(true);
      socket?.emit(SocketEvents.TASK_TIMER_START.toString(), JSON.stringify({ task_id: taskId }));
    } catch (error) {
      logger.error('Error starting timer:', error);
    }
  }, [taskId, started, socket, dispatch]);

  const handleStopTimer = useCallback(() => {
    if (!taskId) return;

    resetTimer();
    socket?.emit(SocketEvents.TASK_TIMER_STOP.toString(), JSON.stringify({ task_id: taskId }));
    clearReduxTimer(taskId);
  }, [taskId, socket, resetTimer, clearReduxTimer]);

  // Socket event listeners
  useEffect(() => {
    if (!socket) return;

    const handleTimerStop = (data: any) => {
      try {
        if (!data) return;
        const parsed = typeof data === 'string' ? JSON.parse(data) : data;
        const targetId = parsed?.task_id || parsed?.id;
        if (targetId === taskId) {
          resetTimer();
          clearReduxTimer(taskId);
        }
      } catch (error) {
        logger.error('Error parsing timer stop event:', error);
      }
    };

    const handleTimerStart = (data: any) => {
      try {
        if (!data) {
          // If start was rejected or failed on the backend, ensure local timer rolls back
          resetTimer();
          clearReduxTimer(taskId);
          return;
        }
        const parsed = typeof data === 'string' ? JSON.parse(data) : data;
        const targetId = parsed?.task_id || parsed?.id;

        if (parsed?.error || parsed?.message) {
          if (!targetId || targetId === taskId) {
            resetTimer();
            clearReduxTimer(taskId);
            message.warning({
              content: parsed.error || parsed.message,
              key: `timer-error-${taskId}`,
            });
            return;
          }
        }

        const startTimeVal = parsed?.start_time || parsed?.timer_start_time;
        if (targetId === taskId && startTimeVal) {
          const time = typeof startTimeVal === 'number' ? startTimeVal : parseInt(startTimeVal);

          dispatch(updateTaskTimeTracking({ taskId, timeTracking: time }));
          setLocalStarted(true);
        }
      } catch (error) {
        logger.error('Error parsing timer start event:', error);
      }
    };

    const handleTimerError = (data: any) => {
      try {
        const parsed = typeof data === 'string' ? JSON.parse(data) : data;
        const targetId = parsed?.task_id || parsed?.id;
        if (!targetId || targetId === taskId) {
          resetTimer();
          clearReduxTimer(taskId);
          const warnMsg = parsed?.message || parsed?.error;
          if (warnMsg) {
            message.warning({
              content: warnMsg,
              key: `timer-error-${taskId}`,
            });
          }
        }
      } catch (err) {
        logger.error('Error handling timer error event:', err);
      }
    };

    socket.on(SocketEvents.TASK_TIMER_STOP.toString(), handleTimerStop);
    socket.on(SocketEvents.TASK_TIMER_START.toString(), handleTimerStart);
    socket.on('timer-error', handleTimerError);

    return () => {
      socket.off(SocketEvents.TASK_TIMER_STOP.toString(), handleTimerStop);
      socket.off(SocketEvents.TASK_TIMER_START.toString(), handleTimerStart);
      socket.off('timer-error', handleTimerError);
    };
  }, [socket, taskId, dispatch, resetTimer, clearReduxTimer]);

  return {
    started,
    timeString,
    handleStartTimer,
    handleStopTimer,
  };
};
