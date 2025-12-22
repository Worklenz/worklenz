import {Server, Socket} from "socket.io";
import db from "../../config/db";
import WorklenzControllerBase from "../../controllers/worklenz-controller-base";
import {SocketEvents} from "../events";

import {log_error, notifyProjectUpdates, parseSocketPayload} from "../util";
import {logLabelsUpdate} from "../../services/activity-logs/activity-logs.service";

export async function on_task_label_change(_io: Server, socket: Socket, data?: string) {
  try {
    const body = parseSocketPayload<any>(data as string);

    if (!body) return;
    const result = await db.query(q, [body.task_id, body.label_id]);
    const [d] = result.rows;

    const labels = WorklenzControllerBase.createTagList(d.labels || [], 2);

    socket.emit(SocketEvents.TASK_LABELS_CHANGE.toString(), {
      id: body.task_id, parent_task: body.parent_task, all_labels: d.labels || [], labels
    });

    logLabelsUpdate({
      task_id: body.task_id,
      socket,
      new_value: body.label_id,
      old_value: null
    });

    notifyProjectUpdates(socket, body.task_id);
  } catch (error) {
    log_error(error);
  }
}
