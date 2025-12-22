import moment from "moment";
import {Server, Socket} from "socket.io";
import db from "../../config/db";
import {SocketEvents} from "../events";

import {getLoggedInUserIdFromSocket, log_error, notifyProjectUpdates, parseSocketPayload} from "../util";

export async function on_task_timer_start(_io: Server, socket: Socket, data?: string) {
  try {
    const userId = getLoggedInUserIdFromSocket(socket);
    if (!userId) return;
    const q = `
    INSERT INTO task_timers (task_id, user_id, start_time)
    VALUES ($1, $2, CURRENT_TIMESTAMP)
    ON CONFLICT ON CONSTRAINT task_timers_pk DO UPDATE SET start_time = CURRENT_TIMESTAMP
    RETURNING start_time;
    `;
    const body = parseSocketPayload<any>(data as string);
    if (!body) return;

    const result = await db.query(q, [body.task_id, userId]);
    const [d] = result.rows;
    socket.emit(SocketEvents.TASK_TIMER_START.toString(), {
      id: body.task_id,
      timer_start_time: moment(d.start_time).valueOf(),
      parent_task: body.parent_task,
    });
    notifyProjectUpdates(socket, body.task_id);
    return;
  } catch (error) {
    log_error(error);
  }

  socket.emit(SocketEvents.TASK_TIMER_START.toString(), null);
}
