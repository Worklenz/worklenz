import { Server, Socket } from "socket.io";
import { log_error } from "../util";
import db from "../../config/db";
import { SocketEvents } from "../events";

export async function on_pt_task_time_estimation_change(_io: Server, socket: Socket, data?: string) {
    try {
        const q = `UPDATE cpt_tasks SET total_minutes = $2 WHERE id = $1 RETURNING total_minutes;`;
        const body = JSON.parse(data as string);
    
        const hours = body.total_hours || 0;
        const minutes = body.total_minutes || 0;
        const totalMinutes = (hours * 60) + minutes;
    
        const result = await db.query(q, [body.task_id, totalMinutes]);

        const d = {
          id: body.task_id,
          total_time_string: `${hours}h ${minutes}m`
        };

        socket.emit(SocketEvents.PT_TASK_TIME_ESTIMATION_CHANGE.toString(), d);

      } catch (e) {
        log_error(e);
    }
} 