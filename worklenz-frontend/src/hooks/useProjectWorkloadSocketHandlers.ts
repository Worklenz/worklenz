import { useEffect, useRef } from 'react';
import debounce from 'lodash-es/debounce';
import { useSocket } from '@/socket/socketContext';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { SocketEvents } from '@/shared/socket-events';
import projectWorkloadApi from '@/api/project-workload/project-workload.api.service';

/**
 * Keeps the project Workload views (Table/Chart/Calendar/Overview) live by
 * invalidating their RTK Query cache whenever a relevant task event arrives,
 * instead of requiring a full page refresh. Same registration flow as
 * useTaskSocketHandlers (Task List/Kanban): register on socket only (no
 * `connected` gate — socket.on() attaches regardless of live connection
 * state), lean on PROJECT_UPDATES_AVAILABLE as the catch-all. Debounced like
 * useHomeDashboardSocketSync so a burst of per-task events from a bulk
 * operation collapses into a single refetch.
 */
export const useProjectWorkloadSocketHandlers = () => {
  const { socket } = useSocket();
  const dispatch = useAppDispatch();
  const refreshWorkload = useRef<ReturnType<typeof debounce> | null>(null);

  useEffect(() => {
    if (!socket) return;

    if (!refreshWorkload.current) {
      refreshWorkload.current = debounce(() => {
        dispatch(projectWorkloadApi.util.invalidateTags(['ProjectWorkload', 'TaskAllocations']));
      }, 300);
    }
    const handler = () => refreshWorkload.current?.();

    const events = [
      SocketEvents.TASK_ASSIGNEES_CHANGE,
      SocketEvents.QUICK_ASSIGNEES_UPDATE,
      SocketEvents.TASK_START_DATE_CHANGE,
      SocketEvents.TASK_END_DATE_CHANGE,
      SocketEvents.TASK_STATUS_CHANGE,
      SocketEvents.TASK_TIME_LOG_UPDATED,
      SocketEvents.QUICK_TASK,
      SocketEvents.PROJECT_UPDATES_AVAILABLE,
    ];

    events.forEach(e => socket.on(e.toString(), handler));
    return () => {
      events.forEach(e => socket.off(e.toString(), handler));
      refreshWorkload.current?.cancel();
    };
  }, [socket, dispatch]);
};
