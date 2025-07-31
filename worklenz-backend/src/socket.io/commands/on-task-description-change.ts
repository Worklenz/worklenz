import { Server, Socket } from "socket.io";
import db from "../../config/db";
import { SocketEvents } from "../events";

import { log_error, notifyProjectUpdates } from "../util";
import sanitize from "sanitize-html";
import {
  getTaskDetails,
  logDescriptionChange,
} from "../../services/activity-logs/activity-logs.service";

export async function on_task_description_change(
  _io: Server,
  socket: Socket,
  data?: string
) {
  try {
    const body = JSON.parse(data as string);

    const q = `UPDATE tasks
               SET description = $2
               WHERE id = $1
               RETURNING description;`;
    const task_data = await getTaskDetails(body.task_id, "description");

    const description =
      (body.description || "")
        .replace(/(^([ ]*<p><br><\/p>)*)|((<p><br><\/p>)*[ ]*$)/gi, "")
        .trim() || null;

    await db.query(q, [body.task_id, sanitize(description)]);

    socket.emit(SocketEvents.TASK_DESCRIPTION_CHANGE.toString(), {
      id: body.task_id,
      description,
      parent_task: body.parent_task,
    });

    if (description && task_data.description) {
      logDescriptionChange({
        task_id: body.task_id,
        socket,
        new_value: description,
        old_value: task_data.description,
      });
    }

    notifyProjectUpdates(socket, body.task_id);
    // }
  } catch (error) {
    log_error(error);
  }
}
