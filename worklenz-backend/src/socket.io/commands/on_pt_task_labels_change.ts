import { Server, Socket } from "socket.io";
import { log_error } from "../util";
import WorklenzControllerBase from "../../controllers/worklenz-controller-base";
import db from "../../config/db";
import { SocketEvents } from "../events";

export async function on_pt_task_labels_change(_io: Server, socket: Socket, data?: string) {
    try {
        const body = JSON.parse(data as string);

        const q = `SELECT add_or_remove_pt_task_label($1, $2) AS labels`;
        const result = await db.query(q, [body.task_id, body.label_id]);
        const [d] = result.rows;

        const labels = WorklenzControllerBase.createTagList(d.labels || [], 2);

        socket.emit(SocketEvents.PT_TASK_LABELS_CHANGE.toString(), {
            id: body.task_id, 
            parent_task: body.parent_task, 
            all_labels: d.labels || [], labels
          });

    } catch (e) {
        log_error(e);
    }
}