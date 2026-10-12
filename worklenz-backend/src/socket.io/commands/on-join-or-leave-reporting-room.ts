import {Server, Socket} from "socket.io";
import db from "../../config/db";
import {log_error} from "../util";
import {ISocketSession} from "../../interfaces/socket-session";
import {IPassportSession} from "../../interfaces/passport-session";
import {normalizeTeamRoleName, TEAM_ROLE_NAMES} from "../../shared/team-permissions";
import {logUnauthorizedSocketAccess} from "../authorization";
import {reportingRoomName} from "../reporting-room";

/**
 * Joins/leaves the org-scoped reporting room. Mirrors the access rule of
 * GET /reporting/overview/statistics (team owner or admin), so only users who may
 * read the overview can receive its updates. Access is checked against the current
 * team membership in the database, not the session snapshot, so a demoted or removed
 * member cannot (re)join and is evicted from the room.
 */
export async function on_join_or_leave_reporting_room(_io: Server, socket: Socket, data: { type: string } | string) {
  let parsed: { type?: string } = {};
  try {
    parsed = typeof data === "string" ? JSON.parse(data) : data;
  } catch {
    return;
  }

  try {
    const user = (socket.request as ISocketSession).session?.passport?.user as IPassportSession | undefined;
    const teamId = user?.team_id;
    if (!user?.id || !teamId) return;

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
    const room = reportingRoomName(orgOwnerId);

    if (parsed.type !== "join") {
      await socket.leave(room);
      return;
    }

    const roleName = row.role_name ? normalizeTeamRoleName(row.role_name) : null;
    const isOwnerOrAdmin =
      orgOwnerId === user.id ||
      row.admin_role === true ||
      roleName === TEAM_ROLE_NAMES.OWNER ||
      roleName === TEAM_ROLE_NAMES.ADMIN;
    if (!isOwnerOrAdmin) {
      await socket.leave(room);
      logUnauthorizedSocketAccess(socket, "JOIN_OR_LEAVE_REPORTING_ROOM", "reporting", teamId);
      return;
    }
    await socket.join(room);
  } catch (error) {
    log_error(error);
  }
}
