import { useEffect, useCallback } from 'react';
import { useSocket } from '@/socket/socketContext';
import { SocketEvents } from '@/shared/socket-events';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { scheduleApi } from '@/api/schedule/scheduleApi';

/**
 * Custom hook to handle socket events that affect schedule components
 * This hook listens to task-related socket events and invalidates relevant RTK Query cache
 * to ensure real-time updates in schedule views (Gantt chart, timeline, task lists)
 */
export const useScheduleSocketHandlers = () => {
  const { socket, connected } = useSocket();
  const dispatch = useAppDispatch();

  // Handler for task status changes
  const handleTaskStatusChange = useCallback(
    (data: any) => {
      if (!data) return;

      // Invalidate schedule-related cache
      dispatch(scheduleApi.util.invalidateTags(['TaskTimeline', 'MemberProjects', 'Workload']));

      // If it's a project member task query, also invalidate that specific cache
      if (data.project_id) {
        dispatch(
          scheduleApi.util.invalidateTags([{ type: 'MemberProjects', id: data.project_id }])
        );
      }
    },
    [dispatch]
  );

  // Handler for task priority changes
  const handleTaskPriorityChange = useCallback(
    (data: any) => {
      if (!data) return;

      dispatch(scheduleApi.util.invalidateTags(['TaskTimeline', 'MemberProjects']));
    },
    [dispatch]
  );

  // Handler for task name changes
  const handleTaskNameChange = useCallback(
    (data: { id: string; name: string; parent_task: string | null }) => {
      if (!data) return;

      dispatch(scheduleApi.util.invalidateTags(['TaskTimeline', 'MemberProjects']));
    },
    [dispatch]
  );

  // Handler for task start date changes
  const handleTaskStartDateChange = useCallback(
    (data: { id: string; parent_task: string | null; start_date: string; project_id?: string }) => {
      if (!data) return;

      // Invalidate all schedule-related cache as date changes affect timeline positioning
      dispatch(
        scheduleApi.util.invalidateTags([
          'TaskTimeline',
          'MemberProjects',
          'Workload',
          'Capacity',
          'CapacityReport',
        ])
      );

      // Also invalidate specific member project cache if we have project info
      if (data.project_id) {
        dispatch(
          scheduleApi.util.invalidateTags([
            { type: 'TaskTimeline', id: `project-${data.project_id}` },
          ])
        );
      }

      // Force refetch of all member projects to ensure immediate updates
      dispatch(scheduleApi.util.invalidateTags(['MemberProjects']));
    },
    [dispatch]
  );

  // Handler for task end date changes
  const handleTaskEndDateChange = useCallback(
    (data: { id: string; parent_task: string | null; end_date: string; project_id?: string }) => {
      if (!data) return;

      // Invalidate all schedule-related cache as date changes affect timeline positioning
      dispatch(
        scheduleApi.util.invalidateTags([
          'TaskTimeline',
          'MemberProjects',
          'Workload',
          'Capacity',
          'CapacityReport',
        ])
      );

      // Also invalidate specific member project cache if we have project info
      if (data.project_id) {
        dispatch(
          scheduleApi.util.invalidateTags([
            { type: 'TaskTimeline', id: `project-${data.project_id}` },
          ])
        );
      }

      // Force refetch of all member projects to ensure immediate updates
      dispatch(scheduleApi.util.invalidateTags(['MemberProjects']));
    },
    [dispatch]
  );

  // Handler for task time estimation changes
  const handleTaskEstimationChange = useCallback(
    (data: { id: string; parent_task: string | null; estimation: number }) => {
      if (!data) return;

      // Estimation changes affect workload and capacity calculations
      dispatch(
        scheduleApi.util.invalidateTags([
          'TaskTimeline',
          'MemberProjects',
          'Workload',
          'Capacity',
          'CapacityReport',
        ])
      );
    },
    [dispatch]
  );

  // Handler for task description changes
  const handleTaskDescriptionChange = useCallback(
    (data: { id: string; parent_task: string; description: string }) => {
      if (!data) return;

      dispatch(scheduleApi.util.invalidateTags(['TaskTimeline', 'MemberProjects']));
    },
    [dispatch]
  );

  // Handler for task labels changes
  const handleTaskLabelsChange = useCallback(
    (data: any) => {
      if (!data) return;

      dispatch(scheduleApi.util.invalidateTags(['TaskTimeline', 'MemberProjects']));
    },
    [dispatch]
  );

  // Handler for task assignees changes
  const handleTaskAssigneesChange = useCallback(
    (data: any) => {
      if (!data) return;

      // Assignee changes affect member workload and project assignments
      dispatch(
        scheduleApi.util.invalidateTags([
          'TaskTimeline',
          'MemberProjects',
          'Members',
          'Workload',
          'Capacity',
        ])
      );

      // Force immediate refetch of all member projects
      dispatch(scheduleApi.util.invalidateTags(['MemberProjects']));
    },
    [dispatch]
  );

  // Handler for task phase changes
  const handleTaskPhaseChange = useCallback(
    (data: any) => {
      if (!data) return;

      dispatch(scheduleApi.util.invalidateTags(['TaskTimeline', 'MemberProjects']));
    },
    [dispatch]
  );

  // Handler for task progress updates
  const handleTaskProgressUpdate = useCallback(
    (data: { task_id: string; progress_value?: number; weight?: number }) => {
      if (!data) return;

      dispatch(scheduleApi.util.invalidateTags(['TaskTimeline', 'MemberProjects', 'Workload']));
    },
    [dispatch]
  );

  // Handler for task subscribers changes
  const handleTaskSubscribersChange = useCallback(
    (data: any) => {
      if (!data) return;

      dispatch(scheduleApi.util.invalidateTags(['TaskTimeline', 'MemberProjects']));
    },
    [dispatch]
  );

  // Handler for new task creation
  const handleNewTaskReceived = useCallback(
    (data: any) => {
      if (!data) return;

      // New tasks affect all schedule views
      dispatch(
        scheduleApi.util.invalidateTags([
          'TaskTimeline',
          'MemberProjects',
          'Members',
          'Workload',
          'Capacity',
        ])
      );
    },
    [dispatch]
  );

  // Handler for task billable status changes
  const handleTaskBillableChange = useCallback(
    (data: any) => {
      if (!data) return;

      dispatch(scheduleApi.util.invalidateTags(['TaskTimeline', 'MemberProjects', 'Workload']));
    },
    [dispatch]
  );

  // Handler for task recurring changes
  const handleTaskRecurringChange = useCallback(
    (data: any) => {
      if (!data) return;

      dispatch(scheduleApi.util.invalidateTags(['TaskTimeline', 'MemberProjects', 'Workload']));
    },
    [dispatch]
  );

  // Handler for task timer start
  const handleTaskTimerStart = useCallback(
    (data: any) => {
      if (!data) return;

      // Timer start doesn't affect logged time, but we might want to track active timers
      dispatch(scheduleApi.util.invalidateTags(['Members']));
    },
    [dispatch]
  );

  // Handler for task timer stop - this creates a new time log entry
  const handleTaskTimerStop = useCallback(
    (data: any) => {
      if (!data) return;

      // Timer stop creates a new time log entry, so we need to invalidate:
      // - Members cache (to update summary data with new logged time)
      // - MemberProjects cache (to update task logged time in project view)
      // - TaskTimeline cache (to update task list with new logged time)
      // - Workload cache (logged time affects workload calculations)
      dispatch(
        scheduleApi.util.invalidateTags(['Members', 'MemberProjects', 'TaskTimeline', 'Workload'])
      );
    },
    [dispatch]
  );

  // Handler for task time log updates (create, update, delete)
  const handleTaskTimeLogUpdated = useCallback(
    (data: any) => {
      if (!data) return;

      // Time log changes affect logged time in schedule views
      // - Members cache (to update summary data with new logged time)
      // - MemberProjects cache (to update task logged time in project view)
      // - TaskTimeline cache (to update task list with new logged time)
      // - Workload cache (logged time affects workload calculations)
      dispatch(
        scheduleApi.util.invalidateTags(['Members', 'MemberProjects', 'TaskTimeline', 'Workload'])
      );
    },
    [dispatch]
  );

  // Set up socket event listeners
  useEffect(() => {
    if (!socket || !connected) return;

    const eventHandlers = {
      [SocketEvents.TASK_STATUS_CHANGE.toString()]: handleTaskStatusChange,
      [SocketEvents.TASK_PRIORITY_CHANGE.toString()]: handleTaskPriorityChange,
      [SocketEvents.TASK_NAME_CHANGE.toString()]: handleTaskNameChange,
      [SocketEvents.TASK_START_DATE_CHANGE.toString()]: handleTaskStartDateChange,
      [SocketEvents.TASK_END_DATE_CHANGE.toString()]: handleTaskEndDateChange,
      [SocketEvents.TASK_TIME_ESTIMATION_CHANGE.toString()]: handleTaskEstimationChange,
      [SocketEvents.TASK_DESCRIPTION_CHANGE.toString()]: handleTaskDescriptionChange,
      [SocketEvents.TASK_LABELS_CHANGE.toString()]: handleTaskLabelsChange,
      [SocketEvents.QUICK_ASSIGNEES_UPDATE.toString()]: handleTaskAssigneesChange,
      [SocketEvents.TASK_ASSIGNEES_CHANGE.toString()]: handleTaskAssigneesChange,
      [SocketEvents.TASK_PHASE_CHANGE.toString()]: handleTaskPhaseChange,
      [SocketEvents.TASK_PROGRESS_UPDATED.toString()]: handleTaskProgressUpdate,
      [SocketEvents.TASK_SUBSCRIBERS_CHANGE.toString()]: handleTaskSubscribersChange,
      [SocketEvents.QUICK_TASK.toString()]: handleNewTaskReceived,
      [SocketEvents.TASK_BILLABLE_CHANGE.toString()]: handleTaskBillableChange,
      [SocketEvents.TASK_RECURRING_CHANGE.toString()]: handleTaskRecurringChange,
      [SocketEvents.TASK_TIMER_START.toString()]: handleTaskTimerStart,
      [SocketEvents.TASK_TIMER_STOP.toString()]: handleTaskTimerStop,
      [SocketEvents.TASK_TIME_LOG_UPDATED.toString()]: handleTaskTimeLogUpdated,
    };

    // Register all event handlers
    Object.entries(eventHandlers).forEach(([event, handler]) => {
      if (handler) {
        socket.on(event, handler);
      }
    });

    // Cleanup function
    return () => {
      Object.entries(eventHandlers).forEach(([event, handler]) => {
        if (handler) {
          socket.off(event, handler);
        }
      });
    };
  }, [
    socket,
    connected,
    handleTaskStatusChange,
    handleTaskPriorityChange,
    handleTaskNameChange,
    handleTaskStartDateChange,
    handleTaskEndDateChange,
    handleTaskEstimationChange,
    handleTaskDescriptionChange,
    handleTaskLabelsChange,
    handleTaskAssigneesChange,
    handleTaskPhaseChange,
    handleTaskProgressUpdate,
    handleTaskSubscribersChange,
    handleNewTaskReceived,
    handleTaskBillableChange,
    handleTaskRecurringChange,
    handleTaskTimerStart,
    handleTaskTimerStop,
    handleTaskTimeLogUpdated,
  ]);

  return {
    connected,
  };
};
