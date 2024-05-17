import {Server, Socket} from "socket.io";
import {log_error} from "../util";
import {SocketEvents} from "../events";
import db from "../../config/db";
import {getColor} from "../../shared/utils";
import TasksControllerV2 from "../../controllers/tasks-controller-v2";

export async function on_join_project_room(_io: Server, socket: Socket, data: { id: string | null; type: string; }) {
  const payload = {...data};
  payload.id = /undefined|null/.test(data.id as string) ? null : payload.id;

  if (!payload.id) return;

  try {
    if (payload.type === "join") {
      await socket.join(payload.id);
    } else {
      await socket.leave(payload.id);
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
