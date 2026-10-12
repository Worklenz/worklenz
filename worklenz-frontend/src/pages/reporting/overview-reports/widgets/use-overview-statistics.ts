import { useCallback, useEffect, useRef, useState } from 'react';
import { reportingApiService } from '@/api/reporting/reporting.api.service';
import { IRPTOverviewStatistics } from '@/types/reporting/reporting.types';
import { useSocket } from '@/socket/socketContext';
import { SocketEvents } from '@/shared/socket-events';

/**
 * One fetch of the Overview statistics payload, shared by every KPI widget via OverviewDataContext
 * (see OverviewDataProvider) instead of each widget fetching it independently. Socket events that
 * used to live in overview-stats.tsx are consolidated here so every KPI tile refreshes together.
 */
export const useOverviewStatistics = (includeArchivedProjects: boolean) => {
  const [stats, setStats] = useState<IRPTOverviewStatistics>({});
  const [loading, setLoading] = useState(false);
  const { socket } = useSocket();
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const getOverviewStats = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const { done, body } = await reportingApiService.getOverviewStatistics(includeArchivedProjects);
        if (done) setStats(body);
      } catch (error) {
        console.error('Failed to fetch overview statistics:', error);
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [includeArchivedProjects]
  );

  useEffect(() => {
    getOverviewStats();
  }, [getOverviewStats]);

  const handleSocketUpdate = useCallback(() => {
    if (updateTimeoutRef.current) clearTimeout(updateTimeoutRef.current);
    updateTimeoutRef.current = setTimeout(() => getOverviewStats(true), 150);
  }, [getOverviewStats]);

  useEffect(() => {
    if (!socket) return;

    socket.on(SocketEvents.PROJECT_END_DATE_CHANGE.toString(), handleSocketUpdate);
    socket.on(SocketEvents.PROJECT_START_DATE_CHANGE.toString(), handleSocketUpdate);
    socket.on(SocketEvents.PROJECT_STATUS_CHANGE.toString(), handleSocketUpdate);
    socket.on(SocketEvents.PROJECT_DATA_CHANGE.toString(), handleSocketUpdate);
    socket.on(SocketEvents.PROJECT_UPDATES_AVAILABLE.toString(), handleSocketUpdate);
    socket.on(SocketEvents.TASK_END_DATE_CHANGE.toString(), handleSocketUpdate);
    socket.on(SocketEvents.TASK_STATUS_CHANGE.toString(), handleSocketUpdate);

    return () => {
      socket.off(SocketEvents.PROJECT_END_DATE_CHANGE.toString(), handleSocketUpdate);
      socket.off(SocketEvents.PROJECT_START_DATE_CHANGE.toString(), handleSocketUpdate);
      socket.off(SocketEvents.PROJECT_STATUS_CHANGE.toString(), handleSocketUpdate);
      socket.off(SocketEvents.PROJECT_DATA_CHANGE.toString(), handleSocketUpdate);
      socket.off(SocketEvents.PROJECT_UPDATES_AVAILABLE.toString(), handleSocketUpdate);
      socket.off(SocketEvents.TASK_END_DATE_CHANGE.toString(), handleSocketUpdate);
      socket.off(SocketEvents.TASK_STATUS_CHANGE.toString(), handleSocketUpdate);
    };
  }, [socket, handleSocketUpdate]);

  useEffect(() => {
    return () => {
      if (updateTimeoutRef.current) clearTimeout(updateTimeoutRef.current);
    };
  }, []);

  return { stats, loading };
};
