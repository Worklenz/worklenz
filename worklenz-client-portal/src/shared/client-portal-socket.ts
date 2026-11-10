/** String socket events shared with the backend Client Portal realtime channel. */
export const CLIENT_PORTAL_SOCKET = {
  JOIN_ROOM: 'client_portal:join_room',
  DATA_UPDATED: 'client_portal:data_updated',
} as const;

export interface ClientPortalDataUpdatedPayload {
  teamId: string;
  clientId?: string | null;
  projectId?: string | null;
  type: string;
  referenceId?: string | null;
  source: 'staff' | 'client';
}

/** Socket server URL derived from the API base (http→ws / https→wss). */
export const getClientPortalSocketUrl = (): string => {
  if (import.meta.env.VITE_SOCKET_URL) {
    return import.meta.env.VITE_SOCKET_URL;
  }

  const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api/client-portal';
  try {
    const url = new URL(apiBase);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    url.pathname = '';
    url.search = '';
    url.hash = '';
    return url.toString().replace(/\/$/, '');
  } catch {
    return 'ws://localhost:3000';
  }
};
