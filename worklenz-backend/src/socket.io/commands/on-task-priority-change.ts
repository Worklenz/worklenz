import {Server, Socket} from "socket.io";
import db from "../../config/db";
import {PriorityColorCodes, PriorityColorCodesDark, TASK_PRIORITY_COLOR_ALPHA} from "../../shared/constants";
import {SocketEvents} from "../events";

import {getLoggedInUserIdFromSocket, notifyProjectUpdates} from "../util";
import {getTaskDetails, logPriorityChange} from "../../services/activity-logs/activity-logs.service";
import { ExternalNotificationsService } from "../../services/external-notifications.service";
import { log_error } from "../../shared/utils";
import {verifyTaskAccessSocket, logUnauthorizedSocketAccess} from "../authorization";

export async function on_task_priority_change(_io: Server, socket: Socket, data?: string) {
  try {
    const body = JSON.parse(data as string);
    
    const hasAccess = await verifyTaskAccessSocket(socket, body.task_id);
    if (!hasAccess) {
      logUnauthorizedSocketAccess(socket, 'TASK_PRIORITY_CHANGE', 'task', body.task_id);
      return;
    }
    
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
      priority_id: body.priority_id,
      priority_value: parseInt(d.value) || 0
    });

    logPriorityChange({
      task_id: body.task_id,
      socket,
      new_value: body.priority_id,
      old_value: task_data.priority_id
    });

    notifyProjectUpdates(socket, body.task_id);

    // Send external notifications (Slack, Teams)
    try {
      const userId = getLoggedInUserIdFromSocket(socket);
      const userQuery = `SELECT name FROM users WHERE id = $1`;
      const userResult = await db.query(userQuery, [userId]);
      const userName = userResult.rows[0]?.name || "Unknown User";

      const projectQuery = `SELECT project_id FROM tasks WHERE id = $1`;
      const projectResult = await db.query(projectQuery, [body.task_id]);
      const projectId = projectResult.rows[0]?.project_id;

      if (projectId) {
        await ExternalNotificationsService.sendExternalNotifications(
          projectId,
          body.task_id,
          "priority_changed",
          userName
        );
      }
    } catch (notifError) {
      log_error("Error sending external notifications:", notifError);
      // Don't throw - continue even if notifications fail
    }
  } catch (error) {
    log_error(error);
  }
}
