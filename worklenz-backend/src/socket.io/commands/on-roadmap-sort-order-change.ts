import { Server, Socket } from "socket.io";
import db from "../../config/db";
import { SocketEvents } from "../events";

import {log_error, parseSocketPayload} from "../util";

export async function on_roadmap_sort_order_change(_io: Server, socket: Socket, data?: string) {
    try {
        const q = `SELECT handle_task_roadmap_sort_order($1, $2, $3);`;
        const body = parseSocketPayload<any>(data as string);

    if (!body) return;

        socket.emit(SocketEvents.ROADMAP_SORT_ORDER_CHANGE.toString(), {});
        return;
    } catch (error) {
        log_error(error);
    }

    socket.emit(SocketEvents.ROADMAP_SORT_ORDER_CHANGE.toString(), null);
}
