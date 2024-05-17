import {Server, Socket} from "socket.io";
import db from "../../config/db";
import {NotificationsService} from "../../services/notifications/notifications.service";
import {SocketEvents} from "../events";

import {getLoggedInUserIdFromSocket, log_error, notifyProjectUpdates} from "../util";
import {getTaskDetails, logNameChange} from "../../services/activity-logs/activity-logs.service";

export async function on_task_name_change(_io: Server, socket: Socket, data?: string) {
  try {
    const body = JSON.parse(data as string);
    const userId = getLoggedInUserIdFromSocket(socket);

    const name = (body.name || "").trim();
    const task_data = await getTaskDetails(body.task_id, "name");

    const q = `SELECT handle_task_name_change($1, $2, $3) AS response;`;

    const result = await db.query(q, [body.task_id, name, userId]);
    const [d] = result.rows;
    const response = d.response || {};

    for (const member of response.members || []) {
      if (member.user_id === userId) continue;
      NotificationsService.createNotification({
        userId: member.user_id,
        teamId: member.team_id,
        socketId: member.socket_id,
        message: response.message,
        taskId: body.task_id,
        projectId: response.project_id
      });
    }

    socket.emit(SocketEvents.TASK_NAME_CHANGE.toString(), {
      id: body.task_id,
      parent_task: body.parent_task,
      name: response.name
    });
    notifyProjectUpdates(socket, body.task_id);

    logNameChange({
      task_id: body.task_id,
      socket,
      new_value: response.name,
      old_value: task_data.name
    });

  } catch (error) {
    log_error(error);
  }
}
