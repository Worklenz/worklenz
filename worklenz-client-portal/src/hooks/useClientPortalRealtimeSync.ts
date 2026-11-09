import { useEffect, useRef } from 'react';
import { useDispatch } from 'react-redux';
import { useSocket } from '@/socket/socketContext';
import { clientPortalV2Api } from '@/store/api-v2';
import {
  CLIENT_PORTAL_SOCKET,
  type ClientPortalDataUpdatedPayload,
} from '@/shared/client-portal-socket';
import { useAppSelector } from '@/hooks/useAppSelector';

type V2Tag =
  | 'V2Dashboard'
  | 'V2Projects'
  | 'V2Approvals'
  | 'V2ChangeRequests'
  | 'V2Threads'
  | 'V2Notifications'
  | 'V2Files'
  | 'V2Milestones'
  | 'V2Tasks';

const ALL_TAGS: V2Tag[] = [
  'V2Dashboard',
  'V2Projects',
  'V2Approvals',
  'V2ChangeRequests',
  'V2Threads',
  'V2Notifications',
  'V2Files',
  'V2Milestones',
  'V2Tasks',
];

const tagsForType = (type: string): V2Tag[] => {
  switch (type) {
    case 'approval':
      return ['V2Approvals', 'V2Dashboard', 'V2Notifications', 'V2Projects'];
    case 'change_request':
      return ['V2ChangeRequests', 'V2Dashboard', 'V2Notifications', 'V2Projects', 'V2Threads'];
    case 'discussion':
      return ['V2Threads', 'V2Notifications', 'V2ChangeRequests'];
    case 'file':
      return ['V2Files', 'V2Notifications', 'V2Projects'];
    case 'milestone':
      return ['V2Milestones', 'V2Projects', 'V2Dashboard', 'V2Notifications'];
    case 'project_update':
    case 'access':
      return ['V2Projects', 'V2Dashboard', 'V2Notifications'];
    default:
      return ALL_TAGS;
  }
};

/**
 * Joins the client portal socket room and invalidates v2 RTK tags when staff (or another
 * client user) mutates portal data.
 */
export const useClientPortalRealtimeSync = () => {
  const { socket } = useSocket();
  const dispatch = useDispatch();
  const token = useAppSelector(state => state.auth.token);
  const pending = useRef<Set<V2Tag>>(new Set());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasConnected = useRef(false);

  useEffect(() => {
    if (!socket || !token) return;

    const flush = () => {
      if (pending.current.size === 0) return;
      const tags = Array.from(pending.current);
      pending.current.clear();
      dispatch(clientPortalV2Api.util.invalidateTags(tags));
    };

    const queue = (tags: V2Tag[]) => {
      tags.forEach(tag => pending.current.add(tag));
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(flush, 200);
    };

    const join = () => {
      socket.emit(CLIENT_PORTAL_SOCKET.JOIN_ROOM, { type: 'join', token });
    };

    const handleConnect = () => {
      join();
      // Events emitted while disconnected are lost. Refetch active queries after a reconnect.
      if (hasConnected.current) queue(ALL_TAGS);
      hasConnected.current = true;
    };

    const handleDataUpdated = (payload: ClientPortalDataUpdatedPayload) => {
      queue(payload?.type ? tagsForType(payload.type) : ALL_TAGS);
      // Open detail drawers provide `{ type: 'V2ChangeRequests'|'V2Approvals', id }`.
      if (payload?.referenceId && payload.type === 'change_request') {
        dispatch(clientPortalV2Api.util.invalidateTags([{ type: 'V2ChangeRequests', id: payload.referenceId }]));
      }
      if (payload?.referenceId && payload.type === 'approval') {
        dispatch(clientPortalV2Api.util.invalidateTags([{ type: 'V2Approvals', id: payload.referenceId }]));
      }
    };

    if (socket.connected) hasConnected.current = true;
    join();
    socket.on('connect', handleConnect);
    socket.on(CLIENT_PORTAL_SOCKET.DATA_UPDATED, handleDataUpdated);

    return () => {
      socket.off('connect', handleConnect);
      socket.off(CLIENT_PORTAL_SOCKET.DATA_UPDATED, handleDataUpdated);
      if (socket.connected) {
        socket.emit(CLIENT_PORTAL_SOCKET.JOIN_ROOM, { type: 'leave', token });
      }
      if (timer.current) clearTimeout(timer.current);
      pending.current.clear();
    };
  }, [socket, token, dispatch]);
};
