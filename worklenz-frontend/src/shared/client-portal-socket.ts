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
