import {Server, Socket} from "socket.io";
import db from "../../config/db";
import {SocketEvents} from "../events";

import {log_error} from "../util";

export async function on_project_status_change(_io: Server, socket: Socket, data?: string) {
  try {
    const body = JSON.parse(data as string);

    const q = `UPDATE projects SET status_id = $2 WHERE id = $1;`;
    await db.query(q, [body.project_id, body.status_id]);

    const q2 = "SELECT id,name,color_code,icon FROM sys_project_statuses WHERE id=$1";
    const result = await db.query(q2, [body.status_id]);
    const [d] = result.rows;

    socket.emit(SocketEvents.PROJECT_STATUS_CHANGE.toString(), {
      id: body.project_id,
      status: d.id,
      status_icon: d.icon,
      status_color: d.color_code,
      status_name: d.name
    });
  } catch (error) {
    log_error(error);
  }
}