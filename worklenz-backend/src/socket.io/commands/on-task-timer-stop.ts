import {Server, Socket} from "socket.io";
import db from "../../config/db";
import {SocketEvents} from "../events";

import {getLoggedInUserIdFromSocket, log_error, notifyProjectUpdates} from "../util";

export async function on_task_timer_stop(_io: Server, socket: Socket, data?: string) {
  try {
    const body = JSON.parse(data as string);
    const userId = getLoggedInUserIdFromSocket(socket);
    const q = `
    DO
    $$
        DECLARE
            _start_time TIMESTAMPTZ;
            _time_spent NUMERIC;
        BEGIN

            SELECT start_time FROM task_timers WHERE user_id = '${userId}' AND task_id = '${body.task_id}' INTO _start_time;

            _time_spent = COALESCE(EXTRACT(EPOCH FROM
                                           (DATE_TRUNC('second', (CURRENT_TIMESTAMP - _start_time::TIMESTAMPTZ)))::INTERVAL),
                                   0);

            IF (_time_spent > 0)
            THEN
                INSERT INTO task_work_log (time_spent, task_id, user_id, logged_by_timer, created_at)
                VALUES (_time_spent, '${body.task_id}', '${userId}', TRUE, _start_time);
            END IF;

            DELETE FROM task_timers WHERE user_id = '${userId}' AND task_id = '${body.task_id}';
        END
    $$;
    `;
    await db.query(q, []);

    socket.emit(SocketEvents.TASK_TIMER_STOP.toString(), {
      id: body.task_id,
      parent_task: body.parent_task,
    });
    notifyProjectUpdates(socket, body.task_id);
    return;
  } catch (error) {
    log_error(error);
  }

  socket.emit(SocketEvents.TASK_TIMER_STOP.toString(), null);
}
