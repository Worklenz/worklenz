import {Server, Socket} from "socket.io";

import db from "../../config/db";
import {TASK_STATUS_COLOR_ALPHA, UNMAPPED} from "../../shared/constants";
import {SocketEvents} from "../events";
import {log_error, notifyProjectUpdates} from "../util";
import {getColor} from "../../shared/utils";
import { getTaskPhaseDetails, logPhaseChange } from "../../services/activity-logs/activity-logs.service";

export async function on_task_phase_change(_io: Server, socket: Socket, body?: any) {
  try {
    if (!body?.task_id) return;

    const q2 = `SELECT handle_on_task_phase_change($1, $2) AS res;`;

    const phaseId = !body.phase_id || (body.phase_id === UNMAPPED) ? null : body.phase_id;

    const task_data = await getTaskPhaseDetails(body.task_id);

    const result = await db.query(q2, [body.task_id, phaseId]);
    const [d] = result.rows;
    const changeResponse = d.res;

    changeResponse.color_code = changeResponse.color_code
      ? changeResponse.color_code : getColor(changeResponse.name) + TASK_STATUS_COLOR_ALPHA;

    socket.emit(SocketEvents.TASK_PHASE_CHANGE.toString(), {
      id: body.phase_id,
      task_id: body.task_id,
      parent_task: body.parent_task,
      color_code: changeResponse.color_code,
      status_id: body.status_id
    });

    // TODO: Log to activity log
    logPhaseChange({
      task_id: body.task_id,
      socket,
      new_value: phaseId ? phaseId : null,
      old_value: task_data.phase_id ? task_data.phase_id : null
    });

    void notifyProjectUpdates(socket, body.task_id);
  } catch (error) {
    log_error(error);
  }
}
