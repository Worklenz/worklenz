import { Server, Socket } from "socket.io";
import { log_error } from "../util";
import db from "../../config/db";
import { SocketEvents } from "../events";

export async function on_pt_name_change(_io: Server, socket: Socket, data?: string) {
    try {
        const body = JSON.parse(data as string);
        const name = (body.template_name || "").trim();

        const q = `UPDATE custom_project_templates SET name = $2 WHERE id = $1 RETURNING name`;

        const result = await db.query(q, [body.template_id, name]);
        const [d] = result.rows;

        socket.emit(SocketEvents.PT_NAME_CHANGE.toString(), {
            template_id: body.template_id,
            template_name: d.name
        });

    } catch (e) {
        log_error(e);
    }
}