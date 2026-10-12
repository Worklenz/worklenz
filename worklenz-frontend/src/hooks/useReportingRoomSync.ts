import { useEffect } from 'react';
import { useSocket } from '@/socket/socketContext';
import { SocketEvents } from '@/shared/socket-events';

/**
 * Joins the org-scoped reporting room (owner/admin only; the server verifies the role)
 * so project date/status broadcasts reach components that do not render the project
 * rows themselves (e.g. the reporting overview stat cards). Re-joins on reconnect and
 * leaves on unmount.
 */
export const useReportingRoomSync = () => {
  const { socket } = useSocket();

  useEffect(() => {
    if (!socket) return;
    const event = SocketEvents.JOIN_OR_LEAVE_REPORTING_ROOM.toString();
    const join = () => socket.emit(event, { type: 'join' });

    join();
    socket.on('connect', join);
    return () => {
      socket.off('connect', join);
      socket.emit(event, { type: 'leave' });
    };
  }, [socket]);
};
