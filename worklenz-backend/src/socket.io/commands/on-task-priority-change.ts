import {Server, Socket} from "socket.io";
import db from "../../config/db";
import {PriorityColorCodes, PriorityColorCodesDark, TASK_PRIORITY_COLOR_ALPHA} from "../../shared/constants";
import {SocketEvents} from "../events";

import {log_error, notifyProjectUpdates} from "../util";
import {getTaskDetails, logPriorityChange} from "../../services/activity-logs/activity-logs.service";

export async function on_task_priority_change(_io: Server, socket: Socket, data?: string) {
  try {
    const body = JSON.parse(data as string);
    const task_data = await getTaskDetails(body.task_id, "priority_id");

    const q = `UPDATE tasks SET priority_id = $2 WHERE id = $1;`;
    await db.query(q, [body.task_id, body.priority_id]);

    const q2 = "SELECT value FROM task_priorities WHERE id = $1;";
    const result = await db.query(q2, [body.priority_id]);
    const [d] = result.rows;

    d.color_code = (PriorityColorCodes[d.value] || PriorityColorCodes["0"]) + TASK_PRIORITY_COLOR_ALPHA;
    d.color_code_dark = PriorityColorCodesDark[d.value] || PriorityColorCodesDark["0"];

    socket.emit(SocketEvents.TASK_PRIORITY_CHANGE.toString(), {
      id: body.task_id,
      parent_task: body.parent_task,
      color_code: d.color_code,
      color_code_dark: d.color_code_dark,
      priority_id: body.priority_id
    });

    logPriorityChange({
      task_id: body.task_id,
      socket,
      new_value: body.priority_id,
      old_value: task_data.priority_id
    });

    notifyProjectUpdates(socket, body.task_id);
  } catch (error) {
    log_error(error);
  }
}
