/** Team-scoped room: Owners/Admins viewing the Admin Client Portal. */
export const clientPortalTeamRoomName = (teamId: string) => `client_portal_team:${teamId}`;

/** Client-scoped room: authenticated client users for one client org in a team. */
export const clientPortalClientRoomName = (teamId: string, clientId: string) =>
  `client_portal_client:${teamId}:${clientId}`;

/**
 * One contact inside a client org. Identifier-bearing portal events go here, never to the shared
 * client room, so a contact who cannot see a private approval or request does not learn its ids.
 */
export const clientPortalContactRoomName = (teamId: string, clientId: string, contactId: string) =>
  `client_portal_contact:${teamId}:${clientId}:${contactId}`;

/** String socket events (not numeric enum) so admin + client apps stay in sync without enum drift. */
export const CLIENT_PORTAL_SOCKET = {
  JOIN_ROOM: "client_portal:join_room",
  DATA_UPDATED: "client_portal:data_updated",
} as const;

export type ClientPortalDataUpdatedPayload = {
  teamId: string;
  clientId?: string | null;
  projectId?: string | null;
  /** Matches client notification type or staff kind slug (approval, change_request, …). */
  type: string;
  referenceId?: string | null;
  source: "staff" | "client";
};
