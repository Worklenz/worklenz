import { Server, Socket } from "socket.io";
import { log_error } from "../util";
import db from "../../config/db";
import { SocketEvents } from "../events";
import { body } from "express-validator";

export async function on_task_billable_change(_io: Server, socket: Socket, data?: {task_id?: string, billable?: boolean}) {
    if (!data?.task_id || (typeof data.billable != "boolean")) return;
    try {
        const q = `UPDATE tasks SET billable = $2 WHERE id = $1`;

        await db.query(q, [data?.task_id, data?.billable]);

        socket.emit(SocketEvents.TASK_BILLABLE_CHANGE.toString(), {
            id: data?.task_id
        });

    } catch (e) {
        log_error(e);
    }
}