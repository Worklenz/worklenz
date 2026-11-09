import { useEffect, useRef } from 'react';
import debounce from 'lodash-es/debounce';
import { useSocket } from '@/socket/socketContext';
import { clientPortalApi } from '@/api/client-portal/client-portal-api';
import {
  CLIENT_PORTAL_SOCKET,
  type ClientPortalDataUpdatedPayload,
} from '@/shared/client-portal-socket';
import { SocketEvents } from '@/shared/socket-events';
import type { IWorklenzNotification } from '@/types/notifications/notifications.types';
import { useAppDispatch } from './useAppDispatch';

type PortalTag =
  | 'Approvals'
  | 'ChangeRequests'
  | 'PortalCounts'
  | 'PortalProjects'
  | 'PortalOverview'
  | 'Threads'
  | 'PortalFiles'
  | 'AuditLog'
  | 'Notifications'
  | 'Milestones'
  | 'PortalTasks'
  | 'PortalClientUsers';

const ALL_PORTAL_TAGS: PortalTag[] = [
  'Approvals',
  'ChangeRequests',
  'PortalCounts',
  'PortalProjects',
  'PortalOverview',
  'Threads',
  'PortalFiles',
  'AuditLog',
  'Notifications',
  'Milestones',
  'PortalTasks',
  'PortalClientUsers',
];

const tagsForType = (type: string): PortalTag[] => {
  switch (type) {
    case 'approval':
      return ['Approvals', 'PortalCounts', 'PortalProjects', 'PortalOverview', 'AuditLog'];
    case 'change_request':
      return ['ChangeRequests', 'PortalCounts', 'PortalProjects', 'PortalOverview', 'Threads', 'AuditLog'];
    case 'discussion':
      return ['Threads', 'PortalCounts', 'ChangeRequests'];
    case 'file':
      return ['PortalFiles', 'PortalCounts', 'PortalProjects'];
    case 'milestone':
      return ['Milestones', 'PortalProjects', 'PortalOverview', 'PortalCounts'];
    case 'access':
      return ['PortalProjects', 'PortalOverview', 'PortalCounts', 'AuditLog', 'PortalClientUsers'];
    case 'project_update':
      return ['PortalProjects', 'PortalOverview', 'PortalCounts', 'AuditLog'];
    default:
      return ALL_PORTAL_TAGS;
  }
};

/** Map staff notification_type_key → portal list tags (toast path already delivers these). */
const tagsForNotificationKey = (key?: string): PortalTag[] | null => {
  if (!key?.startsWith('CLIENT_PORTAL_')) return null;
  switch (key) {
    case 'CLIENT_PORTAL_APPROVAL':
      return tagsForType('approval');
    case 'CLIENT_PORTAL_CHANGE_REQUEST':
      return tagsForType('change_request');
    case 'CLIENT_PORTAL_COMMENT':
      return tagsForType('discussion');
    case 'CLIENT_PORTAL_FILE':
      return tagsForType('file');
    case 'CLIENT_PORTAL_ACCESS':
      return tagsForType('access');
    case 'CLIENT_PORTAL_PROJECT':
      return tagsForType('project_update');
    default:
      return ALL_PORTAL_TAGS;
  }
};

/**
 * Joins the Admin Client Portal team socket room and invalidates RTK portal tags when
 * either side mutates portal data (approvals, change requests, …).
 *
 * Also listens to NOTIFICATIONS_UPDATE for CLIENT_PORTAL_* keys — that is the same
 * direct-socket path that shows the toast, so the list refreshes even if room join failed.
 */
export const useClientPortalRealtimeSync = () => {
  const { socket } = useSocket();
  const dispatch = useAppDispatch();
  const pendingTags = useRef<Set<PortalTag>>(new Set());
  const flush = useRef<ReturnType<typeof debounce> | null>(null);
  const hasConnected = useRef(false);

  useEffect(() => {
    if (!flush.current) {
      flush.current = debounce(() => {
        if (pendingTags.current.size === 0) return;
        const tags = Array.from(pendingTags.current);
        pendingTags.current.clear();
        dispatch(clientPortalApi.util.invalidateTags(tags));
      }, 200);
    }

    if (!socket) return;

    const queueInvalidate = (tags: PortalTag[]) => {
      tags.forEach(tag => pendingTags.current.add(tag));
      flush.current?.();
    };

    const join = () => {
      socket.emit(CLIENT_PORTAL_SOCKET.JOIN_ROOM, { type: 'join' });
    };

    const handleConnect = () => {
      join();
      if (hasConnected.current) queueInvalidate(ALL_PORTAL_TAGS);
      hasConnected.current = true;
    };

    const handleDataUpdated = (payload: ClientPortalDataUpdatedPayload) => {
      queueInvalidate(payload?.type ? tagsForType(payload.type) : ALL_PORTAL_TAGS);
    };

    const handleNotification = (notification: IWorklenzNotification) => {
      const tags = tagsForNotificationKey(notification?.notification_type_key);
      if (tags) queueInvalidate(tags);
    };

    if (socket.connected) hasConnected.current = true;
    join();
    socket.on('connect', handleConnect);
    socket.on(CLIENT_PORTAL_SOCKET.DATA_UPDATED, handleDataUpdated);
    socket.on(SocketEvents.NOTIFICATIONS_UPDATE.toString(), handleNotification);

    return () => {
      socket.off('connect', handleConnect);
      socket.off(CLIENT_PORTAL_SOCKET.DATA_UPDATED, handleDataUpdated);
      socket.off(SocketEvents.NOTIFICATIONS_UPDATE.toString(), handleNotification);
      if (socket.connected) {
        socket.emit(CLIENT_PORTAL_SOCKET.JOIN_ROOM, { type: 'leave' });
      }
      flush.current?.cancel();
      pendingTags.current.clear();
    };
  }, [socket, dispatch]);
};
