import { Server, Socket } from "socket.io";
import { log_error } from "../util";
import db from "../../config/db";
import { SocketEvents } from "../events";

export async function on_pt_task_end_date_change(_io: Server, socket: Socket, data?: string) {
    try {
        const body = JSON.parse(data as string);

        const q = `UPDATE table_name_here SET end_date = $2 WHERE id = $1 RETURNING end_date`;

        const result = await db.query(q, [body.task_id, body.end_date]);
        const [d] = result.rows;

        // socket.emit(SocketEvents.PT_TASK_END_DATE_CHANGE.toString(), {
        //     id: body.task_id,
        //     parent_task: body.parent_task,
        //     end_date: d.end_date
        // });

    } catch (e) {
        log_error(e);
    }
}