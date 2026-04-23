import { useEffect, useCallback } from 'react';
import { useSocket } from '@/socket/socketContext';
import { SocketEvents } from '@/shared/socket-events';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { scheduleApi } from '@/api/schedule/scheduleApi';

/**
 * Enhanced hook specifically for handling real-time updates to member projects
 * This hook provides more granular control over member project cache invalidation
 * when task-related changes occur that affect project segments and timelines
 */
export const useMemberProjectsSocketHandlers = (
  expandedMemberIds: string[],
  chartStart?: string,
  onMemberProjectUpdate?: (memberId: string) => void
) => {
  const { socket, connected } = useSocket();
  const dispatch = useAppDispatch();

  // Handler for invalidating specific member project cache
  const invalidateMemberProjectCache = useCallback(
    (memberId: string, forceRefetch = false) => {
      if (!chartStart) return;

      const tagsToInvalidate = [
        { type: 'MemberProjects' as const, id: memberId },
        { type: 'MemberProjects' as const, id: `${memberId}-${chartStart}` },
      ];

      if (forceRefetch) {
        // Force immediate refetch by invalidating and then triggering callback
        dispatch(scheduleApi.util.invalidateTags(tagsToInvalidate));

        // Trigger immediate callback for additional handling
        if (onMemberProjectUpdate) {
          setTimeout(() => onMemberProjectUpdate(memberId), 0);
        }
      } else {
        // Normal invalidation
        dispatch(scheduleApi.util.invalidateTags(tagsToInvalidate));

        if (onMemberProjectUpdate) {
          onMemberProjectUpdate(memberId);
        }
      }
    },
    [dispatch, chartStart, onMemberProjectUpdate]
  );

  // Handler for task date changes that affect project segments
  const handleTaskDateChange = useCallback(
    (data: { id: string; project_id?: string; parent_task?: string | null }) => {
      if (!data?.id) return;

      // Invalidate cache for all expanded members as task date changes affect segments
      expandedMemberIds.forEach(memberId => {
        invalidateMemberProjectCache(memberId, true); // Force immediate refetch
      });
    },
    [expandedMemberIds, invalidateMemberProjectCache]
  );

  // Handler for task estimation changes that affect project workload
  const handleTaskEstimationChange = useCallback(
    (data: { id: string; estimation: number; parent_task?: string | null }) => {
      if (!data?.id) return;

      // Estimation changes affect project segments and workload calculations
      expandedMemberIds.forEach(memberId => {
        invalidateMemberProjectCache(memberId, true); // Force immediate refetch
      });
    },
    [expandedMemberIds, invalidateMemberProjectCache]
  );

  // Handler for task assignee changes that affect member project assignments
  const handleTaskAssigneeChange = useCallback(
    (data: any) => {
      if (!data) return;

      // Assignee changes can add/remove projects from member timelines
      // Invalidate cache for all expanded members
      expandedMemberIds.forEach(memberId => {
        invalidateMemberProjectCache(memberId, true); // Force immediate refetch
      });
    },
    [expandedMemberIds, invalidateMemberProjectCache]
  );

  // Handler for task status changes that might affect project visibility
  const handleTaskStatusChange = useCallback(
    (data: { task_id: string; status_id: string; project_id?: string }) => {
      if (!data?.task_id) return;

      // Status changes might affect task visibility in segments
      expandedMemberIds.forEach(memberId => {
        invalidateMemberProjectCache(memberId);
      });
    },
    [expandedMemberIds, invalidateMemberProjectCache]
  );

  // Handler for new task creation
  const handleNewTaskCreated = useCallback(
    (data: { id: string; project_id: string; assignees?: any[] }) => {
      if (!data?.id) return;

      // New tasks might create new segments or extend existing ones
      expandedMemberIds.forEach(memberId => {
        invalidateMemberProjectCache(memberId);
      });
    },
    [expandedMemberIds, invalidateMemberProjectCache]
  );

  // Handler for task deletion (if implemented)
  const handleTaskDeleted = useCallback(
    (data: { id: string; project_id: string }) => {
      if (!data?.id) return;

      // Task deletion might remove segments or shorten existing ones
      expandedMemberIds.forEach(memberId => {
        invalidateMemberProjectCache(memberId);
      });
    },
    [expandedMemberIds, invalidateMemberProjectCache]
  );

  // Set up socket event listeners for member project updates
  useEffect(() => {
    if (!socket || !connected || expandedMemberIds.length === 0) return;

    const eventHandlers = {
      // Task date changes - most critical for segments
      [SocketEvents.TASK_START_DATE_CHANGE.toString()]: handleTaskDateChange,
      [SocketEvents.TASK_END_DATE_CHANGE.toString()]: handleTaskDateChange,

      // Task estimation changes - affects workload calculations
      [SocketEvents.TASK_TIME_ESTIMATION_CHANGE.toString()]: handleTaskEstimationChange,

      // Assignee changes - affects which projects appear for members
      [SocketEvents.TASK_ASSIGNEES_CHANGE.toString()]: handleTaskAssigneeChange,
      [SocketEvents.QUICK_ASSIGNEES_UPDATE.toString()]: handleTaskAssigneeChange,

      // Status changes - might affect task visibility
      [SocketEvents.TASK_STATUS_CHANGE.toString()]: handleTaskStatusChange,

      // New task creation
      [SocketEvents.QUICK_TASK.toString()]: handleNewTaskCreated,

      // Other task changes that might affect segments
      [SocketEvents.TASK_NAME_CHANGE.toString()]: handleTaskDateChange, // Reuse date handler
      [SocketEvents.TASK_PRIORITY_CHANGE.toString()]: handleTaskDateChange, // Reuse date handler
      [SocketEvents.TASK_PHASE_CHANGE.toString()]: handleTaskDateChange, // Reuse date handler
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
    expandedMemberIds,
    handleTaskDateChange,
    handleTaskEstimationChange,
    handleTaskAssigneeChange,
    handleTaskStatusChange,
    handleNewTaskCreated,
    handleTaskDeleted,
  ]);

  return {
    connected,
    invalidateMemberProjectCache,
  };
};
