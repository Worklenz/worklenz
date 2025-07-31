import {Server, Socket} from "socket.io";
import db from "../../config/db";
import {SocketEvents} from "../events";

import {log_error} from "../util";

export async function on_project_end_date_change(_io: Server, socket: Socket, data?: string) {
  try {
    const body = JSON.parse(data as string);

    const q = `UPDATE projects SET end_date = $2 WHERE id = $1 RETURNING end_date;`;
    await db.query(q, [body.project_id, body.end_date]);

    socket.emit(SocketEvents.PROJECT_END_DATE_CHANGE.toString(), {
      id: body.project_id,
      end_date: body.end_date
    });
  } catch (error) {
    log_error(error);
  }
}