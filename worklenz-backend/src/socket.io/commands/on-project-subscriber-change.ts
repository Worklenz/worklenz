import {Server, Socket} from "socket.io";
import db from "../../config/db";
import {SocketEvents} from "../events";

import {log_error} from "../util";
import TasksControllerV2 from "../../controllers/tasks-controller-v2";

interface IProjectSubscribeRequest {
  mode: number;
  project_id: string;
  user_id: string;
  team_member_id: string;
}

export async function on_project_subscriber_change(_io: Server, socket: Socket, data?: IProjectSubscribeRequest) {
  if (!data) return;

  try {
    const isSubscribe = data.mode == 0;
    const q = isSubscribe
      ? `INSERT INTO project_subscribers (user_id, project_id, team_member_id)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id, project_id, team_member_id) DO NOTHING;`
      : `DELETE
         FROM project_subscribers
         WHERE user_id = $1
           AND project_id = $2
           AND team_member_id = $3;`;
    await db.query(q, [data.user_id, data.project_id, data.team_member_id]);

    const subscribers = await TasksControllerV2.getProjectSubscribers(data.project_id);
    socket.emit(SocketEvents.PROJECT_SUBSCRIBERS_CHANGE.toString(), subscribers);

    return;
  } catch (error) {
    log_error(error);
  }
}
