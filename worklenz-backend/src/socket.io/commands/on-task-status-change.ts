import {Server, Socket} from "socket.io";

import db from "../../config/db";
import {NotificationsService} from "../../services/notifications/notifications.service";
import {TASK_STATUS_COLOR_ALPHA} from "../../shared/constants";
import {SocketEvents} from "../events";
import {getLoggedInUserIdFromSocket, log_error, notifyProjectUpdates} from "../util";
import TasksControllerV2 from "../../controllers/tasks-controller-v2";
import {getTaskDetails, logStatusChange} from "../../services/activity-logs/activity-logs.service";
import { assignMemberIfNot } from "./on-quick-assign-or-remove";

export async function on_task_status_change(_io: Server, socket: Socket, data?: string) {
  try {
    const body = JSON.parse(data as string);
    const userId = getLoggedInUserIdFromSocket(socket);
    const task_data = await getTaskDetails(body.task_id, "status_id");

    const q2 = "SELECT handle_on_task_status_change($1, $2, $3) AS res;";
    const results1 = await db.query(q2, [userId, body.task_id, body.status_id]);
    const [d] = results1.rows;
    const changeResponse = d.res;

    changeResponse.color_code = changeResponse.color_code + TASK_STATUS_COLOR_ALPHA;

    // notify to all task members of the change
    for (const member of changeResponse.members || []) {
      if (member.user_id === userId) continue;
      NotificationsService.createNotification({
        userId: member.user_id,
        teamId: member.team_id,
        socketId: member.socket_id,
        message: changeResponse.message,
        taskId: body.task_id,
        projectId: changeResponse.project_id
      });
    }

    const info = await TasksControllerV2.getTaskCompleteRatio(body.parent_task || body.task_id);

    socket.emit(SocketEvents.TASK_STATUS_CHANGE.toString(), {
      id: body.task_id,
      parent_task: body.parent_task,
      color_code: changeResponse.color_code,
      complete_ratio: info?.ratio,
      completed_count: info?.total_completed,
      total_tasks_count: info?.total_tasks,
      status_id: body.status_id,
      completed_at: changeResponse.completed_at,
      statusCategory: changeResponse.status_category
    });

    socket.emit(SocketEvents.GET_TASK_PROGRESS.toString(), {
      id: body.task_id,
      parent_task: body.parent_task,
      complete_ratio: info?.ratio,
      completed_count: info?.total_completed,
      total_tasks_count: info?.total_tasks
    });

    const isAlreadyAssigned = await TasksControllerV2.checkUserAssignedToTask(body.task_id, userId as string, body.team_id);

    if (!isAlreadyAssigned) {
      await assignMemberIfNot(body.task_id, userId as string, body.team_id, _io, socket);
    }

    logStatusChange({
      task_id: body.task_id,
      socket,
      new_value: body.status_id,
      old_value: task_data.status_id
    });

    notifyProjectUpdates(socket, body.task_id);
  } catch (error) {
    log_error(error);
  }
}
