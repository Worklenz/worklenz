import { useEffect, useRef } from 'react';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { updateTaskTimeTracking } from '@/features/tasks/tasks.slice';
import { updateTask } from '@/features/task-management/task-management.slice';
import { taskTimeLogsApiService } from '@/api/tasks/task-time-logs.api.service';
import { store } from '@/app/store';
import { Task } from '@/types/task-management.types';
import logger from '@/utils/errorLogger';
import moment from 'moment';

export const useTimerInitialization = () => {
  const dispatch = useAppDispatch();
  const hasInitialized = useRef(false);

  useEffect(() => {
    const initializeTimers = async () => {
      // Prevent duplicate initialization
      if (hasInitialized.current) {
        return;
      }

      try {
        hasInitialized.current = true;

        // Fetch running timers from backend
        const response = await taskTimeLogsApiService.getRunningTimers();

        if (response && response.done && Array.isArray(response.body)) {
          const runningTimers = response.body;

          // Update Redux state for each running timer
          runningTimers.forEach(timer => {
            if (timer.task_id && timer.start_time) {
              try {
                // Convert start_time to timestamp
                const startTime = moment(timer.start_time);
                if (startTime.isValid()) {
                  const timestamp = startTime.valueOf();

                  // Update the tasks slice activeTimers
                  dispatch(
                    updateTaskTimeTracking({
                      taskId: timer.task_id,
                      timeTracking: timestamp,
                    })
                  );

                  // Update the task-management slice if the task exists
                  const currentTask = store.getState().taskManagement.entities[timer.task_id];
                  if (currentTask) {
                    const updatedTask: Task = {
                      ...currentTask,
                      timeTracking: {
                        ...currentTask.timeTracking,
                        activeTimer: timestamp,
                      },
                      updatedAt: new Date().toISOString(),
                      updated_at: new Date().toISOString(),
                    };
                    dispatch(updateTask(updatedTask));
                  }
                }
              } catch (error) {
                logger.error(`Error initializing timer for task ${timer.task_id}:`, error);
              }
            }
          });

          if (runningTimers.length > 0) {
            logger.info(`Initialized ${runningTimers.length} running timers from backend`);
          }
        }
      } catch (error) {
        logger.error('Error initializing timers from backend:', error);
      }
    };

    // Initialize timers when the hook mounts
    initializeTimers();
  }, [dispatch]);
};
