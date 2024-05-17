import {Server, Socket} from "socket.io";
import db from "../../config/db";
import {SocketEvents} from "../events";

import {log_error} from "../util";

export async function on_phase_start_date_change(_io: Server, socket: Socket, data?: string) {
    try {
        const q = `UPDATE project_phases
                   SET start_date = $2
                   WHERE id = $1
                   RETURNING start_date, end_date;`;
        const body = JSON.parse(data as string);
        const result = await db.query(q, [body.phase_id, body.start_date]);
    
        const [d] = result.rows;
        socket.emit(SocketEvents.PHASE_START_DATE_CHANGE.toString(), {
            phase_id: body.phase_id,
            start_date: d.start_date
        });
    
        return;
      } catch (error) {
        log_error(error);
      }
    
      socket.emit(SocketEvents.PHASE_START_DATE_CHANGE.toString(), null);
}