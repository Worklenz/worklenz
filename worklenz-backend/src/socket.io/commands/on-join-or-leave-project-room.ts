import {Server, Socket} from "socket.io";
import {log_error} from "../util";
import {SocketEvents} from "../events";
import db from "../../config/db";
import {getColor} from "../../shared/utils";
import TasksControllerV2 from "../../controllers/tasks-controller-v2";
import {logUnauthorizedSocketAccess, verifyProjectAccessSocket} from "../authorization";

export async function on_join_project_room(_io: Server, socket: Socket, data: { id: string | null; type: string; }) {
  let parsed = data;
  if (typeof data === "string") {
    try {
      parsed = JSON.parse(data);
    } catch {
      return;
    }
  }
  const payload = {...parsed};
  payload.id = /undefined|null/.test(payload.id as string) ? null : payload.id;

  if (!payload.id || typeof payload.id !== "string") return;

  try {
    if (payload.type === "join") {
      const hasAccess = await verifyProjectAccessSocket(socket, payload.id);
      if (!hasAccess) {
        logUnauthorizedSocketAccess(socket, "JOIN_OR_LEAVE_PROJECT_ROOM", "project", payload.id);
        return;
      }
      await socket.join(payload.id);
    } else {
      await socket.leave(payload.id);
      const hasAccess = await verifyProjectAccessSocket(socket, payload.id);
      if (!hasAccess) {
        return;
      }
    }

    const clients = await _io.in(payload.id).fetchSockets();
    const socketIds = clients.map(socket => `'${socket.id}'`).join(`,`);

    if (!socketIds) return;

    const q = `
      SELECT name, avatar_url
      FROM users
      WHERE socket_id IN (${socketIds})
        AND EXISTS(SELECT 1
                   FROM team_members
                   WHERE team_id = (SELECT team_id FROM projects WHERE id = $1)
                     AND user_id = users.id);
    `;

    const result = await db.query(q, [payload.id]);

    const users = result.rows.map((a: { name: string; color_code?: string; }) => {
      a.color_code = getColor(a.name);
      return a;
    });
    const members = TasksControllerV2.createTagList(users);

    socket.emit(SocketEvents.JOIN_OR_LEAVE_PROJECT_ROOM.toString(), members);
    socket.to(payload.id).emit(SocketEvents.JOIN_OR_LEAVE_PROJECT_ROOM.toString(), members);
  } catch (error) {
    log_error(error);
  }
}
