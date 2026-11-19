import { Server, Socket } from "socket.io";
import db from "../../config/db";
import { SocketEvents } from "../events";

import { getLoggedInUserIdFromSocket, log_error } from "../util";
import { verifyTaskAccessSocket, logUnauthorizedSocketAccess } from "../authorization";
import TasksControllerV2 from "../../controllers/tasks-controller-v2";

interface ITaskSubscribeRequest {
  mode: number;
  task_id: string;
  user_id: string;
  team_member_id: string;
}

export async function on_task_subscriber_change(_io: Server, socket: Socket, data?: ITaskSubscribeRequest) {
  if (typeof data == "string") {
    data = JSON.parse(data as string);
  };
  if (!data || !data.task_id) return;

  const userId = getLoggedInUserIdFromSocket(socket);
  if (!userId) {
    logUnauthorizedSocketAccess(socket, "TASK_SUBSCRIBERS_CHANGE", "task", data.task_id);
    return;
  }

  // Users may only subscribe or unsubscribe their own account
  if (data.user_id && data.user_id !== userId) {
    logUnauthorizedSocketAccess(socket, "TASK_SUBSCRIBERS_CHANGE", "task", data.task_id);
    return;
  }
  data.user_id = userId;

  const hasAccess = await verifyTaskAccessSocket(socket, data.task_id);
  if (!hasAccess) {
    logUnauthorizedSocketAccess(socket, "TASK_SUBSCRIBERS_CHANGE", "task", data.task_id);
    return;
  }
  try {
    const isSubscribe = data.mode == 0;
    const q = isSubscribe
      ? `INSERT INTO task_subscribers (user_id, task_id, team_member_id, action)
         VALUES ($1, $2, $3, 'WHEN_DONE');`
      : `DELETE
         FROM task_subscribers
         WHERE user_id = $1
           AND task_id = $2
           AND team_member_id = $3;`;
    await db.query(q, [data.user_id, data.task_id, data.team_member_id]);

    const subscribers = await TasksControllerV2.getTaskSubscribers(data.task_id);
    socket.emit(SocketEvents.TASK_SUBSCRIBERS_CHANGE.toString(), subscribers);

    return;
  } catch (error) {
    log_error(error);
  }
}
