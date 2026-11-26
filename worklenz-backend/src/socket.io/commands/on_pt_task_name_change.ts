import { Server, Socket } from "socket.io";
import { getLoggedInUserIdFromSocket, log_error } from "../util";
import db from "../../config/db";
import { SocketEvents } from "../events";

export async function on_pt_task_name_change(_io: Server, socket: Socket, data?: string) {
    try {
        const userId = getLoggedInUserIdFromSocket(socket);
        if (!userId) return;

        const body = JSON.parse(data as string);
        const name = (body?.name || "").trim();
        if (!body?.task_id || !name) return;

        const q = `
            UPDATE cpt_tasks t
            SET name = $2
            FROM custom_project_templates cpt
            JOIN team_members tm ON tm.team_id = cpt.team_id AND tm.user_id = $3 AND tm.active IS TRUE AND tm.is_guest IS FALSE
            WHERE t.id = $1 AND cpt.id = t.template_id
            RETURNING t.name;
        `;

        const result = await db.query(q, [body.task_id, name, userId]);
        if (!result.rows.length) return;
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
