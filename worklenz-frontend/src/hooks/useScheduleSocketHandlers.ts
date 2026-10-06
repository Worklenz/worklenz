import { useEffect } from 'react';
import { useSocket } from '@/socket/socketContext';
import { SocketEvents } from '@/shared/socket-events';
import { useAppDispatch } from './useAppDispatch';
import { scheduleApi } from '@/api/schedule/scheduleApi';
import logger from '@/utils/errorLogger';

/**
 * Custom hook to handle real-time socket events for schedule updates
 * Listens to task-related socket events and invalidates relevant RTK Query cache
 */
export const useScheduleSocketHandlers = () => {
  const { socket, connected } = useSocket();
  const dispatch = useAppDispatch();

  useEffect(() => {
    if (!socket || !connected) return;

    // Handler for billable status changes
    const handleBillableChange = (data: { id: string; error?: string; billable?: boolean }) => {
      if (data.error) {
        logger.error('Billable change error:', data.error);
        return;
      }

      logger.info('Task billable status changed, refreshing schedule data', {
        taskId: data.id,
        billable: data.billable,
      });

      // Invalidate schedule-related cache tags to trigger refetch
      dispatch(
        scheduleApi.util.invalidateTags([
          'Members', // Invalidate member summary data
          'TaskTimeline', // Invalidate task timeline data
          'MemberProjects', // Invalidate member projects data
          'Workload', // Invalidate workload data
        ])
      );
    };

    // Handler for time estimation changes
    const handleTimeEstimationChange = (data: { id: string }) => {
      logger.info('Task time estimation changed, refreshing schedule data', { taskId: data.id });

      dispatch(
        scheduleApi.util.invalidateTags(['Members', 'TaskTimeline', 'MemberProjects', 'Workload'])
      );
    };

    // Handler for task assignee changes
    const handleAssigneesChange = (data: { task_id: string }) => {
      logger.info('Task assignees changed, refreshing schedule data', { taskId: data.task_id });

      dispatch(
        scheduleApi.util.invalidateTags(['Members', 'TaskTimeline', 'MemberProjects', 'Workload'])
      );
    };

    // Handler for task date changes
    const handleTaskDateChange = (data: { id: string }) => {
      logger.info('Task dates changed, refreshing schedule data', { taskId: data.id });

      dispatch(
        scheduleApi.util.invalidateTags(['Members', 'TaskTimeline', 'MemberProjects', 'Workload'])
      );
    };

    // Handler for task status changes
    const handleTaskStatusChange = (data: { id: string }) => {
      logger.info('Task status changed, refreshing schedule data', { taskId: data.id });

      dispatch(
        scheduleApi.util.invalidateTags(['Members', 'TaskTimeline', 'MemberProjects', 'Workload'])
      );
    };

    // Generic "something changed in this project" signal, broadcast to every other
    // member of the project's socket room (see notifyProjectUpdates on the backend) —
    // this is how viewers OTHER than the one who made a change find out about it, since
    // TASK_STATUS_CHANGE above is only echoed back to the socket that triggered it.
    const handleProjectUpdatesAvailable = () => {
      logger.info('Project updates available, refreshing schedule data');

      dispatch(
        scheduleApi.util.invalidateTags([
          'Members',
          'TaskTimeline',
          'MemberProjects',
          'Workload',
          'ProjectsTimeline',
        ])
      );
    };

    // Handler for task time log updates
    const handleTimeLogUpdate = (data: { task_id: string }) => {
      logger.info('Task time log updated, refreshing schedule data', { taskId: data.task_id });

      dispatch(
        scheduleApi.util.invalidateTags([
          'Members', // Member summary includes logged hours
          'Workload',
          'TaskTimeline', // Task list includes logged time (total_minutes_spent)
        ])
      );
    };

    // Handler for new task/subtask creation
    const handleNewTaskReceived = (data: any) => {
      if (!data) return;
      logger.info('New task created, refreshing schedule data', { taskId: data.id });

      dispatch(
        scheduleApi.util.invalidateTags(['Members', 'TaskTimeline', 'MemberProjects', 'Workload'])
      );
    };

    // Handler for task priority changes
    const handleTaskPriorityChange = (data: any) => {
      if (!data) return;
      logger.info('Task priority changed, refreshing schedule data', { taskId: data.id });

      dispatch(scheduleApi.util.invalidateTags(['TaskTimeline', 'MemberProjects']));
    };

    // Handler for task phase changes
    const handleTaskPhaseChange = (data: any) => {
      if (!data) return;
      logger.info('Task phase changed, refreshing schedule data', { taskId: data.id });

      dispatch(scheduleApi.util.invalidateTags(['TaskTimeline', 'MemberProjects']));
    };

    // Handler for task progress updates
    const handleTaskProgressUpdate = (data: { task_id?: string }) => {
      if (!data) return;
      logger.info('Task progress updated, refreshing schedule data', { taskId: data.task_id });

      dispatch(scheduleApi.util.invalidateTags(['TaskTimeline', 'MemberProjects', 'Workload']));
    };

    // Handler for task recurring settings changes
    const handleTaskRecurringChange = (data: any) => {
      if (!data) return;
      logger.info('Task recurring settings changed, refreshing schedule data', { taskId: data.id });

      dispatch(scheduleApi.util.invalidateTags(['TaskTimeline', 'MemberProjects', 'Workload']));
    };

    // Handler for task timer start
    const handleTaskTimerStart = (data: any) => {
      if (!data) return;
      logger.info('Task timer started, refreshing schedule data', { taskId: data.id });

      dispatch(scheduleApi.util.invalidateTags(['Members']));
    };

    // Handler for task timer stop (creates a new time log entry)
    const handleTaskTimerStop = (data: any) => {
      if (!data) return;
      logger.info('Task timer stopped, refreshing schedule data', { taskId: data.id });

      dispatch(
        scheduleApi.util.invalidateTags(['Members', 'MemberProjects', 'TaskTimeline', 'Workload'])
      );
    };

    // Register socket event listeners
    socket.on(SocketEvents.TASK_BILLABLE_CHANGE.toString(), handleBillableChange);
    socket.on(SocketEvents.TASK_TIME_ESTIMATION_CHANGE.toString(), handleTimeEstimationChange);
    socket.on(SocketEvents.TASK_ASSIGNEES_CHANGE.toString(), handleAssigneesChange);
    socket.on(SocketEvents.TASK_START_DATE_CHANGE.toString(), handleTaskDateChange);
    socket.on(SocketEvents.TASK_END_DATE_CHANGE.toString(), handleTaskDateChange);
    socket.on(SocketEvents.TASK_STATUS_CHANGE.toString(), handleTaskStatusChange);
    socket.on(SocketEvents.TASK_TIME_LOG_UPDATED.toString(), handleTimeLogUpdate);
    socket.on(SocketEvents.PROJECT_UPDATES_AVAILABLE.toString(), handleProjectUpdatesAvailable);
    socket.on(SocketEvents.QUICK_TASK.toString(), handleNewTaskReceived);
    socket.on(SocketEvents.TASK_PRIORITY_CHANGE.toString(), handleTaskPriorityChange);
    socket.on(SocketEvents.TASK_PHASE_CHANGE.toString(), handleTaskPhaseChange);
    socket.on(SocketEvents.TASK_PROGRESS_UPDATED.toString(), handleTaskProgressUpdate);
    socket.on(SocketEvents.TASK_RECURRING_CHANGE.toString(), handleTaskRecurringChange);
    socket.on(SocketEvents.TASK_TIMER_START.toString(), handleTaskTimerStart);
    socket.on(SocketEvents.TASK_TIMER_STOP.toString(), handleTaskTimerStop);

    // Cleanup: remove all listeners when component unmounts or socket changes
    return () => {
      socket.off(SocketEvents.TASK_BILLABLE_CHANGE.toString(), handleBillableChange);
      socket.off(SocketEvents.TASK_TIME_ESTIMATION_CHANGE.toString(), handleTimeEstimationChange);
      socket.off(SocketEvents.TASK_ASSIGNEES_CHANGE.toString(), handleAssigneesChange);
      socket.off(SocketEvents.TASK_START_DATE_CHANGE.toString(), handleTaskDateChange);
      socket.off(SocketEvents.TASK_END_DATE_CHANGE.toString(), handleTaskDateChange);
      socket.off(SocketEvents.TASK_STATUS_CHANGE.toString(), handleTaskStatusChange);
      socket.off(SocketEvents.TASK_TIME_LOG_UPDATED.toString(), handleTimeLogUpdate);
      socket.off(SocketEvents.PROJECT_UPDATES_AVAILABLE.toString(), handleProjectUpdatesAvailable);
      socket.off(SocketEvents.QUICK_TASK.toString(), handleNewTaskReceived);
      socket.off(SocketEvents.TASK_PRIORITY_CHANGE.toString(), handleTaskPriorityChange);
      socket.off(SocketEvents.TASK_PHASE_CHANGE.toString(), handleTaskPhaseChange);
      socket.off(SocketEvents.TASK_PROGRESS_UPDATED.toString(), handleTaskProgressUpdate);
      socket.off(SocketEvents.TASK_RECURRING_CHANGE.toString(), handleTaskRecurringChange);
      socket.off(SocketEvents.TASK_TIMER_START.toString(), handleTaskTimerStart);
      socket.off(SocketEvents.TASK_TIMER_STOP.toString(), handleTaskTimerStop);
    };
  }, [socket, connected, dispatch]);
};
