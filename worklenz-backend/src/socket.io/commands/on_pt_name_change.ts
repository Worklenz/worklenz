import { Server, Socket } from "socket.io";
import { getLoggedInUserIdFromSocket, log_error } from "../util";
import db from "../../config/db";
import { SocketEvents } from "../events";

export async function on_pt_name_change(_io: Server, socket: Socket, data?: string) {
    try {
        const userId = getLoggedInUserIdFromSocket(socket);
        if (!userId) return;

        const body = JSON.parse(data as string);
        const name = (body?.template_name || "").trim();
        if (!body?.template_id || !name) return;

        const q = `
            UPDATE custom_project_templates cpt
            SET name = $2
            WHERE cpt.id = $1
              AND EXISTS (
                SELECT 1 FROM team_members tm
                WHERE tm.team_id = cpt.team_id
                  AND tm.user_id = $3
                  AND tm.active IS TRUE
                  AND tm.is_guest IS FALSE
              )
            RETURNING cpt.name;
        `;

        const result = await db.query(q, [body.template_id, name, userId]);
        if (!result.rows.length) return;
        const [d] = result.rows;

        socket.emit(SocketEvents.PT_NAME_CHANGE.toString(), {
            template_id: body.template_id,
            template_name: d.name
        });

    } catch (e) {
        log_error(e);
    }
}
