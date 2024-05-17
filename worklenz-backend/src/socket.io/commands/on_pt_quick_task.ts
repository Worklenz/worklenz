import { Server, Socket } from "socket.io";
import { log_error } from "../util";
import { getColor, toMinutes } from "../../shared/utils";
import { TASK_STATUS_COLOR_ALPHA, UNMAPPED } from "../../shared/constants";
import db from "../../config/db";
import { SocketEvents } from "../events";
import PtTasksController from "../../controllers/project-templates/pt-tasks-controller";

function updatePhaseInfo(model: any, body: any) {
    model.phase_id = body.phase_id;

    if (model.phase_name) {
        model.phase_color = getColor(model.phase_name) + TASK_STATUS_COLOR_ALPHA;
    }
}

export async function on_pt_quick_task(_io: Server, socket: Socket, data?: string) {
    try {
        const body = JSON.parse(data as string);

        const q = `SELECT create_quick_pt_task($1) AS task`;

        body.name = (body.name || "").trim();
        body.priority_id = body.priority_id?.trim() || null;
        body.status_id = body.status_id?.trim() || null;
        body.phase_id = body.phase_id?.trim() || null;

        if (body.priority_id === UNMAPPED) body.priority_id = null;
        if (body.phase_id === UNMAPPED) body.phase_id = null;
        if (body.status_id === UNMAPPED) body.status_id = null;

        if (body.name.length > 0) {
            body.total_minutes = toMinutes(body.total_hours, body.total_minutes);
            const result = await db.query(q, [JSON.stringify(body)]);
            const [d] = result.rows;
            if (d.task) {
                const model = PtTasksController.updateTaskViewModel(d.task);

                updatePhaseInfo(model, body);

                socket.emit(SocketEvents.PT_QUICK_TASK.toString(), model);
            }
        }

    } catch (e) {
        log_error(e);
    }

    socket.emit(SocketEvents.PT_QUICK_TASK.toString(), null);

}