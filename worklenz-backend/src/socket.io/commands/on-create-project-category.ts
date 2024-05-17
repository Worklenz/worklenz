import { Server, Socket } from "socket.io";
import db from "../../config/db";
import { SocketEvents } from "../events";

import { log_error } from "../util";
import { getColor } from "../../shared/utils";

export async function on_create_project_category(_io: Server, socket: Socket, data?: string) {
    try {
        const body = JSON.parse(data as string);

        const q = `
                    INSERT INTO project_categories (name, team_id, created_by, color_code)
                    VALUES ($1, $2, $3, $4)
                    RETURNING id, name, color_code;
                    `;
        const result = await db.query(q, [body.name, body.team_id, body.user_id, body.name ? getColor(body.name) : null]);
        const [d] = result.rows;

        socket.emit(SocketEvents.CREATE_PROJECT_CATEGORY.toString(), {
            id: body.project_id,
            category_id: d.id,
            category_name: d.name,
            category_color: d.color_code
        });
        
    } catch (error) {
        log_error(error);
    }
}