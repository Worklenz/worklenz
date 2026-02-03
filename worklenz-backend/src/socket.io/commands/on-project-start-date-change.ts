import {Server, Socket} from "socket.io";
import db from "../../config/db";
import {SocketEvents} from "../events";
import momentTime from "moment-timezone";

import {log_error} from "../util";

export async function on_project_start_date_change(_io: Server, socket: Socket, data?: string) {
  try {
    const body = JSON.parse(data as string);

    // Use the exact same pattern as tasks - direct assignment
    const q = `UPDATE projects SET start_date = $2 WHERE id = $1 RETURNING start_date;`;
    const result = await db.query(q, [body.project_id, body.start_date]);
    
    const [d] = result.rows;

    const responseDate = d.start_date ? momentTime.utc(d.start_date).format('YYYY-MM-DD') : null;

    socket.emit(SocketEvents.PROJECT_START_DATE_CHANGE.toString(), {
      project_id: body.project_id,
      start_date: responseDate
    });
  } catch (error) {
    console.error('[PROJECT_START_DATE_CHANGE] Error:', error);
    log_error(error);
  }
}