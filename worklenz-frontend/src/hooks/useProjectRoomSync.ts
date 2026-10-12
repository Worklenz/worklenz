import { useEffect, useRef } from 'react';
import { useSocket } from '@/socket/socketContext';
import { SocketEvents } from '@/shared/socket-events';

// Shared by PlannerScheduleView/PlannerWorkloadView to derive the project id Set
// useProjectRoomSync expects from their (differently-sourced) task lists.
export const projectIdsFromTasks = (tasks: { project_id?: string | null }[]): Set<string> =>
  new Set(tasks.map(t => t.project_id).filter((id): id is string => !!id));

// Shared by PlannerScheduleView/PlannerWorkloadView: a day's tasks "overlap" when a
// visible task's parent is also visible that same day (their estimates are additive,
// never rolled up, so both counting toward the day total is intentional — this just
// flags the combination to the PM). Generic over each view's own task shape.
export const hasParentSubtaskOverlap = <T>(
  dayTasks: T[],
  getId: (task: T) => string,
  getParentId: (task: T) => string | null | undefined
): boolean => {
  const dayTaskIds = new Set(dayTasks.map(getId));
  return dayTasks.some(task => {
    const parentId = getParentId(task);
    return !!parentId && dayTaskIds.has(parentId);
  });
};

/**
 * Joins/leaves the socket room for every project id in `projectIds` (same
 * JOIN_OR_LEAVE_PROJECT_ROOM pattern used by project-view.tsx for the single-project
 * view and PlannerTimelineView.tsx for its expanded-project rows), so
 * PROJECT_UPDATES_AVAILABLE broadcasts for those projects reach this client instead
 * of only refreshing on a hard refresh. Diffed against a ref rather than re-emitted
 * every render, and every currently-joined room is re-joined on reconnect / left on
 * unmount.
 */
export const useProjectRoomSync = (projectIds: Set<string>) => {
  const { socket } = useSocket();
  const joinedRoomsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!socket) return;
    const joined = joinedRoomsRef.current;
    projectIds.forEach(id => {
      if (!joined.has(id)) {
        socket.emit(SocketEvents.JOIN_OR_LEAVE_PROJECT_ROOM.toString(), { type: 'join', id });
        joined.add(id);
      }
    });
    joined.forEach(id => {
      if (!projectIds.has(id)) {
        socket.emit(SocketEvents.JOIN_OR_LEAVE_PROJECT_ROOM.toString(), { type: 'leave', id });
        joined.delete(id);
      }
    });
  }, [socket, projectIds]);

  useEffect(() => {
    if (!socket) return;
    const handleReconnect = () => {
      joinedRoomsRef.current.forEach(id => {
        socket.emit(SocketEvents.JOIN_OR_LEAVE_PROJECT_ROOM.toString(), { type: 'join', id });
      });
    };
    socket.on('connect', handleReconnect);
    return () => {
      socket.off('connect', handleReconnect);
      joinedRoomsRef.current.forEach(id => {
        socket.emit(SocketEvents.JOIN_OR_LEAVE_PROJECT_ROOM.toString(), { type: 'leave', id });
      });
      joinedRoomsRef.current.clear();
    };
  }, [socket]);
};
