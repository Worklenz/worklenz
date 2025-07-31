import {Server, Socket} from "socket.io";
import db from "../../config/db";
import {SocketEvents} from "../events";

import {log_error} from "../util";

export async function on_project_health_change(_io: Server, socket: Socket, data?: string) {
  try {
    const body = JSON.parse(data as string);

    const q = `UPDATE projects SET health_id = $2 WHERE id = $1;`;
    await db.query(q, [body.project_id, body.health_id]);

    const q2 = "SELECT color_code, name FROM sys_project_healths WHERE id=$1";
    const result = await db.query(q2, [body.health_id]);
    const [d] = result.rows;

    socket.emit(SocketEvents.PROJECT_HEALTH_CHANGE.toString(), {
      id: body.project_id,
      color_code: d.color_code,
      name: d.name,
      health_id: body.health_id
    });
  } catch (error) {
    log_error(error);
  }
}
