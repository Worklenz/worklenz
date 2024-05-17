import { Server, Socket } from "socket.io";
import db from "../../config/db";
import { SocketEvents } from "../events";

import { log_error } from "../util";

export async function on_roadmap_sort_order_change(_io: Server, socket: Socket, data?: string) {
    try {
        const q = `SELECT handle_task_roadmap_sort_order($1, $2, $3);`;
        const body = JSON.parse(data as string);

        await db.query(q, [body.from_index, body.to_index, body.task_id]);

        socket.emit(SocketEvents.ROADMAP_SORT_ORDER_CHANGE.toString(), {});
        return;
    } catch (error) {
        log_error(error);
    }

    socket.emit(SocketEvents.ROADMAP_SORT_ORDER_CHANGE.toString(), null);
}
