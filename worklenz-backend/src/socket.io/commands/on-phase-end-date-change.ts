import {Server, Socket} from "socket.io";
import db from "../../config/db";
import {SocketEvents} from "../events";

import {log_error} from "../util";
import {verifyPhaseAccessSocket, logUnauthorizedSocketAccess} from "../authorization";

export async function on_phase_end_date_change(_io: Server, socket: Socket, data?: string) {
    try {
        const body = JSON.parse(data as string);
        
        const hasAccess = await verifyPhaseAccessSocket(socket, body.phase_id);
        if (!hasAccess) {
            logUnauthorizedSocketAccess(socket, 'PHASE_END_DATE_CHANGE', 'phase', body.phase_id);
            return;
        }
        
        const q = `UPDATE project_phases
                   SET end_date = $2
                   WHERE id = $1
                   RETURNING start_date, end_date;`;
        const result = await db.query(q, [body.phase_id, body.end_date]);
    
        const [d] = result.rows;
        socket.emit(SocketEvents.PHASE_END_DATE_CHANGE.toString(), {
            phase_id: body.phase_id,
            end_date: d.end_date
        });
    
        return;
      } catch (error) {
        log_error(error);
      }
    
      socket.emit(SocketEvents.PHASE_END_DATE_CHANGE.toString(), null);
}