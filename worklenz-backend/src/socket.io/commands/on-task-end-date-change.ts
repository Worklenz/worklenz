import {Server, Socket} from "socket.io";
import db from "../../config/db";
import {SocketEvents} from "../events";

import {getLoggedInUserIdFromSocket, notifyProjectUpdates} from "../util";
import {getTaskDetails, logEndDateChange} from "../../services/activity-logs/activity-logs.service";
import momentTime from "moment-timezone";
import { ExternalNotificationsService } from "../../services/external-notifications.service";
import { log_error } from "../../shared/utils";
import {verifyTaskAccessSocket, logUnauthorizedSocketAccess} from "../authorization";

export async function on_task_end_date_change(_io: Server, socket: Socket, data?: string) {
  try {
    const body = JSON.parse(data as string);
    
    const hasAccess = await verifyTaskAccessSocket(socket, body.task_id);
    if (!hasAccess) {
      logUnauthorizedSocketAccess(socket, 'TASK_END_DATE_CHANGE', 'task', body.task_id);
      return;
    }
    
    const q = `UPDATE tasks SET end_date = $2 WHERE id = $1 RETURNING end_date, start_date;`;
    const task_data = await getTaskDetails(body.task_id, "end_date");

    const result = await db.query(q, [body.task_id, body.end_date]);
    const [d] = result.rows;
    socket.emit(SocketEvents.TASK_END_DATE_CHANGE.toString(), {
      id: body.task_id,
      parent_task: body.parent_task,
      end_date: d.end_date ? momentTime.utc(d.end_date).format('YYYY-MM-DD') : null,
      start_date: d.start_date ? momentTime.utc(d.start_date).format('YYYY-MM-DD') : null,
      group_id: body.group_id
    });

    notifyProjectUpdates(socket, body.task_id);
    logEndDateChange({
      task_id: body.task_id,
      socket,
      new_value: d.end_date ? momentTime.utc(d.end_date).format('YYYY-MM-DD') : null,
      old_value: task_data.end_date ? momentTime.utc(task_data.end_date).format('YYYY-MM-DD') : null
    });

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
          "due_date_changed",
          userName
        );
      }
    } catch (notifError) {
      log_error("Error sending external notifications:", notifError);
      // Don't throw - continue even if notifications fail
    }

    return;
  } catch (error) {
    log_error(error);
  }

  socket.emit(SocketEvents.TASK_END_DATE_CHANGE.toString(), null);
}
