import {Server, Socket} from "socket.io";
import db from "../../config/db";
import {SocketEvents} from "../events";
import momentTime from "moment-timezone";

import {log_error} from "../util";
import {logUnauthorizedSocketAccess, verifyProjectAccessSocket} from "../authorization";

export async function on_project_end_date_change(_io: Server, socket: Socket, data?: string) {
  try {
    const body = JSON.parse(data as string);

    const hasAccess = await verifyProjectAccessSocket(socket, body.project_id);
    if (!hasAccess) {
      logUnauthorizedSocketAccess(socket, "PROJECT_END_DATE_CHANGE", "project", body.project_id);
      return;
    }

    // Use the exact same pattern as tasks - direct assignment
    const q = `UPDATE projects SET end_date = $2 WHERE id = $1 RETURNING end_date;`;
    const result = await db.query(q, [body.project_id, body.end_date]);
    
    const [d] = result.rows;

    const responseDate = d.end_date ? momentTime.utc(d.end_date).format('YYYY-MM-DD') : null;

    const payload = {
      project_id: body.project_id,
      end_date: responseDate
    };
    socket.broadcast.to(body.project_id).emit(SocketEvents.PROJECT_END_DATE_CHANGE.toString(), payload);
    socket.emit(SocketEvents.PROJECT_END_DATE_CHANGE.toString(), payload);
  } catch (error) {
    console.error('[PROJECT_END_DATE_CHANGE] Error:', error);
    log_error(error);
  }
}
