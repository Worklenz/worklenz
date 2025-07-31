import { Server, Socket } from "socket.io";
import { log_error } from "../util";
import db from "../../config/db";
import sanitize from "sanitize-html";
import { SocketEvents } from "../events";

export async function on_pt_task_description_change(_io: Server, socket: Socket, data?: string) {
    try {
        const body = JSON.parse(data as string);

        const q = `UPDATE cpt_tasks SET description = $2 WHERE id = $1 RETURNING description`;

        const description = (body.description || "").replace(/(^([ ]*<p><br><\/p>)*)|((<p><br><\/p>)*[ ]*$)/gi, "").trim() || null;
        await db.query(q, [body.task_id, sanitize(description)]);

        socket.emit(SocketEvents.PT_TASK_DESCRIPTION_CHANGE.toString(), {
            id: body.task_id,
            description
        });

    } catch (e) {
        log_error(e);
    }
}