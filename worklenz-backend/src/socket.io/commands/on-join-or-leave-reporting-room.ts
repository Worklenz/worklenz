import {Server, Socket} from "socket.io";
import db from "../../config/db";
import {log_error} from "../util";
import {ISocketSession} from "../../interfaces/socket-session";
import {IPassportSession} from "../../interfaces/passport-session";
import {getEffectiveTeamRole, TEAM_ROLE_NAMES} from "../../shared/team-permissions";
import {logUnauthorizedSocketAccess} from "../authorization";
import {reportingRoomName} from "../reporting-room";

/**
 * Joins/leaves the org-scoped reporting room. Mirrors the access rule of
 * GET /reporting/overview/statistics (team owner or admin), so only users who may
 * read the overview can receive its updates.
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

    const result = await db.query("SELECT user_id FROM teams WHERE id = $1;", [teamId]);
    const orgOwnerId = result.rows[0]?.user_id;
    if (!orgOwnerId) return;
    const room = reportingRoomName(orgOwnerId);

    if (parsed.type !== "join") {
      await socket.leave(room);
      return;
    }

    const role = getEffectiveTeamRole(user);
    if (role !== TEAM_ROLE_NAMES.OWNER && role !== TEAM_ROLE_NAMES.ADMIN) {
      logUnauthorizedSocketAccess(socket, "JOIN_OR_LEAVE_REPORTING_ROOM", "reporting", teamId);
      return;
    }
    await socket.join(room);
  } catch (error) {
    log_error(error);
  }
}
