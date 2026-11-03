import { Server, Socket } from "socket.io";
import db from "../../../config/db";
import { IPassportSession } from "../../../interfaces/passport-session";
import { ISocketSession } from "../../../interfaces/socket-session";
import TokenService from "../../../services/token-service";
import { normalizeTeamRoleName, TEAM_ROLE_NAMES } from "../../../shared/team-permissions";
import { logUnauthorizedSocketAccess } from "../../authorization";
import {
  CLIENT_PORTAL_SOCKET,
  clientPortalClientRoomName,
  clientPortalTeamRoomName,
} from "../../client-portal-room";
import { log_error } from "../../util";

type JoinPayload = {
  type?: "join" | "leave";
  /** Present for client-portal app connections (v2 JWT). Staff use the session. */
  token?: string;
};

/**
 * Joins/leaves Client Portal realtime rooms.
 * - Staff (passport session): team room for Owners/Admins of the active team.
 * - Client (handshake/auth token): client room for their current team + client org.
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
  const room = clientPortalClientRoomName(teamId, clientId);

  if (action === "leave") {
    await socket.leave(room);
    return;
  }

  // Confirm the client org still belongs to this team and the contact is active.
  const result = await db.query(
    `SELECT 1
       FROM clients c
       JOIN client_contacts cc ON cc.client_id = c.id AND cc.team_id = c.team_id
       JOIN client_users cu ON cu.id = cc.client_user_id AND cu.status = 'active'
      WHERE c.id = $1
        AND c.team_id = $2
        AND cc.disabled_at IS NULL
        AND ($3::uuid IS NULL OR cu.id = $3)
      LIMIT 1`,
    [clientId, teamId, payload.clientUserId ?? null]
  );

  if (result.rows.length === 0) {
    await socket.leave(room);
    logUnauthorizedSocketAccess(socket, CLIENT_PORTAL_SOCKET.JOIN_ROOM, "client_portal", clientId);
    return;
  }

  (socket as Socket & { user?: Record<string, unknown> }).user = {
    id: payload.clientUserId ?? clientId,
    type: "client",
    clientId,
    teamId,
    email: payload.email,
  };

  await socket.join(room);
}
