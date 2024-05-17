import { Server, Socket } from "socket.io";
import db from "../../config/db";
import { SocketEvents } from "../events";

import { log_error } from "../util";

export async function on_project_category_change(_io: Server, socket: Socket, data?: string) {
    try {
        const body = JSON.parse(data as string);

        const q = `UPDATE projects SET category_id = $2 WHERE id = $1;`;
        await db.query(q, [body.project_id, body.category_id]);

        if (body.is_update) {
            const q2 = "SELECT id, name, color_code FROM project_categories WHERE id = $1;";
            const result = await db.query(q2, [body.category_id]);
            const [d] = result.rows;

            socket.emit(SocketEvents.PROJECT_CATEGORY_CHANGE.toString(), {
                id: body.project_id,
                category_id: d.id,
                category_name: d.name,
                category_color: d.color_code
            });
        } else {
            socket.emit(SocketEvents.PROJECT_CATEGORY_CHANGE.toString(), {
                id: body.project_id,
                category_id: null,
                category_name: null,
                category_color: null
            });
        }

    } catch (error) {
        log_error(error);
    }
}