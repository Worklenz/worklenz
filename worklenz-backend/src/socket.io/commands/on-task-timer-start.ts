import moment from "moment";
import {Server, Socket} from "socket.io";
import db from "../../config/db";
import {SocketEvents} from "../events";

import {getLoggedInUserIdFromSocket, log_error, notifyProjectUpdates} from "../util";

export async function on_task_timer_start(_io: Server, socket: Socket, data?: string) {
  try {
    const body = JSON.parse(data as string);
    const userId = getLoggedInUserIdFromSocket(socket);

    // First, stop any existing timers for this user
    const stopExistingTimersQ = `
    DO
    $$
        DECLARE
            _timer RECORD;
            _start_time TIMESTAMPTZ;
            _time_spent NUMERIC;
        BEGIN
            -- Process all existing timers for this user
            FOR _timer IN SELECT task_id, start_time FROM task_timers WHERE user_id = $1 AND task_id != $2
            LOOP
                _time_spent = COALESCE(EXTRACT(EPOCH FROM
                                               (DATE_TRUNC('second', (CURRENT_TIMESTAMP - _timer.start_time::TIMESTAMPTZ)))::INTERVAL),
                                       0);

                IF (_time_spent > 0)
                THEN
                    INSERT INTO task_work_log (time_spent, task_id, user_id, logged_by_timer, created_at)
                    VALUES (_time_spent, _timer.task_id, $1, TRUE, _timer.start_time);
                END IF;
            END LOOP;

            -- Delete all existing timers for this user except the current task
            DELETE FROM task_timers WHERE user_id = $1 AND task_id != $2;
        END
    $$;
    `;
    
    await db.query(stopExistingTimersQ, [userId, body.task_id]);

    // Now start the new timer
    const startTimerQ = `
    INSERT INTO task_timers (task_id, user_id, start_time)
    VALUES ($1, $2, CURRENT_TIMESTAMP)
    ON CONFLICT ON CONSTRAINT task_timers_pk DO UPDATE SET start_time = CURRENT_TIMESTAMP
    RETURNING start_time;
    `;

    const result = await db.query(startTimerQ, [body.task_id, userId]);
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
