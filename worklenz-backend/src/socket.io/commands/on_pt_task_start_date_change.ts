import { Server, Socket } from "socket.io";
import { log_error } from "../util";
import db from "../../config/db";
import { SocketEvents } from "../events";

export async function on_pt_task_start_date_change(_io: Server, socket: Socket, data?: string) {
    try {
        const body = JSON.parse(data as string);
        
        const q = `UPDATE tasks SET start_date = $2 WHERE id = $1 RETURNING start_date, end_date`;

        const result = await db.query(q, [body.task_id, body.start_date]);
        const [d] = result.rows;
        
        // socket.emit(SocketEvents.PT_TASK_START_DATE_CHANGE.toString(), {
        //     id: body.task_id,
        //     start_date: d.start_date,
        //     parent_task: body.parent_task,
        // });

    } catch (e) {
        log_error(e);
    }
}