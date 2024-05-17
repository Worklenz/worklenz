import { Server, Socket } from "socket.io";
import { log_error } from "../util";
import db from "../../config/db";
import { SocketEvents } from "../events";

export async function on_pt_task_name_change(_io: Server, socket: Socket, data?: string) {
    try {
        const body = JSON.parse(data as string);
        const name = (body.name || "").trim();

        const q = `UPDATE cpt_tasks SET name = $2 WHERE id = $1 RETURNING name`;

        const result = await db.query(q, [body.task_id, name]);
        const [d] = result.rows;

        socket.emit(SocketEvents.PT_TASK_NAME_CHANGE.toString(), {
            id: body.task_id,
            parent_task: body.parent_task,
            name: d.name
        });

    } catch (e) {
        log_error(e);
    }
}