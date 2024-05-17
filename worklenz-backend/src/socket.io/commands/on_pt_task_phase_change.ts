import { Server, Socket } from "socket.io";
import { log_error } from "../util";
import { TASK_STATUS_COLOR_ALPHA, UNMAPPED } from "../../shared/constants";
import { getColor } from "../../shared/utils";
import { SocketEvents } from "../events";
import db from "../../config/db";

export async function on_pt_task_phase_change(_io: Server, socket: Socket, data?: string) {
    try {
        const body = JSON.parse(data as string);

        if (!body?.task_id) return;

        const q2 = `SELECT handle_on_pt_task_phase_change($1, $2) AS res;`;

        const phaseId = !body.phase_id || (body.phase_id === UNMAPPED) ? null : body.phase_id;

        const result = await db.query(q2, [body.task_id, phaseId]);
        const [d] = result.rows;
        const changeResponse = d.res;

        socket.emit(SocketEvents.PT_TASK_PHASE_CHANGE.toString(), {
            id: body.phase_id,
            task_id: body.task_id,
            parent_task: body.parent_task,
            color_code: changeResponse.color_code + TASK_STATUS_COLOR_ALPHA,
            status_id: body.status_id
        });

    } catch (e) {
        log_error(e);
    }
}
