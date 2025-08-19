import { Server, Socket } from "socket.io";
import { log_error } from "../util";
import db from "../../config/db";
import sanitizeHtml from "sanitize-html";
import { SocketEvents } from "../events";

export async function on_pt_task_description_change(_io: Server, socket: Socket, data?: string) {
    try {
        const body = JSON.parse(data as string);

        const q = `UPDATE cpt_tasks SET description = $2 WHERE id = $1 RETURNING description`;

        const description = (body.description || "").replace(/(^([ ]*<p><br><\/p>)*)|((<p><br><\/p>)*[ ]*$)/gi, "").trim() || null;

        const sanitized = description
          ? sanitizeHtml(description, {
              allowedTags: sanitizeHtml.defaults.allowedTags.concat(["img"]),
              allowedAttributes: {
                ...sanitizeHtml.defaults.allowedAttributes,
                a: ["href", "name", "target", "rel"],
                img: ["src", "alt", "title"],
              },
              allowedSchemes: ["http", "https", "data", "blob"],
            })
          : null;

        await db.query(q, [body.task_id, sanitized]);

        socket.emit(SocketEvents.PT_TASK_DESCRIPTION_CHANGE.toString(), {
            id: body.task_id,
            description
        });

    } catch (e) {
        log_error(e);
    }
}