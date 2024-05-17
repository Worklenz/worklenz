import { Server, Socket } from "socket.io";
import { log_error } from "../util";
import db from "../../config/db";
import { PriorityColorCodes, TASK_PRIORITY_COLOR_ALPHA } from "../../shared/constants";
import { SocketEvents } from "../events";

export async function on_pt_task_priority_change(_io: Server, socket: Socket, data?: string) {
    try {
        const body = JSON.parse(data as string);

        const q = `UPDATE cpt_tasks SET priority_id = $2 WHERE id = $1`;

        await db.query(q, [body.task_id, body.priority_id]);

        const q2 = `SELECT value FROM task_priorities WHERE id = $1`;
        const result = await db.query(q2, [body.priority_id]);
        const [d] = result.rows;

        d.color_code = (PriorityColorCodes[d.value] || PriorityColorCodes["0"]) + TASK_PRIORITY_COLOR_ALPHA;

        socket.emit(SocketEvents.PT_TASK_PRIORITY_CHANGE.toString(), {
            id: body.task_id,
            parent_task: body.parent_task,
            color_code: d.color_code,
            priority_id: body.priority_id
        });

    } catch (e) {
        log_error(e);
    }
}