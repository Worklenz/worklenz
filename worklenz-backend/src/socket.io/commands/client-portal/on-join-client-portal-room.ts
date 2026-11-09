import { Server, Socket } from "socket.io";
import db from "../../../config/db";
import { IPassportSession } from "../../../interfaces/passport-session";
import { ISocketSession } from "../../../interfaces/socket-session";
import { loadClientSubject } from "../../../services/client-portal-v2/subject";
import TokenService from "../../../services/token-service";
import { normalizeTeamRoleName, TEAM_ROLE_NAMES } from "../../../shared/team-permissions";
import { logUnauthorizedSocketAccess } from "../../authorization";
import {
  CLIENT_PORTAL_SOCKET,
  clientPortalClientRoomName,
  clientPortalContactRoomName,
  clientPortalTeamRoomName,
} from "../../client-portal-room";
import { log_error } from "../../util";

interface ClientSocketUser {
  id: string;
  type: "client";
  clientId: string;
  teamId: string;
  email?: string;
  contactId: string;
  clientUserId: string;
}

type ClientSocket = Socket & { user?: ClientSocketUser };

type JoinPayload = {
  type?: "join" | "leave";
  /** Present for client-portal app connections (v2 JWT). Staff use the session. */
  token?: string;
};

/**
 * Joins/leaves Client Portal realtime rooms.
 * - Staff (passport session): team room for Owners/Admins of the active team.
 * - Client (handshake/auth token): client room and their own contact room, after the same
 *   access checks HTTP authentication makes (identified contact, organization access, active subject).
 */
export async function on_join_client_portal_room(
  _io: Server,
  socket: Socket,
  data: JoinPayload | string
) {
  let parsed: JoinPayload = {};
  try {
    parsed = typeof data === "string" ? JSON.parse(data) : data ?? {};
  } catch {
    return;
  }

  const action = parsed.type === "leave" ? "leave" : "join";

  try {
    const clientToken =
      parsed.token ||
      (socket.handshake.auth?.type === "client" ? (socket.handshake.auth.token as string) : null);

    if (clientToken) {
      await handleClientRoom(socket, clientToken, action);
      return;
    }

    await handleStaffRoom(socket, action);
  } catch (error) {
    log_error(error);
  }
}

async function handleStaffRoom(socket: Socket, action: "join" | "leave") {
  const user = (socket.request as ISocketSession).session?.passport?.user as
    | IPassportSession
    | undefined;
  const teamId = user?.team_id;
  if (!user?.id || !teamId) return;

  const room = clientPortalTeamRoomName(teamId);

  if (action === "leave") {
    await socket.leave(room);
    return;
  }

  const result = await db.query(
    `SELECT t.user_id AS owner_id,
            m.role_name,
            COALESCE(m.admin_role, FALSE) AS admin_role
       FROM teams t
       LEFT JOIN LATERAL (SELECT r.name AS role_name, r.admin_role
                            FROM team_members tm
                            JOIN roles r ON r.id = tm.role_id
                           WHERE tm.team_id = t.id
                             AND tm.user_id = $2
                             AND tm.active IS TRUE
                           LIMIT 1) m ON TRUE
      WHERE t.id = $1;`,
    [teamId, user.id]
  );
  const row = result.rows[0];
  const orgOwnerId = row?.owner_id;
  if (!orgOwnerId) return;

  const roleName = row.role_name ? normalizeTeamRoleName(row.role_name) : null;
  const isOwnerOrAdmin =
    orgOwnerId === user.id ||
    row.admin_role === true ||
    roleName === TEAM_ROLE_NAMES.OWNER ||
    roleName === TEAM_ROLE_NAMES.ADMIN;

  if (!isOwnerOrAdmin) {
    await socket.leave(room);
    logUnauthorizedSocketAccess(socket, CLIENT_PORTAL_SOCKET.JOIN_ROOM, "client_portal", teamId);
    return;
  }

  await socket.join(room);
}

async function handleClientRoom(socket: Socket, token: string, action: "join" | "leave") {
  const payload = TokenService.verifyClientToken(token);
  if (!payload?.clientId || !payload.organizationId) {
    socket.emit("error", { message: "Invalid client token" });
    return;
  }

  const teamId = payload.organizationId;
  const clientId = payload.clientId;

  if (action === "leave") {
    await leaveClientPortalRooms(socket, teamId, clientId);
    return;
  }

  // The token is identity only. The same checks HTTP auth makes on every request decide whether this
  // socket may sit in a room: an identified contact, current organization access, and an active subject
  // (organization status/deleted_at, login deleted_at, contact activated_at).
  const clientUserId = payload.clientUserId;
  if (!clientUserId) {
    await rejectClientJoin(socket, teamId, clientId);
    return;
  }

  const hasOrganizationAccess = await TokenService.hasOrganizationAccess(clientUserId, teamId);
  if (!hasOrganizationAccess) {
    await rejectClientJoin(socket, teamId, clientId);
    return;
  }

  const subject = await loadClientSubject(db, { clientUserId, clientId, teamId, requirePortalAccess: true });
  if (!subject?.contactId) {
    await rejectClientJoin(socket, teamId, clientId);
    return;
  }

  (socket as ClientSocket).user = {
    id: clientUserId,
    type: "client",
    clientId,
    teamId,
    email: payload.email,
    contactId: subject.contactId,
    clientUserId,
  };

  await socket.join(clientPortalClientRoomName(teamId, clientId));
  await socket.join(clientPortalContactRoomName(teamId, clientId, subject.contactId));
}

async function rejectClientJoin(socket: Socket, teamId: string, clientId: string) {
  await leaveClientPortalRooms(socket, teamId, clientId);
  logUnauthorizedSocketAccess(socket, CLIENT_PORTAL_SOCKET.JOIN_ROOM, "client_portal", clientId);
}

/** Drops the shared client room and any per-contact room this socket joined for that org. */
async function leaveClientPortalRooms(socket: Socket, teamId: string, clientId: string) {
  await socket.leave(clientPortalClientRoomName(teamId, clientId));

  const contactId = (socket as ClientSocket).user?.contactId;
  if (contactId) {
    await socket.leave(clientPortalContactRoomName(teamId, clientId, contactId));
  }

  const rooms = socket.rooms;
  if (!rooms) return;
  const prefix = `client_portal_contact:${teamId}:${clientId}:`;
  for (const name of [...rooms]) {
    if (name.startsWith(prefix)) {
      await socket.leave(name);
    }
  }
}
