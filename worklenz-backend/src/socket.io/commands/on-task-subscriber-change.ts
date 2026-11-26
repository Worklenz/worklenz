import { Server, Socket } from "socket.io";
import db from "../../config/db";
import { SocketEvents } from "../events";

import { getLoggedInUserIdFromSocket, log_error } from "../util";
import { verifyTaskAccessSocket, logUnauthorizedSocketAccess } from "../authorization";
import TasksControllerV2 from "../../controllers/tasks-controller-v2";
import { ISocketSession } from "../../interfaces/socket-session";
import { IPassportSession } from "../../interfaces/passport-session";
import { canUserEditTask } from "../../shared/assignee-task-scope";
import { checkTaskRolePermission } from "../../shared/project-role-permissions";
import { PROJECT_ROLE_PERMISSIONS } from "../../shared/organization-permissions";

interface ITaskSubscribeRequest {
  mode: number;
  task_id: string;
  user_id?: string | null;
  team_member_id: string;
}

export async function on_task_subscriber_change(_io: Server, socket: Socket, data?: ITaskSubscribeRequest) {
  if (typeof data == "string") {
    data = JSON.parse(data as string);
  }
  if (!data || !data.task_id || !data.team_member_id) return;

  const userId = getLoggedInUserIdFromSocket(socket);
  if (!userId) {
    logUnauthorizedSocketAccess(socket, "TASK_SUBSCRIBERS_CHANGE", "task", data.task_id);
    return;
  }

  const hasAccess = await verifyTaskAccessSocket(socket, data.task_id);
  if (!hasAccess) {
    logUnauthorizedSocketAccess(socket, "TASK_SUBSCRIBERS_CHANGE", "task", data.task_id);
    socket.emit(SocketEvents.TASK_SUBSCRIBERS_CHANGE.toString(), []);
    return;
  }

  try {
    // Verify that the target team member belongs to the same project/team as the task
    const memberCheck = await db.query(
      `SELECT tm.id, tm.user_id
       FROM team_members tm
       INNER JOIN projects p ON p.team_id = tm.team_id
       INNER JOIN tasks t ON t.project_id = p.id
       WHERE t.id = $1 AND tm.id = $2
       LIMIT 1;`,
      [data.task_id, data.team_member_id]
    );

    if (!memberCheck.rowCount) {
      logUnauthorizedSocketAccess(socket, "TASK_SUBSCRIBERS_CHANGE", "task", data.task_id);
      socket.emit(SocketEvents.TASK_SUBSCRIBERS_CHANGE.toString(), []);
      return;
    }

    const targetUserId = memberCheck.rows[0].user_id;
    if (!targetUserId) {
      logUnauthorizedSocketAccess(socket, "TASK_SUBSCRIBERS_CHANGE", "task", data.task_id);
      socket.emit(SocketEvents.TASK_SUBSCRIBERS_CHANGE.toString(), []);
      return;
    }

    // If modifying another member's subscription, caller must have permission to edit the task
    if (targetUserId !== userId) {
      const { session } = socket.request as ISocketSession;
      const sessionUser = session?.passport?.user as IPassportSession | undefined;
      const canEdit = (await canUserEditTask(userId, data.task_id, sessionUser)) &&
        (await checkTaskRolePermission(userId, data.task_id, PROJECT_ROLE_PERMISSIONS.EDIT_TASKS)).allowed;

      if (!canEdit) {
        logUnauthorizedSocketAccess(socket, "TASK_SUBSCRIBERS_CHANGE", "task", data.task_id);
        socket.emit(SocketEvents.TASK_SUBSCRIBERS_CHANGE.toString(), []);
        return;
      }
    }

    const isSubscribe = data.mode == 0;
    const q = isSubscribe
      ? `INSERT INTO task_subscribers (user_id, task_id, team_member_id, action)
         VALUES ($1, $2, $3, 'WHEN_DONE')
         ON CONFLICT DO NOTHING;`
      : `DELETE
         FROM task_subscribers
         WHERE task_id = $1
           AND team_member_id = $2
           AND user_id = $3;`;

    await db.query(q, isSubscribe
      ? [targetUserId, data.task_id, data.team_member_id]
      : [data.task_id, data.team_member_id, targetUserId]
    );

    const subscribers = await TasksControllerV2.getTaskSubscribers(data.task_id);
    socket.emit(SocketEvents.TASK_SUBSCRIBERS_CHANGE.toString(), subscribers);
  } catch (error) {
    log_error(error);
  }
}
